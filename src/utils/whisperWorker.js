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
  const { audio, modelId, totalDuration } = event.data || {};

  try {
    const model = await getTranscriber(modelId || 'onnx-community/whisper-base_timestamped');

    post('progress', { message: 'Transcribing audio... this can take a few minutes.', pct: 32 });

    let lastReport = Date.now();

    const output = await model(audio, {
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
      // Fired as each 30s chunk finishes, so the UI can show real movement
      // instead of appearing frozen for minutes.
      chunk_callback: () => {
        const now = Date.now();
        if (now - lastReport > 400) {
          lastReport = now;
          post('progress', { message: 'Transcribing audio...', pct: -1 });
        }
      }
    });

    const chunks = output?.chunks || [];
    const words = [];

    for (const c of chunks) {
      const ts = c?.timestamp;
      const text = String(c?.text ?? '').trim();
      if (!text) continue;
      const start = Array.isArray(ts) ? ts[0] : undefined;
      const end = Array.isArray(ts) ? ts[1] : undefined;
      if (typeof start !== 'number') continue;
      words.push({
        word: text,
        start,
        end: typeof end === 'number' && end > start ? end : start + 0.15
      });
    }

    if (chunks.length > 0 && words.length === 0) {
      throw new Error(
        'The speech model returned text but no word timings. This model may not support word-level timestamps.'
      );
    }

    post('done', { words });
  } catch (err) {
    post('error', { message: err?.message || String(err) });
  }
};
