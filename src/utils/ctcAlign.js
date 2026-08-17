// Forced alignment of a known script to audio, using wav2vec2 CTC emissions.
//
// The difference from transcribe-then-match: the model is never asked WHAT was
// said, only WHEN each script word was said. The word order is fixed by the
// script, so lines cannot drift, swap, or be shifted by a mis-hearing. A line
// split mid-sentence with no pause at the join aligns exactly as well as one
// that ends on a full stop, which is the case transcribe-then-match cannot do.
//
// No DOM or worker APIs are used here so this file can be unit-tested in Node
// and imported by the worker unchanged.

export const SR = 16000;
export const STRIDE = 320;          // wav2vec2 samples per output frame
export const FPS = SR / STRIDE;     // 50 frames/sec

// ---------------------------------------------------------------------------
// Emissions
// ---------------------------------------------------------------------------

/**
 * Run the CTC model over long audio in overlapping windows and stitch the
 * per-frame log-probabilities into one matrix.
 *
 * Window and hop are exact multiples of STRIDE so a window-local frame index
 * maps onto a global frame index without rounding drift — the same class of
 * bug that previously opened holes at window boundaries. Only the centre of
 * each window is kept; the edges, where the receptive field is truncated, are
 * discarded in favour of the neighbouring window's centre.
 */
export async function computeEmissions(model, audio, opts = {}) {
  const { chunkSec = 30, overlapSec = 5, onProgress, Tensor } = opts;

  const chunk = Math.floor((chunkSec * SR) / STRIDE) * STRIDE;
  const ov = Math.floor((overlapSec * SR) / STRIDE) * STRIDE;
  const hop = chunk - ov;
  const halfOvFrames = Math.floor(ov / STRIDE / 2);

  const totalFrames = Math.floor(audio.length / STRIDE);
  let V = 0;
  let out = null;

  const starts = [];
  for (let s = 0; s < Math.max(1, audio.length - ov); s += hop) starts.push(s);

  for (let i = 0; i < starts.length; i++) {
    const s0 = starts[i];
    const seg = audio.subarray(s0, Math.min(audio.length, s0 + chunk));
    if (seg.length < STRIDE * 2) continue;

    // wav2vec2-base was trained on zero-mean unit-variance input
    const norm = normalise(seg);

    const input = new Tensor('float32', norm, [1, norm.length]);
    const { logits } = await model({ input_values: input });

    const [, lt, lv] = logits.dims;
    const data = logits.data;
    if (!out) {
      V = lv;
      out = new Float32Array(totalFrames * V).fill(NaN);
    }

    // log_softmax per frame
    const lp = new Float32Array(lt * V);
    for (let t = 0; t < lt; t++) {
      const off = t * V;
      let max = -Infinity;
      for (let v = 0; v < V; v++) if (data[off + v] > max) max = data[off + v];
      let sum = 0;
      for (let v = 0; v < V; v++) sum += Math.exp(data[off + v] - max);
      const lse = max + Math.log(sum);
      for (let v = 0; v < V; v++) lp[off + v] = data[off + v] - lse;
    }

    const f0 = s0 / STRIDE;
    const lo = i === 0 ? 0 : halfOvFrames;
    const hi = i === starts.length - 1 ? lt : lt - halfOvFrames;
    for (let t = lo; t < hi; t++) {
      const g = f0 + t;
      if (g < 0 || g >= totalFrames) continue;
      out.set(lp.subarray(t * V, t * V + V), g * V);
    }

    if (onProgress) onProgress(s0 / SR, audio.length / SR);
  }

  if (!out) throw new Error('No emissions were produced from the audio.');

  // Any frame never covered (only possible at the very tail) gets a flat prior
  const flat = Math.log(1 / V);
  for (let t = 0; t < totalFrames; t++) {
    if (Number.isNaN(out[t * V])) {
      for (let v = 0; v < V; v++) out[t * V + v] = flat;
    }
  }

  return { logProbs: out, T: totalFrames, V };
}

function normalise(seg) {
  const n = seg.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += seg[i];
  mean /= n;
  let varr = 0;
  for (let i = 0; i < n; i++) {
    const d = seg[i] - mean;
    varr += d * d;
  }
  const sd = Math.sqrt(varr / n) + 1e-7;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (seg[i] - mean) / sd;
  return out;
}

// ---------------------------------------------------------------------------
// Greedy decode — used to find anchors and to report what was actually said
// ---------------------------------------------------------------------------

export function greedyDecode(logProbs, T, V, blank, idToToken) {
  const words = [];
  let cur = '';
  let curStart = 0;
  let prev = -1;

  for (let t = 0; t < T; t++) {
    const off = t * V;
    let best = 0;
    let bestVal = -Infinity;
    for (let v = 0; v < V; v++) {
      if (logProbs[off + v] > bestVal) {
        bestVal = logProbs[off + v];
        best = v;
      }
    }
    if (best !== prev && best !== blank) {
      const ch = idToToken[best] || '';
      if (ch === '|') {
        if (cur) {
          words.push({ word: cur, start: curStart / FPS, end: t / FPS });
          cur = '';
        }
      } else if (ch.length === 1 && ch !== '<' && ch !== '>') {
        if (!cur) curStart = t;
        cur += ch;
      }
    }
    prev = best;
  }
  if (cur) words.push({ word: cur, start: curStart / FPS, end: T / FPS });
  return words;
}

// ---------------------------------------------------------------------------
// Script preparation
// ---------------------------------------------------------------------------

const DIGITS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];

/** Uppercase A-Z and apostrophe only — the wav2vec2-base-960h vocabulary. */
export function normaliseWord(w) {
  let s = String(w || '')
    .toUpperCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^A-Z0-9']/g, '');
  let out = '';
  for (const c of s) out += c >= '0' && c <= '9' ? DIGITS[+c] : c;
  return out.replace(/[^A-Z']/g, '');
}

/** Flatten script lines into normalised words tagged with their line index. */
export function flattenScript(scriptLines) {
  const words = [];
  scriptLines.forEach((line, li) => {
    for (const raw of String(line.text || '').split(/\s+/)) {
      const n = normaliseWord(raw);
      if (n) words.push({ line: li, raw, norm: n });
    }
  });
  return words;
}

// ---------------------------------------------------------------------------
// Anchoring
//
// Aligning 685s of audio against 1500 words in one Viterbi pass would need a
// backpointer table of hundreds of megabytes, which no browser tab should be
// asked for. Instead the greedy transcript is matched against the script to
// find stretches both agree on, and forced alignment then runs between those
// anchors, where the tables are small. The anchor diff is also exactly what
// reveals a script that is missing words the narrator actually said.
// ---------------------------------------------------------------------------

/** Needleman-Wunsch over word sequences. Returns script index -> heard index (or -1). */
export function alignWordSequences(a, b) {
  const n = a.length;
  const m = b.length;
  const width = m + 1;
  const GAP = -1;

  const score = new Int32Array((n + 1) * width);
  const trace = new Uint8Array((n + 1) * width);

  for (let i = 1; i <= n; i++) {
    score[i * width] = i * GAP;
    trace[i * width] = 1;
  }
  for (let j = 1; j <= m; j++) {
    score[j] = j * GAP;
    trace[j] = 2;
  }

  for (let i = 1; i <= n; i++) {
    const aw = a[i - 1];
    const row = i * width;
    const prow = (i - 1) * width;
    for (let j = 1; j <= m; j++) {
      const diag = score[prow + j - 1] + wordScore(aw, b[j - 1]);
      const up = score[prow + j] + GAP;
      const left = score[row + j - 1] + GAP;
      let best = diag;
      let dir = 0;
      if (up > best) { best = up; dir = 1; }
      if (left > best) { best = left; dir = 2; }
      score[row + j] = best;
      trace[row + j] = dir;
    }
  }

  const map = new Int32Array(n).fill(-1);
  const exact = new Uint8Array(n);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const dir = trace[i * width + j];
    if (dir === 0) {
      map[i - 1] = j - 1;
      exact[i - 1] = a[i - 1] === b[j - 1] ? 1 : 0;
      i--; j--;
    } else if (dir === 1) i--;
    else j--;
  }
  return { map, exact };
}

function wordScore(a, b) {
  if (a === b && a.length > 0) return 2;
  if (!a.length || !b.length) return -1;
  const minLen = Math.min(a.length, b.length);
  if (minLen >= 3 && Math.abs(a.length - b.length) <= 3 &&
      a[0] === b[0] && a[1] === b[1] && a[2] === b[2]) return 1;
  if (minLen >= 2 && a.length <= 4 && b.length <= 4 && a[0] === b[0] && a[1] === b[1]) return 1;
  return -1;
}

// ---------------------------------------------------------------------------
// CTC forced alignment (Viterbi) over one segment
// ---------------------------------------------------------------------------

/**
 * Align `tokens` (vocabulary ids for the segment's characters) to frames
 * [tFrom, tTo) of the emission matrix.
 *
 * Returns start/end frame per token. States are the blank-interleaved target
 * b t0 b t1 b ... ; a skip transition is legal only into a non-blank state
 * whose token differs from the previous one, which is what stops repeated
 * letters from collapsing.
 */
export function forcedAlignSegment(logProbs, V, tFrom, tTo, tokens, blank) {
  const T = tTo - tFrom;
  const L = tokens.length;
  if (T <= 0 || L === 0) return null;
  const S = 2 * L + 1;
  if (T < L) return null;   // physically impossible to fit — caller falls back

  const stateTok = new Int32Array(S).fill(blank);
  for (let k = 0; k < L; k++) stateTok[2 * k + 1] = tokens[k];

  const canSkip = new Uint8Array(S);
  for (let k = 1; k < L; k++) canSkip[2 * k + 1] = tokens[k] !== tokens[k - 1] ? 1 : 0;

  const NEG = -1e30;
  let prev = new Float32Array(S).fill(NEG);
  let cur = new Float32Array(S);
  const bp = new Uint8Array(T * S);

  prev[0] = logProbs[tFrom * V + blank];
  if (S > 1) prev[1] = logProbs[tFrom * V + stateTok[1]];

  for (let t = 1; t < T; t++) {
    const eOff = (tFrom + t) * V;
    const bOff = t * S;
    for (let s = 0; s < S; s++) {
      let best = prev[s];
      let dir = 0;
      if (s >= 1 && prev[s - 1] > best) { best = prev[s - 1]; dir = 1; }
      if (s >= 2 && canSkip[s] && prev[s - 2] > best) { best = prev[s - 2]; dir = 2; }
      cur[s] = best + logProbs[eOff + stateTok[s]];
      bp[bOff + s] = dir;
    }
    const tmp = prev; prev = cur; cur = tmp;
  }

  let s = prev[S - 1] >= prev[S - 2] ? S - 1 : S - 2;
  const spans = new Int32Array(L * 2).fill(-1);
  for (let t = T - 1; t >= 0; t--) {
    if (s % 2 === 1) {
      const k = (s - 1) / 2;
      if (spans[k * 2 + 1] < 0) spans[k * 2 + 1] = tFrom + t + 1;
      spans[k * 2] = tFrom + t;
    }
    s -= bp[t * S + s];
  }
  return spans;
}

// ---------------------------------------------------------------------------
// Whole-script alignment
// ---------------------------------------------------------------------------

/** Budget for one Viterbi table, in bytes. Segments larger than this get split. */
const MAX_SEGMENT_CELLS = 48 * 1024 * 1024;

/**
 * Align every script word to the audio.
 *
 * Returns per-word times, plus `mismatches`: places where the audio and the
 * script genuinely disagree. Those are not alignment errors and cannot be
 * fixed by moving a boundary — they mean the script does not describe the
 * recording, and the caller should say so rather than absorbing the surplus
 * into a neighbouring line.
 */
export function alignScript(logProbs, T, V, scriptWords, vocab, blank, idToToken, opts = {}) {
  const { minAnchorRun = 4, onProgress } = opts;

  const heard = greedyDecode(logProbs, T, V, blank, idToToken);
  const heardNorm = heard.map((h) => h.word);
  const scriptNorm = scriptWords.map((w) => w.norm);

  const { map, exact } = alignWordSequences(scriptNorm, heardNorm);

  // ---- anchors: runs of consecutive exact matches, in order
  const anchors = [];
  let run = [];
  const flushRun = () => {
    if (run.length >= minAnchorRun) {
      // use the middle of the run: its edges are where a disagreement is likeliest
      const mid = run[run.length >> 1];
      anchors.push({ si: mid, hi: map[mid] });
    }
    run = [];
  };
  let lastHi = -1;
  for (let i = 0; i < scriptNorm.length; i++) {
    if (exact[i] && map[i] > lastHi) {
      run.push(i);
      lastHi = map[i];
    } else {
      flushRun();
    }
  }
  flushRun();

  // ---- disagreements, found before alignment because they change it
  const mismatches = findMismatches(scriptWords, scriptNorm, heard, heardNorm, map);

  // ---- cut points: where a segment must start and end
  //
  // A normal anchor is a single instant — the segment before it ends there and
  // the segment after it starts there. A stretch of speech that appears in no
  // script line is different: it needs a segment to END at where it begins and
  // the next one to START at where it ends, so the frames in between belong to
  // no script word at all.
  //
  // Without that hole, forced alignment has nowhere to put the unscripted
  // audio — every script word must be assigned somewhere — so it drags the
  // following words backwards across it. That is what put "or you can" at 638s
  // when the narrator actually says it at 647.5s.
  const cuts = [{ si: 0, tIn: 0, tOut: 0 }];
  for (const a of anchors) {
    const fr = Math.max(0, Math.round(heard[a.hi].start * FPS));
    cuts.push({ si: a.si, tIn: fr, tOut: fr });
  }
  for (const m of mismatches) {
    if (m.type !== 'extra' || m.siAfter === undefined) continue;
    cuts.push({
      si: m.siAfter,
      tIn: Math.max(0, Math.round(m.start * FPS)),
      tOut: Math.min(T, Math.round(m.end * FPS))
    });
  }
  cuts.push({ si: scriptWords.length, tIn: T, tOut: T });

  // Keep them ordered and consistent: a later cut may never start before an
  // earlier one ends, and an anchor that fell inside an unscripted stretch is
  // dropped rather than allowed to contradict it.
  cuts.sort((a, b) => a.si - b.si || a.tIn - b.tIn);
  const keep = [cuts[0]];
  for (let i = 1; i < cuts.length; i++) {
    const prev = keep[keep.length - 1];
    const c = cuts[i];
    if (c.si <= prev.si || c.tIn < prev.tOut) continue;
    keep.push(c);
  }
  if (keep[keep.length - 1].si !== scriptWords.length) {
    keep.push({ si: scriptWords.length, tIn: T, tOut: T });
  }

  const segs = [];
  for (let i = 0; i < keep.length - 1; i++) {
    const s0 = keep[i].si;
    const s1 = keep[i + 1].si;
    const t0 = keep[i].tOut;
    const t1 = keep[i + 1].tIn;
    if (s1 > s0 && t1 > t0) segs.push({ s0, s1, t0, t1 });
  }

  // ---- subdivide any segment whose Viterbi table would be too large
  const sized = [];
  for (const seg of segs) {
    const queue = [seg];
    while (queue.length) {
      const g = queue.pop();
      const L = countTokens(scriptWords, g.s0, g.s1);
      const cells = (g.t1 - g.t0) * (2 * L + 1);
      if (cells <= MAX_SEGMENT_CELLS || g.s1 - g.s0 <= 2) {
        sized.push(g);
        continue;
      }
      // split at the script midpoint, and at the time the greedy match implies
      const sm = (g.s0 + g.s1) >> 1;
      let tm = -1;
      for (let d = 0; d < (g.s1 - g.s0) >> 1; d++) {
        for (const k of [sm - d, sm + d]) {
          if (k > g.s0 && k < g.s1 && map[k] >= 0) {
            const f = Math.round(heard[map[k]].start * FPS);
            if (f > g.t0 && f < g.t1) { tm = f; break; }
          }
        }
        if (tm > 0) break;
      }
      if (tm < 0) tm = (g.t0 + g.t1) >> 1;
      queue.push({ s0: g.s0, s1: sm, t0: g.t0, t1: tm });
      queue.push({ s0: sm, s1: g.s1, t0: tm, t1: g.t1 });
    }
  }
  sized.sort((a, b) => a.s0 - b.s0);

  // ---- run forced alignment per segment
  const wordTimes = new Array(scriptWords.length).fill(null);
  for (let gi = 0; gi < sized.length; gi++) {
    const g = sized[gi];
    if (onProgress) onProgress(gi / sized.length);

    const tokens = [];
    const tokWord = [];
    for (let i = g.s0; i < g.s1; i++) {
      if (i > g.s0) { tokens.push(vocab['|']); tokWord.push(-1); }
      for (const c of scriptWords[i].norm) {
        tokens.push(vocab[c] !== undefined ? vocab[c] : blank);
        tokWord.push(i);
      }
    }
    if (!tokens.length) continue;

    const spans = forcedAlignSegment(logProbs, V, g.t0, g.t1, Int32Array.from(tokens), blank);
    if (!spans) continue;

    for (let k = 0; k < tokWord.length; k++) {
      const wi = tokWord[k];
      if (wi < 0) continue;
      const a = spans[k * 2];
      const b = spans[k * 2 + 1];
      if (a < 0) continue;
      const w = wordTimes[wi];
      if (!w) wordTimes[wi] = { start: a / FPS, end: b / FPS };
      else {
        if (a / FPS < w.start) w.start = a / FPS;
        if (b / FPS > w.end) w.end = b / FPS;
      }
    }
  }

  return { wordTimes, heard, mismatches, matched: exact.reduce((a, b) => a + b, 0) };
}

function countTokens(scriptWords, s0, s1) {
  let n = 0;
  for (let i = s0; i < s1; i++) n += scriptWords[i].norm.length + (i > s0 ? 1 : 0);
  return n;
}

/**
 * Find runs of >= MIN_RUN words where script and audio disagree.
 *
 * An "extra" run — the narrator says words that appear nowhere in the script —
 * is the one that silently breaks boundary placement, because that audio has
 * to be given to some line regardless, and whichever line receives it then
 * looks over-long while its neighbour looks starved.
 */
function findMismatches(scriptWords, scriptNorm, heard, heardNorm, map) {
  const MIN_RUN = 4;
  const out = [];

  // Which heard words were claimed by some script word?
  const claimed = new Uint8Array(heardNorm.length);
  for (let i = 0; i < map.length; i++) if (map[i] >= 0) claimed[map[i]] = 1;

  // extra: consecutive unclaimed heard words
  let j = 0;
  while (j < heardNorm.length) {
    if (claimed[j]) { j++; continue; }
    let k = j;
    while (k < heardNorm.length && !claimed[k]) k++;
    if (k - j >= MIN_RUN) {
      // The script words either side of the run: the last one matched before
      // it, and the first one matched after. `siAfter` is what the aligner
      // needs — the script word that must not be allowed to start until this
      // unscripted stretch is over.
      let siBefore = -1;
      let siAfter = -1;
      for (let i = 0; i < map.length; i++) {
        if (map[i] < 0) continue;
        if (map[i] < j) siBefore = i;
        else if (map[i] >= k && siAfter < 0) siAfter = i;
      }
      out.push({
        type: 'extra',
        line: siBefore >= 0 ? scriptWords[siBefore].line : 0,
        siAfter: siAfter >= 0 ? siAfter : undefined,
        start: heard[j].start,
        end: heard[k - 1].end,
        text: heardNorm.slice(j, k).join(' ')
      });
    }
    j = k;
  }

  // missing: consecutive script words with no match at all
  let i = 0;
  while (i < map.length) {
    if (map[i] >= 0) { i++; continue; }
    let k = i;
    while (k < map.length && map[k] < 0) k++;
    if (k - i >= MIN_RUN) {
      out.push({
        type: 'missing',
        line: scriptWords[i].line,
        start: null,
        end: null,
        text: scriptNorm.slice(i, k).join(' ')
      });
    }
    i = k;
  }

  out.sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  return out;
}

// ---------------------------------------------------------------------------
// Line spans
// ---------------------------------------------------------------------------

/**
 * Turn per-word times into contiguous, non-overlapping line spans.
 *
 * Boundaries sit in the gap between the last word of one line and the first
 * word of the next, so the natural pause is preserved rather than clipped, and
 * neither neighbour swallows it whole. No pause detection is needed: forced
 * alignment already puts the boundary between the right two words, whether or
 * not the narrator paused there.
 */
export function wordsToLineSpans(wordTimes, scriptWords, lineCount, totalDuration) {
  const first = new Array(lineCount).fill(null);
  const last = new Array(lineCount).fill(null);

  scriptWords.forEach((w, i) => {
    const t = wordTimes[i];
    if (!t) return;
    const li = w.line;
    if (first[li] === null || t.start < first[li]) first[li] = t.start;
    if (last[li] === null || t.end > last[li]) last[li] = t.end;
  });

  // Lines that matched nothing get interpolated between their anchored
  // neighbours, weighted by how much each one actually says.
  for (let i = 0; i < lineCount; i++) {
    if (first[i] !== null) continue;
    let p = i - 1;
    while (p >= 0 && last[p] === null) p--;
    let n = i + 1;
    while (n < lineCount && first[n] === null) n++;
    const from = p >= 0 ? last[p] : 0;
    const to = n < lineCount ? first[n] : totalDuration;

    const runFrom = p + 1;
    const runTo = n - 1;
    let total = 0;
    for (let k = runFrom; k <= runTo; k++) total += weightOf(scriptWords, k);
    if (total <= 0) total = 1;
    let before = 0;
    for (let k = runFrom; k < i; k++) before += weightOf(scriptWords, k);
    const span = Math.max(0, to - from);
    first[i] = from + (span * before) / total;
    last[i] = from + (span * (before + weightOf(scriptWords, i))) / total;
  }

  const bounds = new Array(lineCount + 1);
  bounds[0] = 0;
  bounds[lineCount] = totalDuration;
  for (let i = 0; i < lineCount - 1; i++) {
    const a = last[i];
    const b = first[i + 1];
    bounds[i + 1] = b > a ? (a + b) / 2 : Math.max(a, b);
  }

  for (let i = 1; i <= lineCount; i++) {
    const min = bounds[i - 1] + 0.1;
    const max = totalDuration - (lineCount - i) * 0.1;
    bounds[i] = Math.min(Math.max(bounds[i], min), Math.max(min, max));
  }
  bounds[lineCount] = totalDuration;
  return bounds;
}

function weightOf(scriptWords, line) {
  let n = 0;
  for (const w of scriptWords) if (w.line === line) n++;
  return Math.max(1, n);
}
