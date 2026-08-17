// Forced alignment worker.
//
// Runs wav2vec2 CTC off the main thread and returns, for every word of the
// script, when it was spoken. The model is never asked what was said — only
// when — so the word order is fixed by the script and lines cannot drift or
// swap. This is the alignment half of WhisperX that the original port left
// behind; only its transcription half was brought over.
//
// The main thread decodes the audio (AudioContext isn't available in workers)
// and transfers the raw 16kHz mono samples here.

import {
  computeEmissions,
  flattenScript,
  alignScript,
  FPS
} from './ctcAlign.js';

let model = null;
let tokenizer = null;
/** Which device/dtype actually loaded, reported back so it lands in the report. */
let backendUsed = null;
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
        if (mod && typeof mod.AutoModelForCTC?.from_pretrained === 'function') return mod;
        errors.push(`${url}: no AutoModelForCTC export`);
      } catch (e) {
        errors.push(`${url}: ${e?.message || e}`);
      }
    }
    throw new Error(`Could not load speech library. Tried:\n${errors.join('\n')}`);
  })();
  libPromise.catch(() => { libPromise = null; });
  return libPromise;
}

function post(type, payload) {
  self.postMessage({ type, ...payload });
}

// Where the ONNX Runtime WASM files live. transformers.js points at the first
// of these by default, and if that single fetch fails the whole WASM backend is
// unavailable — which is exactly what happened in the field:
//   "no available backend found. ERR: [wasm] TypeError: Failed to fetch
//    dynamically imported module: .../ort-wasm-simd-threaded.jsep.mjs"
// so the runtime is probed here and the first CDN that actually answers is used.
const WASM_CDNS = [
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/',
  'https://unpkg.com/@huggingface/transformers@3.8.1/dist/',
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0-dev.20250409-89f8206ba4/dist/'
];

async function configureWasm(lib) {
  const w = lib.env?.backends?.onnx?.wasm;
  if (!w) return null;

  // Single-threaded on purpose. The threaded runtime needs SharedArrayBuffer,
  // which needs cross-origin isolation (COOP/COEP response headers) that this
  // app is not served with. Asking for threads without it fails at load.
  try { w.numThreads = 1; } catch (e) { /* older builds */ }
  try { w.proxy = false; } catch (e) { /* ignore */ }

  for (const base of WASM_CDNS) {
    try {
      const res = await fetch(base + 'ort-wasm-simd-threaded.jsep.mjs', { cache: 'force-cache' });
      if (res.ok) {
        w.wasmPaths = base;
        return base;
      }
    } catch (e) {
      /* try the next one */
    }
  }
  return null;
}

// Ordered by what is most likely to work AND most accurate, not by habit.
//
// Measured on a 686s narration against an fp32 reference implementation:
//
//   dtype   size    verbatim agreement   worst line boundary error
//   q4f16   ~66MB   93.97%               0.08s
//   fp16   ~189MB   94.63%               0.08s
//   q8      ~95MB   88.14%               0.16s
//
// q4f16 is both the smallest and the more accurate of the two small ones, so it
// leads. WebGPU is tried before WASM because it needs none of the WASM runtime
// files that failed to load in the field, and machines that can run the older
// Whisper path can generally run it.
const ATTEMPTS = [
  { device: 'webgpu', dtype: 'q4f16' },
  { device: 'wasm', dtype: 'q4f16' },
  { device: 'wasm', dtype: 'q8' }
];

async function getModel(modelId, dtype) {
  const lib = await loadTransformers();
  if (model && tokenizer) return { lib, model, tokenizer };

  post('progress', { message: 'Loading alignment model (first time only, cached after)...', pct: 4 });

  const wasmBase = await configureWasm(lib);
  if (!wasmBase) {
    console.log('[forcedAlign] no WASM runtime CDN answered; WebGPU is the only option');
  }

  // An explicit dtype from the caller overrides the ladder entirely.
  const attempts = dtype ? [{ device: undefined, dtype }] : ATTEMPTS;
  const failures = [];

  for (const attempt of attempts) {
    try {
      const opts = {
        dtype: attempt.dtype,
        progress_callback: (p) => {
          if (p?.status === 'progress' && typeof p.progress === 'number') {
            post('progress', {
              message: `Downloading alignment model... ${Math.round(p.progress)}%`,
              pct: 4 + p.progress * 0.26
            });
          }
        }
      };
      if (attempt.device) opts.device = attempt.device;

      model = await lib.AutoModelForCTC.from_pretrained(modelId, opts);
      tokenizer = await lib.AutoTokenizer.from_pretrained(modelId);
      backendUsed = `${attempt.device || 'default'}/${attempt.dtype}`;
      console.log(`[forcedAlign] using ${backendUsed}`);
      return { lib, model, tokenizer };
    } catch (err) {
      const detail = String(err?.message || err).slice(0, 200);
      failures.push(`${attempt.device || 'default'}/${attempt.dtype}: ${detail}`);
      console.log(`[forcedAlign] ${attempt.device || 'default'}/${attempt.dtype} unavailable — ${detail}`);
      model = null;
      tokenizer = null;
    }
  }

  // Every backend refused. Say which ones and why, so the next person does not
  // have to reconstruct it from a browser console.
  throw new Error(`No usable inference backend. Tried — ${failures.join(' | ')}`);
}

function readVocab(tokenizer) {
  const m = tokenizer.model;
  let map = null;
  if (m?.tokens_to_ids instanceof Map) map = Object.fromEntries(m.tokens_to_ids);
  else if (m?.tokens_to_ids) map = m.tokens_to_ids;
  else if (Array.isArray(m?.vocab)) map = Object.fromEntries(m.vocab.map((t, i) => [t, i]));
  if (!map) throw new Error('Could not read the alignment model vocabulary.');
  const idToToken = [];
  for (const [k, v] of Object.entries(map)) idToToken[v] = k;
  return { vocab: map, idToToken, blank: map['<pad>'] ?? 0 };
}

self.onmessage = async (event) => {
  const { audio, scriptLines, modelId, dtype } = event.data || {};

  try {
    const { lib } = await getModel(modelId || 'Xenova/wav2vec2-base-960h', dtype);
    const { vocab, idToToken, blank } = readVocab(tokenizer);

    if (vocab['|'] === undefined) {
      throw new Error('The alignment model has no word-separator token; it cannot be used for forced alignment.');
    }

    post('progress', { message: 'Analysing speech...', pct: 32 });

    const { logProbs, T, V } = await computeEmissions(model, audio, {
      Tensor: lib.Tensor,
      onProgress: (done, total) => {
        post('progress', {
          message: `Analysing speech... ${Math.round((done / total) * 100)}%`,
          pct: 32 + (done / total) * 50
        });
      }
    });

    post('progress', { message: 'Matching your script to the audio...', pct: 84 });

    const scriptWords = flattenScript(scriptLines);
    if (scriptWords.length === 0) throw new Error('The script has no usable words.');

    const { wordTimes, heard, mismatches, matched } = alignScript(
      logProbs, T, V, scriptWords, vocab, blank, idToToken,
      {
        onProgress: (f) => post('progress', {
          message: `Matching your script to the audio... ${Math.round(f * 100)}%`,
          pct: 84 + f * 14
        })
      }
    );

    // Send back plain arrays; the emission matrix stays here and is discarded.
    post('done', {
      words: scriptWords.map((w, i) => ({
        line: w.line,
        word: w.raw,
        start: wordTimes[i] ? wordTimes[i].start : null,
        end: wordTimes[i] ? wordTimes[i].end : null
      })),
      heard,
      mismatches,
      matched,
      scriptWordCount: scriptWords.length,
      backend: backendUsed,
      frames: T,
      fps: FPS
    });
  } catch (err) {
    post('error', { message: err?.message || String(err) });
  }
};
