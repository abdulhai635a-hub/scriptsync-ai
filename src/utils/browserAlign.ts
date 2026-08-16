// Browser-based forced alignment.
//
// Runs Whisper locally in the user's browser (via transformers.js + WASM/WebGPU)
// to get word-level timestamps, then aligns those spoken words to the script
// lines using a proper sequence-alignment algorithm.
//
// Why this exists: free server tiers can't transcribe long audio (0.1 CPU /
// 512MB RAM), and the previous naive "give line N the next N words" matching
// drifted out of sync whenever the narration didn't match the script word for
// word. Both problems are solved here.

export interface WordStamp {
  word: string;
  start: number;
  end: number;
}

export interface LineStamp {
  num: number;
  text: string;
  startTime: number;
  endTime: number;
  duration: number;
}

type ProgressFn = (msg: string, pct?: number) => void;

// ---------------------------------------------------------------------------
// 1. Audio preparation: Whisper needs 16kHz mono Float32
// ---------------------------------------------------------------------------

export async function audioToFloat32Mono16k(file: File | Blob): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();

  // Decode at native rate first
  const decodeCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  await decodeCtx.close().catch(() => {});

  // Downmix to mono
  const length = decoded.length;
  const channels = decoded.numberOfChannels;
  const mono = new Float32Array(length);
  for (let ch = 0; ch < channels; ch++) {
    const data = decoded.getChannelData(ch);
    for (let i = 0; i < length; i++) mono[i] += data[i] / channels;
  }

  // Resample to 16kHz using an OfflineAudioContext
  const targetRate = 16000;
  if (decoded.sampleRate === targetRate) return mono;

  const targetLength = Math.ceil((length * targetRate) / decoded.sampleRate);
  const offline = new OfflineAudioContext(1, targetLength, targetRate);
  const monoBuffer = offline.createBuffer(1, length, decoded.sampleRate);
  monoBuffer.copyToChannel(mono, 0);

  const source = offline.createBufferSource();
  source.buffer = monoBuffer;
  source.connect(offline.destination);
  source.start();

  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

// ---------------------------------------------------------------------------
// 2. Transcription in the browser (model is cached by the browser after first run)
// ---------------------------------------------------------------------------

let _transcriber: any = null;
let _libPromise: Promise<any> | null = null;

const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

// Loaded from a CDN at runtime rather than bundled: the npm package pulls in a
// Node-only ONNX runtime that isn't needed in the browser and bloats the build.
function loadTransformers(): Promise<any> {
  if (!_libPromise) {
    _libPromise = import(/* @vite-ignore */ TRANSFORMERS_CDN);
  }
  return _libPromise;
}

async function getTranscriber(modelId: string, onProgress?: ProgressFn) {
  if (_transcriber) return _transcriber;

  const { pipeline } = await loadTransformers();

  if (onProgress) onProgress('Loading speech model (first time only, cached after)...', 5);

  _transcriber = await pipeline('automatic-speech-recognition', modelId, {
    dtype: 'q8',
    progress_callback: (p: any) => {
      if (onProgress && p?.status === 'progress' && typeof p.progress === 'number') {
        onProgress(`Downloading speech model... ${Math.round(p.progress)}%`, 5 + (p.progress * 0.25));
      }
    }
  } as any);

  return _transcriber;
}

export async function transcribeInBrowser(
  file: File | Blob,
  onProgress?: ProgressFn,
  modelId = 'onnx-community/whisper-base'
): Promise<WordStamp[]> {
  if (onProgress) onProgress('Preparing audio...', 2);
  const audio = await audioToFloat32Mono16k(file);

  const transcriber = await getTranscriber(modelId, onProgress);

  if (onProgress) onProgress('Transcribing audio in your browser...', 32);

  const output: any = await transcriber(audio, {
    return_timestamps: 'word',
    chunk_length_s: 30,
    stride_length_s: 5
  });

  const chunks: any[] = output?.chunks || [];
  const words: WordStamp[] = [];

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

  if (onProgress) onProgress('Matching transcript to your script...', 88);
  return words;
}

// ---------------------------------------------------------------------------
// 3. Sequence alignment between script words and spoken words
//
// This is the part that makes lines cut in the right place. Rather than
// assuming line N owns the next N spoken words (which drifts permanently the
// moment the speaker paraphrases, skips a filler word, or ad-libs), we run a
// Needleman-Wunsch alignment so every script word is matched to the spoken
// word it actually corresponds to, and insertions/deletions are absorbed
// locally instead of shifting everything after them.
// ---------------------------------------------------------------------------

function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
    .trim();
}

interface FlatScriptWord {
  lineIndex: number;
  norm: string;
}

/** Align script words to ASR words. Returns, for each script word, the index of the matched ASR word (or -1). */
function alignSequences(scriptWords: string[], asrWords: string[]): number[] {
  const n = scriptWords.length;
  const m = asrWords.length;

  const MATCH = 2;
  const MISMATCH = -1;
  const GAP = -1;

  // Score matrix as a flat typed array for memory efficiency
  const width = m + 1;
  const score = new Int32Array((n + 1) * width);
  const trace = new Uint8Array((n + 1) * width); // 0=diag, 1=up(skip script), 2=left(skip asr)

  for (let i = 1; i <= n; i++) {
    score[i * width] = i * GAP;
    trace[i * width] = 1;
  }
  for (let j = 1; j <= m; j++) {
    score[j] = j * GAP;
    trace[j] = 2;
  }

  for (let i = 1; i <= n; i++) {
    const sw = scriptWords[i - 1];
    const rowOff = i * width;
    const prevOff = (i - 1) * width;
    for (let j = 1; j <= m; j++) {
      const isMatch = sw === asrWords[j - 1] && sw.length > 0;
      const diag = score[prevOff + j - 1] + (isMatch ? MATCH : MISMATCH);
      const up = score[prevOff + j] + GAP;
      const left = score[rowOff + j - 1] + GAP;

      let best = diag;
      let dir = 0;
      if (up > best) {
        best = up;
        dir = 1;
      }
      if (left > best) {
        best = left;
        dir = 2;
      }
      score[rowOff + j] = best;
      trace[rowOff + j] = dir;
    }
  }

  // Traceback
  const mapping = new Array<number>(n).fill(-1);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const dir = trace[i * width + j];
    if (dir === 0) {
      mapping[i - 1] = j - 1;
      i--;
      j--;
    } else if (dir === 1) {
      i--;
    } else {
      j--;
    }
  }
  return mapping;
}

/**
 * Turn word-level timestamps into per-line timestamps.
 * Guarantees: exactly one entry per script line, non-overlapping, in order,
 * covering the full audio duration.
 */
export function alignWordsToLines(
  words: WordStamp[],
  scriptLines: Array<{ num: number; text: string }>,
  totalDuration: number
): LineStamp[] {
  const lineCount = scriptLines.length;

  // Flatten script into words tagged with their line
  const flat: FlatScriptWord[] = [];
  scriptLines.forEach((line, lineIndex) => {
    const parts = String(line.text || '')
      .split(/\s+/)
      .map(normalizeWord)
      .filter((w) => w.length > 0);
    // A line with no usable words still needs a placeholder so it gets a slot
    if (parts.length === 0) {
      flat.push({ lineIndex, norm: '' });
    } else {
      parts.forEach((norm) => flat.push({ lineIndex, norm }));
    }
  });

  const asrNorm = words.map((w) => normalizeWord(w.word));

  // Guard: nothing recognized -> caller should fall back
  if (words.length === 0 || flat.length === 0) {
    return proportionalFallback(scriptLines, totalDuration);
  }

  const mapping = alignSequences(
    flat.map((f) => f.norm),
    asrNorm
  );

  // Collect matched ASR indices per line
  const perLine: Array<number[]> = Array.from({ length: lineCount }, () => []);
  for (let k = 0; k < flat.length; k++) {
    const asrIdx = mapping[k];
    if (asrIdx >= 0) perLine[flat[k].lineIndex].push(asrIdx);
  }

  // Raw start/end per line from matched words
  const rawStart = new Array<number | null>(lineCount).fill(null);
  const rawEnd = new Array<number | null>(lineCount).fill(null);
  for (let i = 0; i < lineCount; i++) {
    const idxs = perLine[i];
    if (idxs.length > 0) {
      const first = Math.min(...idxs);
      const last = Math.max(...idxs);
      rawStart[i] = words[first].start;
      rawEnd[i] = words[last].end;
    }
  }

  // Interpolate lines that matched nothing, using the nearest anchored lines
  for (let i = 0; i < lineCount; i++) {
    if (rawStart[i] !== null) continue;

    let prev = i - 1;
    while (prev >= 0 && rawEnd[prev] === null) prev--;
    let next = i + 1;
    while (next < lineCount && rawStart[next] === null) next++;

    const from = prev >= 0 ? (rawEnd[prev] as number) : 0;
    const to = next < lineCount ? (rawStart[next] as number) : totalDuration;
    const gapCount = next - prev - 1;
    const slot = gapCount > 0 ? (to - from) / gapCount : 0;
    const offset = i - prev - 1;

    rawStart[i] = from + slot * offset;
    rawEnd[i] = from + slot * (offset + 1);
  }

  // Enforce monotonic, non-overlapping, in-range boundaries
  const result: LineStamp[] = [];
  let cursor = 0;
  for (let i = 0; i < lineCount; i++) {
    const isLast = i === lineCount - 1;
    let start = Math.max(cursor, Math.min(totalDuration, rawStart[i] as number));
    let end = Math.max(start + 0.15, Math.min(totalDuration, rawEnd[i] as number));

    // Reserve a sliver for every remaining line so later lines aren't crushed
    const remaining = lineCount - 1 - i;
    const latestAllowedEnd = totalDuration - remaining * 0.15;
    if (!isLast && end > latestAllowedEnd) end = Math.max(start + 0.15, latestAllowedEnd);
    if (isLast) end = totalDuration;
    if (start >= end) start = Math.max(0, end - 0.15);

    result.push({
      num: scriptLines[i].num ?? i + 1,
      text: scriptLines[i].text ?? `Line ${i + 1}`,
      startTime: Number(start.toFixed(2)),
      endTime: Number(end.toFixed(2)),
      duration: Number((end - start).toFixed(2))
    });
    cursor = end;
  }

  return result;
}

function proportionalFallback(
  scriptLines: Array<{ num: number; text: string }>,
  totalDuration: number
): LineStamp[] {
  const weights = scriptLines.map((l) => {
    const words = String(l.text || '').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, words * 4 + String(l.text || '').length);
  });
  const total = weights.reduce((a, b) => a + b, 0) || 1;

  let cursor = 0;
  return scriptLines.map((l, idx) => {
    const isLast = idx === scriptLines.length - 1;
    const start = cursor;
    const end = isLast ? totalDuration : Math.min(totalDuration, start + (totalDuration * weights[idx]) / total);
    cursor = end;
    return {
      num: l.num ?? idx + 1,
      text: l.text ?? `Line ${idx + 1}`,
      startTime: Number(start.toFixed(2)),
      endTime: Number(end.toFixed(2)),
      duration: Number((end - start).toFixed(2))
    };
  });
}

// ---------------------------------------------------------------------------
// 4. Public entry point
// ---------------------------------------------------------------------------

export async function alignInBrowser(
  file: File | Blob,
  scriptLines: Array<{ num: number; text: string }>,
  totalDuration: number,
  onProgress?: ProgressFn
): Promise<{ timestamps: LineStamp[]; method: string; warnings: string[] }> {
  const warnings: string[] = [];
  try {
    const words = await transcribeInBrowser(file, onProgress);

    if (words.length === 0) {
      warnings.push('No speech was recognized in the audio; used proportional spacing.');
      return {
        timestamps: proportionalFallback(scriptLines, totalDuration),
        method: 'proportional-acoustic',
        warnings
      };
    }

    const timestamps = alignWordsToLines(words, scriptLines, totalDuration);
    if (onProgress) onProgress('Alignment complete.', 100);

    return {
      timestamps,
      method: 'browser-whisper-aligned',
      warnings
    };
  } catch (err: any) {
    console.log('Browser alignment failed:', err?.message || err);
    warnings.push('Browser speech alignment was unavailable; used proportional spacing.');
    return {
      timestamps: proportionalFallback(scriptLines, totalDuration),
      method: 'proportional-acoustic',
      warnings
    };
  }
}
