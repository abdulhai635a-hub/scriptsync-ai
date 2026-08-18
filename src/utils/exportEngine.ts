import type {
  SceneClip,
  CaptionLine,
  CaptionWord,
  VoiceClip,
  BgmTrackConfig,
  SubtitleStyleConfig,
  OverlayConfig,
  AspectRatioType
} from '../types';

export interface RenderProgress {
  progress: number;
  frame: number;
  totalFrames: number;
  status: string;
}

export interface RenderOptions {
  scenes: SceneClip[];
  captions: CaptionLine[];
  voiceClips: Record<number, VoiceClip>;
  bgm: BgmTrackConfig;
  subtitleStyle: SubtitleStyleConfig;
  overlays: OverlayConfig;
  aspectRatio: AspectRatioType;
  resolution: '720p' | '1080p' | '4k';
  fps: number;
  onProgress: (progress: number, frame: number, totalFrames: number, status: string) => void;
}

export async function renderVideoProject(options: RenderOptions): Promise<{ blob: Blob; url: string }> {
  const {
    scenes,
    captions,
    voiceClips,
    bgm,
    subtitleStyle,
    overlays,
    aspectRatio,
    resolution,
    fps = 30,
    onProgress
  } = options;

  // Calculate dimensions based on aspect ratio and resolution
  let width = 1080;
  let height = 1920;

  if (aspectRatio === '9:16') {
    if (resolution === '720p') { width = 720; height = 1280; }
    else if (resolution === '4k') { width = 2160; height = 3840; }
    else { width = 1080; height = 1920; }
  } else if (aspectRatio === '16:9') {
    if (resolution === '720p') { width = 1280; height = 720; }
    else if (resolution === '4k') { width = 3840; height = 2160; }
    else { width = 1920; height = 1080; }
  } else if (aspectRatio === '1:1') {
    if (resolution === '720p') { width = 720; height = 720; }
    else if (resolution === '4k') { width = 2160; height = 2160; }
    else { width = 1080; height = 1080; }
  } else {
    // 4:5
    if (resolution === '720p') { width = 720; height = 900; }
    else if (resolution === '4k') { width = 2160; height = 2700; }
    else { width = 1080; height = 1350; }
  }

  // Pre-load all scene images into Image objects
  const loadedImages: Record<string, HTMLImageElement> = {};
  onProgress(0.05, 0, 100, 'Pre-loading visual media assets...');

  await Promise.all(
    scenes.map(
      (scene) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            loadedImages[scene.id] = img;
            resolve();
          };
          img.onerror = () => {
            // Create fallback gradient
            loadedImages[scene.id] = img;
            resolve();
          };
          img.src = scene.imageUrl;
        })
    )
  );

  // Calculate total duration
  const totalDuration = scenes.reduce((acc, s) => acc + s.duration, 0);
  const totalFrames = Math.max(1, Math.ceil(totalDuration * fps));

  // Create offscreen canvas for rendering
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  // Setup Web Audio graph for combining voice clips and BGM
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  const destNode = audioCtx.createMediaStreamDestination();

  // Load and decode voice audio buffers
  onProgress(0.1, 0, totalFrames, 'Synthesizing multi-track audio...');
  const voiceBuffers: Record<number, AudioBuffer> = {};

  await Promise.all(
    Object.entries(voiceClips).map(async ([numStr, voice]) => {
      const num = parseInt(numStr, 10);
      try {
        const resp = await fetch(voice.url);
        const arrayBuf = await resp.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuf);
        voiceBuffers[num] = decoded;
      } catch (e) {
        console.log(`Could not decode audio for scene ${num}:`, e);
      }
    })
  );

  // Load BGM if enabled
  let bgmBuffer: AudioBuffer | null = null;
  if (bgm.enabled && bgm.url) {
    try {
      const resp = await fetch(bgm.url);
      const arrayBuf = await resp.arrayBuffer();
      bgmBuffer = await audioCtx.decodeAudioData(arrayBuf);
    } catch (e) {
      console.log('Could not decode BGM:', e);
    }
  }

  // Setup MediaRecorder
  const canvasStream = canvas.captureStream(fps);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...destNode.stream.getAudioTracks()
  ]);

  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4'
  ];
  let chosenMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || '';

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(combinedStream, {
    mimeType: chosenMime,
    videoBitsPerSecond: resolution === '4k' ? 12000000 : 6000000
  });

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  recorder.start(100);

  // Start real-time audio playback into the destination node
  const startTime = audioCtx.currentTime + 0.1;

  // Play voice clips at their respective schedule
  let currentOffset = 0;
  scenes.forEach((scene) => {
    const voice = voiceClips[scene.num];
    const buf = voiceBuffers[scene.num];
    if (buf && voice && !voice.isMuted) {
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      const gain = audioCtx.createGain();
      gain.gain.value = voice.volume ?? 1.0;
      src.connect(gain);
      gain.connect(destNode);
      src.start(startTime + currentOffset);
    }
    currentOffset += scene.duration;
  });

  // Play BGM
  if (bgmBuffer && bgm.enabled) {
    const bgmSrc = audioCtx.createBufferSource();
    bgmSrc.buffer = bgmBuffer;
    bgmSrc.loop = bgm.loop;
    const bgmGain = audioCtx.createGain();
    bgmGain.gain.value = bgm.volume ?? 0.25;
    bgmSrc.connect(bgmGain);
    bgmGain.connect(destNode);
    bgmSrc.start(startTime);
  }

  // Render loop - synchronized to real audio timeline
  const frameIntervalMs = 1000 / fps;

  return new Promise((resolve, reject) => {
    let currentFrame = 0;
    const renderStartTime = performance.now();

    function renderNextFrame() {
      if (currentFrame >= totalFrames) {
        onProgress(0.98, totalFrames, totalFrames, 'Finalizing video stream...');
        setTimeout(() => {
          try {
            recorder.stop();
          } catch (e) {
            console.log('Recorder stop warning:', e);
          }
        }, 300);
        return;
      }

      const curTime = (currentFrame / fps);
      drawFrame(ctx, width, height, curTime, scenes, captions, subtitleStyle, overlays, loadedImages);

      currentFrame++;
      const progress = 0.1 + (currentFrame / totalFrames) * 0.85;
      onProgress(progress, currentFrame, totalFrames, `Rendering frame ${currentFrame}/${totalFrames} (${Math.round(curTime)}s)...`);

      // Match target frame rate accurately
      const expectedTime = renderStartTime + currentFrame * frameIntervalMs;
      const delay = Math.max(0, expectedTime - performance.now());
      setTimeout(renderNextFrame, delay);
    }

    recorder.onstop = () => {
      onProgress(1.0, totalFrames, totalFrames, 'Export complete!');
      const finalBlob = new Blob(chunks, { type: chosenMime || 'video/webm' });
      const finalUrl = URL.createObjectURL(finalBlob);
      if (audioCtx && audioCtx.state !== 'closed') {
        try {
          audioCtx.close().catch(() => {});
        } catch (e) {}
      }
      resolve({ blob: finalBlob, url: finalUrl });
    };

    recorder.onerror = (err) => {
      if (audioCtx && audioCtx.state !== 'closed') {
        try {
          audioCtx.close().catch(() => {});
        } catch (e) {}
      }
      reject(err);
    };

    renderNextFrame();
  });
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  currentTime: number,
  scenes: SceneClip[],
  captions: CaptionLine[],
  subtitleStyle: SubtitleStyleConfig,
  overlays: OverlayConfig,
  loadedImages: Record<string, HTMLImageElement>
) {
  // Clear canvas
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, W, H);

  // Find active scene
  let accumulatedTime = 0;
  let activeScene: SceneClip | null = null;
  let activeSceneIndex = 0;
  let sceneProgress = 0;

  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (currentTime >= accumulatedTime && currentTime < accumulatedTime + s.duration) {
      activeScene = s;
      activeSceneIndex = i;
      sceneProgress = (currentTime - accumulatedTime) / s.duration;
      break;
    }
    accumulatedTime += s.duration;
  }

  // Fallback to last scene if reached end
  if (!activeScene && scenes.length > 0) {
    activeScene = scenes[scenes.length - 1];
    activeSceneIndex = scenes.length - 1;
    sceneProgress = 1.0;
  }

  if (activeScene) {
    const img = loadedImages[activeScene.id];
    if (img && img.complete && img.naturalWidth > 0) {
      // Calculate Ken Burns pan & zoom
      let scale = 1.0;
      let panX = 0;
      let panY = 0;
      const speed = activeScene.motionSpeed || 1.0;
      const t = Math.max(0, Math.min(1, sceneProgress * speed));

      switch (activeScene.motion) {
        case 'zoom-in':
          scale = 1.0 + t * 0.15;
          break;
        case 'zoom-out':
          scale = 1.15 - t * 0.15;
          break;
        case 'pan-left':
          scale = 1.1;
          panX = (1 - t) * 40;
          break;
        case 'pan-right':
          scale = 1.1;
          panX = -(1 - t) * 40;
          break;
        case 'drift':
          scale = 1.05 + Math.sin(t * Math.PI) * 0.08;
          panY = Math.cos(t * Math.PI) * 20;
          break;
        default:
          scale = 1.0;
      }

      // Apply CSS-like visual filters
      const brightness = (activeScene.brightness ?? 100) / 100;
      const contrast = (activeScene.contrast ?? 100) / 100;
      const saturation = (activeScene.saturation ?? 100) / 100;

      let filterString = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;

      if (activeScene.filter === 'noir') {
        filterString += ' grayscale(100%) contrast(1.2)';
      } else if (activeScene.filter === 'vintage') {
        filterString += ' sepia(40%) contrast(1.1) brightness(0.95)';
      } else if (activeScene.filter === 'vibrant') {
        filterString += ' saturate(1.5) contrast(1.1)';
      } else if (activeScene.filter === 'cyberpunk') {
        filterString += ' hue-rotate(180deg) saturate(1.6) contrast(1.2)';
      } else if (activeScene.filter === 'warm') {
        filterString += ' sepia(20%) saturate(1.2)';
      } else if (activeScene.filter === 'cool') {
        filterString += ' hue-rotate(200deg) saturate(1.1)';
      }

      ctx.save();
      ctx.filter = filterString;

      // Draw image fitted and centered
      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      const canvasAspect = W / H;
      const imgAspect = imgW / imgH;

      let renderW = W;
      let renderH = H;

      if (activeScene.fit === 'contain') {
        if (imgAspect > canvasAspect) {
          renderW = W;
          renderH = W / imgAspect;
        } else {
          renderH = H;
          renderW = H * imgAspect;
        }
      } else {
        // cover
        if (imgAspect > canvasAspect) {
          renderH = H;
          renderW = H * imgAspect;
        } else {
          renderW = W;
          renderH = W / imgAspect;
        }
      }

      renderW *= scale;
      renderH *= scale;

      const drawX = (W - renderW) / 2 + panX;
      const drawY = (H - renderH) / 2 + panY;

      ctx.drawImage(img, drawX, drawY, renderW, renderH);
      ctx.restore();
    } else {
      // Clean gradient placeholder
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#1e1b4b');
      grad.addColorStop(1, '#09090b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Vignette: only when asked for.
  //
  // This used to be drawn unconditionally, which darkened the corners of every
  // frame of every export with no way to turn it off. Artwork that already has
  // its own lighting — the stick-figure scenes, for one — ends up with a grey
  // halo and black corners that were never in the source image.
  if (overlays.showVignette) {
    const vigGrad = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
    vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vigGrad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, W, H);
  }

  // Draw Subtitle / Captions.
  // `enabled` is optional, so only an explicit false hides them — projects
  // saved before the switch existed keep the subtitles they were built with.
  if (subtitleStyle.enabled !== false) {
    const activeCaption = captions.find(
      (c) => currentTime >= c.startTime && currentTime <= c.endTime
    );

    if (activeCaption && activeCaption.text) {
      drawRenderedSubtitle(ctx, activeCaption, currentTime, subtitleStyle, W, H);
    }
  }

  // Draw Overlays: Progress bar at bottom
  if (overlays.showProgressBar) {
    const totalDur = scenes.reduce((a, b) => a + b.duration, 0) || 1;
    const progress = Math.max(0, Math.min(1, currentTime / totalDur));
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, H - 12, W, 12);

    ctx.fillStyle = overlays.progressBarColor || '#FFD400';
    ctx.fillRect(0, H - 12, W * progress, 12);
  }

  // Draw Overlays: Watermark
  if (overlays.showWatermark && overlays.watermarkText) {
    ctx.font = `600 ${Math.round(H * 0.02)}px 'Space Grotesk', Inter, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.textAlign = 'right';
    ctx.fillText(overlays.watermarkText, W - 32, 54);
  }

  // Draw Overlays: CTA Badge
  if (overlays.showCtaBadge && overlays.ctaText) {
    const bH = Math.round(H * 0.045);
    const bW = Math.round(W * 0.45);
    const bX = overlays.ctaPosition.includes('right') ? W - bW - 32 : 32;
    const bY = overlays.ctaPosition.includes('bottom') ? H - bH - 60 : 40;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.strokeStyle = '#FFD400';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(bX, bY, bW, bH, bH / 2) : ctx.rect(bX, bY, bW, bH);
    ctx.fill();
    ctx.stroke();

    ctx.font = `700 ${Math.round(bH * 0.45)}px 'Space Grotesk', Inter, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(overlays.ctaText, bX + bW / 2, bY + bH * 0.65);
  }
}

export interface CaptionWordChunk {
  text: string;
  words: string[];
  startTime: number;
  endTime: number;
  duration: number;
  chunkIndex: number;
  totalChunks: number;
  /** Measured start/end for each word in `words`, when the caption has them. */
  wordTimes?: Array<{ start: number; end: number }>;
  /** True when the times above came from alignment rather than from word counts. */
  measured?: boolean;
}

/**
 * Line up the caption's displayed words with the measured words from alignment.
 *
 * The two lists come from the same text but are not guaranteed to be the same
 * length: alignment drops tokens that carry no letters at all (a lone "..." or
 * a dash), because there is nothing in them for a speech model to find. So the
 * lists are walked together and matched on the raw text rather than zipped by
 * index, and any display word left without a match is interpolated from its
 * neighbours instead of being dropped or silently misaligned.
 */
function matchWordTimes(
  rawWords: string[],
  measured: CaptionWord[] | undefined,
  fallbackStart: number,
  fallbackEnd: number
): { times: Array<{ start: number; end: number }>; measured: boolean } {
  const span = Math.max(0.2, fallbackEnd - fallbackStart);
  const proportional = () => ({
    times: rawWords.map((_, i) => ({
      start: fallbackStart + (span * i) / rawWords.length,
      end: fallbackStart + (span * (i + 1)) / rawWords.length
    })),
    measured: false
  });

  if (!measured || measured.length === 0) return proportional();

  const key = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const out: Array<{ start: number; end: number } | null> = [];
  let p = 0;
  let hits = 0;

  for (const raw of rawWords) {
    const k = key(raw);
    let found: { start: number; end: number } | null = null;
    // Look a little way ahead so one dropped token doesn't desynchronise the
    // rest of the line.
    for (let q = p; q < Math.min(measured.length, p + 3); q++) {
      if (key(measured[q].word) === k && k.length > 0) {
        found = { start: measured[q].start, end: measured[q].end };
        p = q + 1;
        hits++;
        break;
      }
    }
    out.push(found);
  }

  // If barely anything lined up, the measured list doesn't describe this text
  // (the caption was edited after aligning, say) — don't trust it at all.
  if (hits < rawWords.length * 0.6) return proportional();

  // Fill unmatched words by sharing the gap between the matches around them.
  for (let i = 0; i < out.length; i++) {
    if (out[i]) continue;
    let a = i - 1;
    while (a >= 0 && !out[a]) a--;
    let b = i + 1;
    while (b < out.length && !out[b]) b++;
    const from = a >= 0 ? (out[a] as { start: number; end: number }).end : fallbackStart;
    const to = b < out.length ? (out[b] as { start: number; end: number }).start : fallbackEnd;
    const n = b - a - 1;
    const k = i - a;
    const step = Math.max(0, to - from) / Math.max(1, n);
    out[i] = { start: from + step * (k - 1), end: from + step * k };
  }

  return { times: out as Array<{ start: number; end: number }>, measured: true };
}

/**
 * Breaks down caption text into dynamic punchy chunks of 3 to 6 words (never > 6 words).
 * Cycles through 3, 4, 5, 6 word groupings or respects selected mode.
 */
export function getCaptionChunks(
  caption: CaptionLine,
  mode: SubtitleStyleConfig['chunkMode'] = 'smart-dynamic',
  customMaxWords: number = 6
): CaptionWordChunk[] {
  const rawWords = caption.text.trim().split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return [];

  const maxLimit = Math.min(6, Math.max(3, customMaxWords || 6));

  // Determine target chunk sizes
  let targetChunkSizes: number[] = [];
  if (mode === '3-words') {
    targetChunkSizes = [3];
  } else if (mode === '4-words') {
    targetChunkSizes = [4];
  } else if (mode === '5-words') {
    targetChunkSizes = [5];
  } else if (mode === '6-words') {
    targetChunkSizes = [6];
  } else if (mode === 'full' && rawWords.length <= maxLimit) {
    targetChunkSizes = [rawWords.length];
  } else {
    // smart-dynamic: rhythmic variety of 3, 4, 5, 6 words (never > 6)
    // Deterministic sequence based on total word count and seed
    const sequence = [4, 3, 5, 4, 6, 3, 5, 4, 3, 4];
    targetChunkSizes = sequence;
  }

  const chunks: { words: string[] }[] = [];
  let currentIndex = 0;
  let seqPointer = (caption.num || 1) % targetChunkSizes.length;

  while (currentIndex < rawWords.length) {
    const remaining = rawWords.length - currentIndex;
    let desiredSize = targetChunkSizes[seqPointer % targetChunkSizes.length];
    seqPointer++;

    // Cap desired size to never exceed maxLimit (6)
    desiredSize = Math.min(desiredSize, maxLimit);

    // If remaining is just slightly larger than desired size, avoid leaving 1 lonely word
    if (remaining === desiredSize + 1 && desiredSize > 3) {
      desiredSize = desiredSize - 1;
    } else if (remaining < 3 && chunks.length > 0 && remaining + chunks[chunks.length - 1].words.length <= maxLimit) {
      // Append remaining 1 or 2 words to the previous chunk if it stays under max limit
      chunks[chunks.length - 1].words.push(...rawWords.slice(currentIndex));
      break;
    }

    const take = Math.min(remaining, desiredSize);
    chunks.push({
      words: rawWords.slice(currentIndex, currentIndex + take)
    });
    currentIndex += take;
  }

  // Timestamps for each chunk.
  //
  // Where alignment measured when each word was actually spoken, the chunk
  // simply spans its own first and last word. Only when there is no measured
  // timing does this fall back to slicing the line up by word count — which is
  // wrong whenever the speaker doesn't give every word the same length, i.e.
  // always. That fallback is why a highlighted word could sit seconds away from
  // the voice.
  const captionEnd = caption.endTime || caption.startTime + (caption.duration || 0.6);
  const { times, measured } = matchWordTimes(rawWords, caption.words, caption.startTime, captionEnd);

  let wordCursor = 0;
  return chunks.map((c, idx) => {
    const from = wordCursor;
    const to = wordCursor + c.words.length;
    wordCursor = to;

    const slice = times.slice(from, to);
    const start = slice.length ? slice[0].start : caption.startTime;
    // A chunk runs until the next one begins, so the highlight never blanks out
    // during the pause between two words.
    const end = to < times.length ? times[to].start : Math.max(captionEnd, slice.length ? slice[slice.length - 1].end : captionEnd);

    return {
      text: c.words.join(' '),
      words: c.words,
      startTime: start,
      endTime: end,
      duration: Math.max(0.3, end - start),
      chunkIndex: idx,
      totalChunks: chunks.length,
      wordTimes: slice,
      measured
    };
  });
}

/**
 * Which word of a chunk is being spoken at `currentTime`.
 *
 * With measured word times this is a lookup, not an estimate: the word that
 * lights up is the one the voice is on. The old behaviour — dividing the
 * chunk's length by its word count — assumed every word takes equally long, so
 * the highlight ran ahead of short words and behind long ones, which is what
 * made it look permanently late.
 */
export function activeWordIndex(chunk: CaptionWordChunk, currentTime: number): number {
  const wt = chunk.wordTimes;
  if (chunk.measured && wt && wt.length === chunk.words.length && wt.length > 0) {
    let idx = 0;
    for (let i = 0; i < wt.length; i++) {
      // A word stays lit through the silence after it, until the next begins.
      if (currentTime >= wt[i].start) idx = i;
      else break;
    }
    return idx;
  }
  const progress = Math.max(0, Math.min(1, (currentTime - chunk.startTime) / Math.max(0.001, chunk.duration)));
  return Math.min(chunk.words.length - 1, Math.floor(progress * chunk.words.length));
}

function drawRenderedSubtitle(
  ctx: CanvasRenderingContext2D,
  caption: CaptionLine,
  currentTime: number,
  style: SubtitleStyleConfig,
  W: number,
  H: number
) {
  // Get dynamic 3-to-6 word chunks for the active caption
  const chunks = getCaptionChunks(caption, style.chunkMode || 'smart-dynamic', style.maxWordsPerChunk || 6);
  if (chunks.length === 0) return;

  // Find active chunk at currentTime
  let activeChunk = chunks.find(
    (c) => currentTime >= c.startTime && currentTime <= c.endTime
  );

  // If outside exact range, pick closest chunk
  if (!activeChunk) {
    if (currentTime < chunks[0].startTime) {
      activeChunk = chunks[0];
    } else {
      activeChunk = chunks[chunks.length - 1];
    }
  }

  const fontSize = Math.round(H * (style.fontSize / 1000) * 1.15);
  const fontFamily = style.fontFamily || 'Space Grotesk';
  const anim = style.animation || 'pop';

  // Calculate timing progress within this 3-6 word chunk (0.0 to 1.0)
  const chunkProgress = Math.max(0, Math.min(1, (currentTime - activeChunk.startTime) / activeChunk.duration));

  // Which word is being spoken right now.
  //
  // With measured word times this is a lookup, not an estimate: the word that
  // lights up is the one the voice is on. The old behaviour — dividing the
  // chunk's length by its word count — assumed every word takes equally long,
  // so the highlight ran ahead of short words and behind long ones and looked
  // permanently late.
  const activeWordIdx = activeWordIndex(activeChunk, currentTime);

  const rawWords = activeChunk.words.map((w) =>
    style.textTransform === 'uppercase' ? w.toUpperCase() : style.textTransform === 'capitalize' ? w.charAt(0).toUpperCase() + w.slice(1) : w
  );

  const posY = H * ((style.positionY ?? 82) / 100);

  ctx.save();
  ctx.font = `800 ${fontSize}px '${fontFamily}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // ANIMATION 1: 'pop' / 'bounce' (Scale Entrance Pop & Spring)
  let scale = 1.0;
  let offsetY = 0;
  let opacity = 1.0;

  if (anim === 'pop') {
    // Pop in spring animation during first 0.25s of chunk
    const entryWindow = 0.22;
    if (chunkProgress < entryWindow) {
      const p = chunkProgress / entryWindow;
      // Elastic overshoot curve
      scale = 0.82 + Math.sin(p * Math.PI * 0.7) * 0.35 - (p > 0.7 ? (p - 0.7) * 0.4 : 0);
    } else {
      // Subtle rhythmic pulse
      scale = 1.0 + Math.sin(chunkProgress * Math.PI * 2) * 0.02;
    }
  } else if (anim === 'bounce') {
    // Bouncy elastic bounce on Y
    const bouncePhase = chunkProgress * Math.PI * 4;
    offsetY = -Math.abs(Math.sin(bouncePhase)) * Math.max(0, 1 - chunkProgress * 0.8) * (fontSize * 0.3);
  } else if (anim === 'slide-up') {
    const slideWindow = 0.25;
    if (chunkProgress < slideWindow) {
      const p = chunkProgress / slideWindow;
      offsetY = (1 - p) * (fontSize * 0.6);
      opacity = p;
    }
  } else if (anim === 'fade') {
    const fadeWindow = 0.2;
    if (chunkProgress < fadeWindow) {
      opacity = chunkProgress / fadeWindow;
    }
  }

  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));

  // Transform canvas for scale & offset
  ctx.translate(W / 2, posY + offsetY);
  if (scale !== 1.0) {
    ctx.scale(scale, scale);
  }

  // Measure all words in chunk
  const spaceWidth = ctx.measureText(' ').width;
  const wordMetrics = rawWords.map((w) => ({
    text: w,
    width: ctx.measureText(w).width
  }));

  const totalTextWidth = wordMetrics.reduce((acc, m) => acc + m.width, 0) + spaceWidth * (rawWords.length - 1);

  // Typewriter animation: limit displayed characters
  let charLimit = 9999;
  if (anim === 'typewriter') {
    const totalChars = activeChunk.text.length;
    charLimit = Math.max(1, Math.floor(chunkProgress * totalChars * 1.3));
  }

  // Draw Background Box Pill if enabled
  if (style.hasBox) {
    const padX = fontSize * 0.55;
    const padY = fontSize * 0.32;
    const bW = totalTextWidth + padX * 2;
    const bH = fontSize * 1.35 + padY * 2;
    const bX = -bW / 2;
    const bY = -bH / 2;

    ctx.save();
    ctx.fillStyle = style.boxColor || 'rgba(0,0,0,0.8)';
    ctx.globalAlpha = (style.boxOpacity ?? 0.8) * opacity;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(bX, bY, bW, bH, 14) : ctx.rect(bX, bY, bW, bH);
    ctx.fill();
    ctx.restore();
  }

  // Draw individual words with Karaoke word-by-word highlight and Wave motion
  let currentX = -totalTextWidth / 2;
  let accumulatedChars = 0;

  wordMetrics.forEach((m, idx) => {
    const isWordActive = idx === activeWordIdx;
    const wordCenterX = currentX + m.width / 2;

    // Check typewriter cut-off
    if (accumulatedChars >= charLimit) {
      accumulatedChars += m.text.length + 1;
      currentX += m.width + spaceWidth;
      return;
    }

    let wordTextToRender = m.text;
    if (anim === 'typewriter' && accumulatedChars + m.text.length > charLimit) {
      const allowed = charLimit - accumulatedChars;
      wordTextToRender = m.text.slice(0, allowed);
    }
    accumulatedChars += m.text.length + 1;

    // Wave animation offset
    let wordYOffset = 0;
    if (anim === 'wave') {
      wordYOffset = Math.sin(currentTime * 8 + idx * 0.9) * (fontSize * 0.15);
    }

    ctx.save();
    ctx.translate(wordCenterX, wordYOffset);

    // If word is actively spoken in 'word-glow' / 'pop' / 'bounce' mode, give it extra punch!
    if (isWordActive && (anim === 'word-glow' || anim === 'pop' || anim === 'bounce')) {
      const activeWordScale = 1.08;
      ctx.scale(activeWordScale, activeWordScale);
    }

    // Shadow setup
    if (style.hasShadow) {
      ctx.shadowColor = isWordActive && anim === 'word-glow' ? style.highlightColor || '#22C55E' : style.shadowColor || 'rgba(0,0,0,0.95)';
      ctx.shadowBlur = isWordActive && anim === 'word-glow' ? 22 : 12;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 4;
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    // Outline Stroke
    if (style.strokeWidth > 0) {
      ctx.lineWidth = style.strokeWidth * (fontSize / 28);
      ctx.strokeStyle = style.strokeColor || '#000000';
      ctx.lineJoin = 'round';
      ctx.strokeText(wordTextToRender, 0, 0);
    }

    // Fill Color: Highlight color if active word in word-glow/pop, otherwise textColor
    if (isWordActive && (anim === 'word-glow' || anim === 'pop' || anim === 'bounce')) {
      ctx.fillStyle = style.highlightColor || '#FFD400';
    } else {
      ctx.fillStyle = style.textColor || '#FFFFFF';
    }

    ctx.fillText(wordTextToRender, 0, 0);
    ctx.restore();

    currentX += m.width + spaceWidth;
  });

  ctx.restore();
}
