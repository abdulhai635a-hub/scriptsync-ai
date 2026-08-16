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

function countWords(chunks) {
  let n = 0;
  for (const c of chunks || []) if (String(c?.text ?? '').trim()) n++;
  return n;
}

async function transcribeWindow(model, audioSlice, extra) {
  try {
    const out = await model(audioSlice, { return_timestamps: 'word', ...(extra || {}) });
    return out?.chunks || [];
  } catch (e) {
    return [];
  }
}

self.onmessage = async (event) => {
  const { audio, modelId } = event.data || {};

  const SAMPLE_RATE = 16000;
  const WINDOW_S = 30;   // Whisper's native input length
  // Whisper reliably loses a few seconds at the very start and end of each
  // chunk it's given, so neighbouring windows must overlap by more than that
  // loss or a hole opens exactly on the boundary — which is what produced the
  // gap seen at 46s, precisely where one window began. 8s covers the observed
  // loss with margin.
  const OVERLAP_S = 8;

  try {
    const model = await getTranscriber(modelId || 'onnx-community/whisper-small_timestamped');

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

      // Feed the audio through unchanged.
      //
      // Boosting quiet windows was tried and made things measurably worse: the
      // stretches that transcribe poorly are quiet *because* speech there sits
      // under music or noise, and raising the gain lifts that interference
      // just as much as the voice. Whisper's own feature extractor already
      // normalises its input, so there is nothing to gain here anyway.
      let chunks = await transcribeWindow(model, slice);

      // A window that comes back implausibly sparse is retried once. Whisper's
      // decoding is not deterministic under a different temperature, so a
      // second attempt sometimes recovers speech the first pass gave up on.
      const spokenSec = to - from;
      if (countWords(chunks) < spokenSec / 4) {
        const retry = await transcribeWindow(model, slice, { temperature: 0.2 });
        if (countWords(retry) > countWords(chunks)) chunks = retry;
      }

      // Deduplicate on START time, not END.
      //
      // Whisper often reports the final word of a chunk as running all the way
      // to the chunk boundary. Comparing against that inflated end makes the
      // next window's genuine words look like duplicates, and they get thrown
      // away - which is how a whole stretch of ordinary speech can vanish.
      // Start times are monotonic and trustworthy, so they are used instead.
      const lastStart = words.length ? words[words.length - 1].start : -Infinity;

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
        if (start <= lastStart + 0.02) continue;

        // No single spoken word lasts seconds; cap it so one bad timestamp
        // can't stretch across the rest of the track.
        const safeEnd = Math.min(end, start + 3);

        words.push({ word: text, start, end: safeEnd });
      }
    }

    words.sort((a, b) => a.start - b.start);

    // ---- Gap repair -------------------------------------------------------
    // Any stretch left with no words gets a second attempt on its own. The
    // audio there is usually perfectly ordinary speech that the first pass
    // happened to miss, and re-running it with a completely different framing
    // (the gap centred in its own window rather than straddling a boundary)
    // normally recovers it. This runs whatever caused the gap, so it doesn't
    // depend on correctly guessing why the first pass failed.
    const findGaps = () => {
      const out = [];
      for (let i = 1; i < words.length; i++) {
        const gap = words[i].start - words[i - 1].end;
        if (gap > 3) out.push([words[i - 1].end, words[i].start]);
      }
      if (words.length && words[0].start > 3) out.unshift([0, words[0].start]);
      const tail = totalSec - (words.length ? words[words.length - 1].end : 0);
      if (tail > 3) out.push([words.length ? words[words.length - 1].end : 0, totalSec]);
      return out;
    };

    const gaps = findGaps();
    if (gaps.length > 0) {
      post('progress', { message: `Re-checking ${gaps.length} unclear section(s)...`, pct: 88 });

      const recovered = [];
      for (const [gStart, gEnd] of gaps) {
        // Pad either side so words on the edges aren't clipped, and cap the
        // slice at Whisper's native length.
        let from = Math.max(0, gStart - 2);
        let to = Math.min(totalSec, gEnd + 2);

        while (from < to) {
          const sliceEnd = Math.min(to, from + WINDOW_S);
          const slice = audio.subarray(
            Math.floor(from * SAMPLE_RATE),
            Math.floor(sliceEnd * SAMPLE_RATE)
          );
          if (slice.length < SAMPLE_RATE * 0.3) break;

          const chunks = await transcribeWindow(model, slice);
          for (const c of chunks) {
            const ts = c?.timestamp;
            const text = String(c?.text ?? '').trim();
            if (!text) continue;
            const s0 = Array.isArray(ts) ? ts[0] : undefined;
            const e0 = Array.isArray(ts) ? ts[1] : undefined;
            if (typeof s0 !== 'number') continue;
            const st = s0 + from;
            const en = Math.min((typeof e0 === 'number' && e0 > s0 ? e0 : s0 + 0.15) + from, st + 3);
            // Only keep what actually falls inside the gap we're repairing
            if (st >= gStart - 0.3 && st <= gEnd + 0.3) recovered.push({ word: text, start: st, end: en });
          }

          if (sliceEnd >= to) break;
          from += WINDOW_S - OVERLAP_S;
        }
      }

      if (recovered.length > 0) {
        words.push(...recovered);
        words.sort((a, b) => a.start - b.start);
        // Drop anything that ended up on top of an existing word
        const merged = [];
        for (const w of words) {
          if (merged.length && w.start <= merged[merged.length - 1].start + 0.02) continue;
          merged.push(w);
        }
        words.length = 0;
        words.push(...merged);
      }
    }

    if (words.length === 0) {
      throw new Error('No speech was recognized in this audio.');
    }

    // Report any remaining holes so a transcription failure is visible rather
    // than silently turning into mis-cut lines.
    const holes = [];
    for (let i = 1; i < words.length; i++) {
      const gap = words[i].start - words[i - 1].end;
      if (gap > 2.5) holes.push(`${words[i - 1].end.toFixed(0)}s-${words[i].start.toFixed(0)}s`);
    }

    post('done', { words, holes });
  } catch (err) {
    post('error', { message: err?.message || String(err) });
  }
};
