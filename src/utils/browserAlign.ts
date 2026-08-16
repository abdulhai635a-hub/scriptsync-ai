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
// 2. Transcription in a Web Worker (keeps the page responsive)
//
// Whisper inference takes minutes on long audio. Running it on the main thread
// freezes the UI and trips the browser's "Page Unresponsive" dialog, so all of
// it happens in a worker. Audio decoding stays on the main thread because
// AudioContext isn't available inside workers.
// ---------------------------------------------------------------------------

export async function transcribeInBrowser(
  file: File | Blob,
  onProgress?: ProgressFn,
  // Must be a "_timestamped" export: only those ship the alignment_heads
  // config that word-level timestamps depend on. The plain whisper exports
  // silently return no word timings.
  modelId = 'onnx-community/whisper-base_timestamped'
): Promise<WordStamp[]> {
  if (onProgress) onProgress('Preparing audio...', 2);
  const audio = await audioToFloat32Mono16k(file);

  const words = await new Promise<WordStamp[]>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./whisperWorker.js', import.meta.url), { type: 'module' });
    } catch (e: any) {
      reject(new Error(`Could not start background worker: ${e?.message || e}`));
      return;
    }

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      fn();
    };

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data || {};
      if (data.type === 'progress') {
        if (onProgress) onProgress(data.message, data.pct >= 0 ? data.pct : undefined);
      } else if (data.type === 'done') {
        finish(() => resolve(data.words || []));
      } else if (data.type === 'error') {
        finish(() => reject(new Error(data.message || 'Transcription failed')));
      }
    };

    worker.onerror = (e: ErrorEvent) => {
      finish(() => reject(new Error(`Worker error: ${e.message || 'unknown'}`)));
    };

    // Transfer the sample buffer rather than copying it (audio can be large)
    worker.postMessage({ audio, modelId }, [audio.buffer]);
  });

  if (onProgress) {
    const lastEnd = words.length > 0 ? words[words.length - 1].end : 0;
    const firstStart = words.length > 0 ? words[0].start : 0;
    onProgress(
      `Recognized ${words.length} words spanning ${firstStart.toFixed(1)}s - ${lastEnd.toFixed(1)}s. Matching to your script...`,
      88
    );
  }
  console.log(
    '[browserAlign] words:', words.length,
    '| span:', words.length ? `${words[0].start}s - ${words[words.length - 1].end}s` : 'none'
  );
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

/**
 * Cheap similarity check used inside the DP inner loop.
 * Exact match scores highest; near-misses (shared prefix and similar length)
 * get partial credit so that transcription variants — "recieve"/"receive",
 * "goin"/"going", singular/plural — still anchor a line instead of dropping
 * out and leaving a gap that has to be guessed.
 * Must stay O(1): this runs millions of times.
 */
function wordScore(a: string, b: string): number {
  if (a === b && a.length > 0) return 2;
  if (a.length === 0 || b.length === 0) return -1;

  // Shared prefix of 3+ characters with comparable length
  const minLen = Math.min(a.length, b.length);
  if (minLen >= 3 && Math.abs(a.length - b.length) <= 3) {
    if (a[0] === b[0] && a[1] === b[1] && a[2] === b[2]) return 1;
  }
  // Short words: require first 2 chars
  if (minLen >= 2 && a.length <= 4 && b.length <= 4 && a[0] === b[0] && a[1] === b[1]) return 1;

  return -1;
}

/** Align script words to ASR words. Returns, for each script word, the index of the matched ASR word (or -1). */
function alignSequences(scriptWords: string[], asrWords: string[]): number[] {
  const n = scriptWords.length;
  const m = asrWords.length;

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
      const diag = score[prevOff + j - 1] + wordScore(sw, asrWords[j - 1]);
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

/** Lines from the most recent alignWordsToLines call that had no real word match. */
export let lastUnanchoredLines: number[] = [];

/** What the transcript actually contained around the unmatched lines, for diagnosis. */
export let lastUnanchoredReport: string = '';

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

  // Record which lines had no real word match, so callers can report them
  const unanchored: number[] = [];
  for (let i = 0; i < lineCount; i++) {
    if (rawStart[i] === null) unanchored.push(scriptLines[i].num ?? i + 1);
  }
  lastUnanchoredLines = unanchored;

  // For the unmatched run, capture what the transcript actually says in that
  // stretch of audio next to what the script says. If these turn out to be
  // completely different content, no aligner can match them and the script
  // itself is the thing to look at.
  lastUnanchoredReport = '';
  if (unanchored.length > 0) {
    const firstIdx = scriptLines.findIndex((l, i) => rawStart[i] === null);
    let lastIdx = firstIdx;
    for (let i = firstIdx; i < lineCount; i++) if (rawStart[i] === null) lastIdx = i;

    // Time window: between the last anchored line before, and first anchored after
    let prev = firstIdx - 1;
    while (prev >= 0 && rawEnd[prev] === null) prev--;
    let next = lastIdx + 1;
    while (next < lineCount && rawStart[next] === null) next++;

    const from = prev >= 0 ? (rawEnd[prev] as number) : 0;
    const to = next < lineCount ? (rawStart[next] as number) : totalDuration;

    const heard = words
      .filter((w) => w.start >= from - 0.5 && w.end <= to + 0.5)
      .map((w) => w.word)
      .join(' ')
      .trim();

    const scriptSaid = scriptLines
      .slice(firstIdx, lastIdx + 1)
      .map((l) => l.text)
      .join(' ')
      .trim();

    lastUnanchoredReport =
      `Window ${from.toFixed(1)}s-${to.toFixed(1)}s | ` +
      `SCRIPT SAYS: "${scriptSaid.slice(0, 300)}" | ` +
      `AUDIO HEARD: "${heard.slice(0, 300) || '(nothing recognized)'}"`;
    console.log('[browserAlign] unmatched region ->', lastUnanchoredReport);
  }

  // Interpolate lines that matched nothing, using the nearest anchored lines.
  // The gap is shared out in proportion to how much each line actually says,
  // rather than evenly: a 20-word line and a 3-word line should not get the
  // same slice of time.
  const lineWeight = (idx: number) => {
    const t = String(scriptLines[idx].text || '').trim();
    const wordCount = t ? t.split(/\s+/).length : 1;
    return Math.max(1, wordCount);
  };

  for (let i = 0; i < lineCount; i++) {
    if (rawStart[i] !== null) continue;

    let prev = i - 1;
    while (prev >= 0 && rawEnd[prev] === null) prev--;
    let next = i + 1;
    while (next < lineCount && rawStart[next] === null) next++;

    const from = prev >= 0 ? (rawEnd[prev] as number) : 0;
    const to = next < lineCount ? (rawStart[next] as number) : totalDuration;

    // Every line in this unanchored run, so we can weight across the whole run
    const runStart = prev + 1;
    const runEnd = next - 1;
    let totalWeight = 0;
    for (let k = runStart; k <= runEnd; k++) totalWeight += lineWeight(k);
    if (totalWeight <= 0) totalWeight = 1;

    let before = 0;
    for (let k = runStart; k < i; k++) before += lineWeight(k);

    const span = Math.max(0, to - from);
    rawStart[i] = from + (span * before) / totalWeight;
    rawEnd[i] = from + (span * (before + lineWeight(i))) / totalWeight;
  }

  // Enforce monotonic, non-overlapping, in-range boundaries.
  //
  // The segments must also be CONTIGUOUS: the app slices audio from startTime
  // to endTime and lays the slices end to end, so any audio falling between
  // one line's end and the next line's start is thrown away. That is the
  // natural pause between sentences — losing it makes every line run straight
  // into the next. So each boundary is placed inside the pause rather than at
  // the last word: the silence stays with the line it follows, and the next
  // line gets a small lead-in so its first word isn't clipped.
  const LEAD_IN = 0.15;

  const bounds: number[] = new Array(lineCount + 1);
  bounds[0] = 0;
  bounds[lineCount] = totalDuration;

  for (let i = 0; i < lineCount - 1; i++) {
    const thisEnd = rawEnd[i] as number;
    const nextStart = rawStart[i + 1] as number;
    const gap = nextStart - thisEnd;

    let boundary: number;
    if (gap > 0) {
      // Keep most of the pause with the current line, leave a lead-in for the next
      boundary = nextStart - Math.min(LEAD_IN, gap / 2);
    } else {
      // Words overlap or touch: fall back to the midpoint
      boundary = Math.max(thisEnd, nextStart);
    }
    bounds[i + 1] = boundary;
  }

  // Make boundaries strictly increasing and inside the audio
  for (let i = 1; i <= lineCount; i++) {
    const minAllowed = bounds[i - 1] + 0.15;
    const maxAllowed = totalDuration - (lineCount - i) * 0.15;
    bounds[i] = Math.min(Math.max(bounds[i], minAllowed), Math.max(minAllowed, maxAllowed));
  }
  bounds[lineCount] = totalDuration;

  const result: LineStamp[] = [];
  for (let i = 0; i < lineCount; i++) {
    const start = bounds[i];
    const end = bounds[i + 1];
    result.push({
      num: scriptLines[i].num ?? i + 1,
      text: scriptLines[i].text ?? `Line ${i + 1}`,
      startTime: Number(start.toFixed(2)),
      endTime: Number(end.toFixed(2)),
      duration: Number((end - start).toFixed(2))
    });
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

    const coveredTo = words[words.length - 1].end;
    const coverage = totalDuration > 0 ? coveredTo / totalDuration : 1;

    if (coverage < 0.85) {
      // The transcript stopped early, so any line past that point is guessed
      // rather than aligned. Say so instead of quietly returning bad cuts.
      warnings.push(
        `Speech was only recognized up to ${coveredTo.toFixed(0)}s of ${totalDuration.toFixed(0)}s ` +
          `(${Math.round(coverage * 100)}%). Lines after that point are estimated, not aligned.`
      );
      if (onProgress) onProgress(warnings[warnings.length - 1]);
    } else if (onProgress) {
      const weak = lastUnanchoredLines;
      if (weak.length > 0) {
        const shown = weak.slice(0, 12).join(', ');
        onProgress(
          `Alignment complete: ${words.length} words matched across ${coveredTo.toFixed(0)}s. ` +
            `Line${weak.length > 1 ? 's' : ''} ${shown}${weak.length > 12 ? '...' : ''} had no clear word match and were estimated.`,
          100
        );
        warnings.push(`Estimated (not word-matched) lines: ${shown}${weak.length > 12 ? '...' : ''}`);
        if (lastUnanchoredReport) warnings.push(lastUnanchoredReport);
      } else {
        onProgress(
          `Alignment complete: ${words.length} words matched across ${coveredTo.toFixed(0)}s of audio.`,
          100
        );
      }
    }

    return {
      timestamps,
      method: 'browser-whisper-aligned',
      warnings
    };
  } catch (err: any) {
    const detail = err?.message || String(err);
    console.log('Browser alignment failed:', detail);
    warnings.push(`Browser speech alignment failed: ${detail}`);
    return {
      timestamps: proportionalFallback(scriptLines, totalDuration),
      method: 'proportional-acoustic',
      warnings
    };
  }
}
