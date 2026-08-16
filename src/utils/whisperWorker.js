// Whisper transcription worker.
//
// Runs entirely off the main thread. Whisper inference is CPU-heavy and takes
// minutes on long audio; doing it on the main thread freezes the page and
// triggers the browser's "Page Unresponsive" dialog. The main thread decodes
// the audio (AudioContext isn't available in workers) and transfers the raw
// samples here.

let transcriber = null;
let libPromise = null;

const TRANSFORMERS_CDNS = [
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm',
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.web.js',
  'https://unpkg.com/@huggingface/transformers@3.8.1/dist/transformers.web.js'
];

async function loadTransformers() {
  if (libPromise) return libPromise;

  libPromise = (async () => {
    const errors = [];
    for (const url of TRANSFORMERS_CDNS) {
      try {
        const mod = await import(/* @vite-ignore */ url);
        if (mod && typeof mod.pipeline === 'function') return mod;
        errors.push(`${url}: no pipeline export`);
      } catch (e) {
        errors.push(`${url}: ${e?.message || e}`);
      }
    }
    throw new Error(`Could not load speech library. Tried:\n${errors.join('\n')}`);
  })();

  libPromise.catch(() => {
    libPromise = null;
  });

  return libPromise;
}

function post(type, payload) {
  self.postMessage({ type, ...payload });
}

async function getTranscriber(modelId) {
  if (transcriber) return transcriber;

  const { pipeline } = await loadTransformers();
  post('progress', { message: 'Loading speech model (first time only, cached after)...', pct: 5 });

  transcriber = await pipeline('automatic-speech-recognition', modelId, {
    dtype: 'q8',
    progress_callback: (p) => {
      if (p?.status === 'progress' && typeof p.progress === 'number') {
        post('progress', {
          message: `Downloading speech model... ${Math.round(p.progress)}%`,
          pct: 5 + p.progress * 0.25
        });
      }
    }
  });

  return transcriber;
}

self.onmessage = async (event) => {
  const { audio, modelId } = event.data || {};

  const SAMPLE_RATE = 16000;
  const WINDOW_S = 25;   // Whisper handles 30s natively; 25 leaves headroom
  const OVERLAP_S = 2;   // so a word straddling a boundary is caught by one side

  try {
    const model = await getTranscriber(modelId || 'onnx-community/whisper-base_timestamped');

    const totalSec = audio.length / SAMPLE_RATE;

    // Transcribe in explicit windows rather than handing the whole track to the
    // pipeline's own chunker. Its internal merging can silently drop a stretch
    // of speech, which leaves a hole in the word stream that no aligner can
    // recover from. Windowing here guarantees every second is covered, and the
    // timestamps are shifted back onto the original timeline.
    const words = [];
    const step = WINDOW_S - OVERLAP_S;
    const windowCount = Math.max(1, Math.ceil(totalSec / step));

    for (let w = 0; w < windowCount; w++) {
      const from = w * step;
      if (from >= totalSec) break;
      const to = Math.min(totalSec, from + WINDOW_S);

      const slice = audio.subarray(
        Math.floor(from * SAMPLE_RATE),
        Math.floor(to * SAMPLE_RATE)
      );
      if (slice.length < SAMPLE_RATE * 0.2) break;

      post('progress', {
        message: `Transcribing audio... ${Math.round((from / totalSec) * 100)}%`,
        pct: 32 + (from / totalSec) * 55
      });

      let output;
      try {
        output = await model(slice, { return_timestamps: 'word' });
      } catch (windowErr) {
        // One bad window shouldn't lose the whole transcript
        continue;
      }

      const chunks = output?.chunks || [];
      const lastEnd = words.length ? words[words.length - 1].end : -1;

      for (const c of chunks) {
        const ts = c?.timestamp;
        const text = String(c?.text ?? '').trim();
        if (!text) continue;
        const s0 = Array.isArray(ts) ? ts[0] : undefined;
        const e0 = Array.isArray(ts) ? ts[1] : undefined;
        if (typeof s0 !== 'number') continue;

        const start = s0 + from;
        const end = (typeof e0 === 'number' && e0 > s0 ? e0 : s0 + 0.15) + from;

        // Skip words already captured by the previous window's overlap
        if (start <= lastEnd - 0.05) continue;

        words.push({ word: text, start, end });
      }
    }

    words.sort((a, b) => a.start - b.start);

    if (words.length === 0) {
      throw new Error('No speech was recognized in this audio.');
    }

    // Report any remaining holes so a transcription failure is visible rather
    // than silently turning into mis-cut lines.
    const holes = [];
    for (let i = 1; i < words.length; i++) {
      const gap = words[i].start - words[i - 1].end;
      if (gap > 4) holes.push(`${words[i - 1].end.toFixed(0)}s-${words[i].start.toFixed(0)}s`);
    }

    post('done', { words, holes });
  } catch (err) {
    post('error', { message: err?.message || String(err) });
  }
};
