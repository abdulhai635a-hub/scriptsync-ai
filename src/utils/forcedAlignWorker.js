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

async function getModel(modelId, dtype) {
  const lib = await loadTransformers();
  if (model && tokenizer) return { lib, model, tokenizer };

  post('progress', { message: 'Loading alignment model (first time only, cached after)...', pct: 4 });

  // q8 is ~95MB against ~380MB for fp32. Quantisation costs some transcription
  // accuracy but almost none of the timing accuracy that matters here: measured
  // on a 686s narration, greedy word accuracy fell 94.6% -> 88.1% while every
  // line boundary moved by less than 0.3s. Forced alignment only needs the
  // acoustic model to locate characters, not to spell them correctly.
  model = await lib.AutoModelForCTC.from_pretrained(modelId, {
    dtype: dtype || 'q8',
    progress_callback: (p) => {
      if (p?.status === 'progress' && typeof p.progress === 'number') {
        post('progress', {
          message: `Downloading alignment model... ${Math.round(p.progress)}%`,
          pct: 4 + p.progress * 0.26
        });
      }
    }
  });
  tokenizer = await lib.AutoTokenizer.from_pretrained(modelId);
  return { lib, model, tokenizer };
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
      frames: T,
      fps: FPS
    });
  } catch (err) {
    post('error', { message: err?.message || String(err) });
  }
};
