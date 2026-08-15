import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2,
  Repeat, 
  ChevronLeft, 
  ChevronRight, 
  SkipBack, 
  SkipForward,
  Shield,
  Grid,
  Sparkles,
  Smartphone,
  Monitor,
  Square,
  ZoomIn,
  ZoomOut,
  Maximize
} from 'lucide-react';
import type { 
  SceneClip, 
  CaptionLine, 
  VoiceClip, 
  BgmTrackConfig, 
  SubtitleStyleConfig, 
  OverlayConfig, 
  AspectRatioType 
} from '../../types';
import { drawFrame } from '../../utils/exportEngine';

interface LiveCanvasViewportProps {
  scenes: SceneClip[];
  captions: CaptionLine[];
  voiceClips: Record<number, VoiceClip>;
  bgm: BgmTrackConfig;
  subtitleStyle: SubtitleStyleConfig;
  overlays: OverlayConfig;
  aspectRatio: AspectRatioType;
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  safeZoneOverlay: boolean;
  gridOverlay: boolean;
  onToggleSafeZone?: () => void;
  onToggleGrid?: () => void;
  onChangeAspectRatio?: (ratio: AspectRatioType) => void;
  onOpenExportModal: () => void;
}

export const LiveCanvasViewport: React.FC<LiveCanvasViewportProps> = ({
  scenes,
  captions,
  voiceClips,
  bgm,
  subtitleStyle,
  overlays,
  aspectRatio,
  currentTime,
  totalDuration,
  isPlaying,
  onTogglePlay,
  onSeek,
  safeZoneOverlay,
  gridOverlay,
  onToggleSafeZone,
  onToggleGrid,
  onChangeAspectRatio,
  onOpenExportModal
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [isLooping, setIsLooping] = useState(true);
  const [viewportScale, setViewportScale] = useState<number>(1.0); // 1.0 = Fit to frame
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Cached image elements for 60fps canvas drawing
  const imageCacheRef = useRef<Record<string, HTMLImageElement>>({});

  // Web Audio Context & Nodes for live multi-track preview
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bgmSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bgmBufferRef = useRef<AudioBuffer | null>(null);
  const activeVoiceSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const voiceBuffersRef = useRef<Record<number, AudioBuffer>>({});
  const bgmGainRef = useRef<GainNode | null>(null);
  const voiceGainRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const activeSceneNumRef = useRef<number | null>(null);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Pre-load images
  useEffect(() => {
    scenes.forEach((scene) => {
      if (!imageCacheRef.current[scene.id] || imageCacheRef.current[scene.id].src !== scene.imageUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = scene.imageUrl;
        imageCacheRef.current[scene.id] = img;
      }
    });
  }, [scenes]);

  // Initialize Web Audio graph safely
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      
      const masterGain = ctx.createGain();
      masterGain.gain.value = isMuted ? 0 : volume;
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;

      const voiceGain = ctx.createGain();
      voiceGain.gain.value = 1.0;
      voiceGain.connect(masterGain);
      voiceGainRef.current = voiceGain;

      const bgmGain = ctx.createGain();
      bgmGain.gain.value = bgm.enabled ? (bgm.volume ?? 0.3) : 0;
      bgmGain.connect(masterGain);
      bgmGainRef.current = bgmGain;

      audioCtxRef.current = ctx;
    }
    return audioCtxRef.current;
  }, [isMuted, volume, bgm.enabled, bgm.volume]);

  // Update volume & mute dynamically
  useEffect(() => {
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setValueAtTime(
        isMuted ? 0 : volume,
        audioCtxRef.current.currentTime
      );
    }
  }, [isMuted, volume]);

  // Update BGM gain
  useEffect(() => {
    if (bgmGainRef.current && audioCtxRef.current) {
      bgmGainRef.current.gain.setValueAtTime(
        bgm.enabled ? (bgm.volume ?? 0.3) : 0,
        audioCtxRef.current.currentTime
      );
    }
  }, [bgm.enabled, bgm.volume]);

  // Pre-decode voice audio buffers for instant live playback
  useEffect(() => {
    const ctx = getAudioContext();

    Object.entries(voiceClips).forEach(async ([numStr, voiceClip]) => {
      const num = parseInt(numStr, 10);
      const voice = voiceClip as VoiceClip;
      if (!voice || !voice.url) return;
      try {
        const resp = await fetch(voice.url);
        const buf = await resp.arrayBuffer();
        const decoded = await ctx.decodeAudioData(buf);
        voiceBuffersRef.current[num] = decoded;
      } catch (e) {
        // handled silently
      }
    });

    // Load BGM buffer
    if (bgm.enabled && bgm.url) {
      fetch(bgm.url)
        .then((r) => r.arrayBuffer())
        .then((buf) => ctx.decodeAudioData(buf))
        .then((decoded) => {
          bgmBufferRef.current = decoded;
        })
        .catch(() => {});
    }
  }, [voiceClips, bgm.url, bgm.enabled, getAudioContext]);

  // Helper to stop all currently running audio sources
  const stopLiveAudio = useCallback(() => {
    if (activeVoiceSourceRef.current) {
      try {
        activeVoiceSourceRef.current.stop();
        activeVoiceSourceRef.current.disconnect();
      } catch (e) {}
      activeVoiceSourceRef.current = null;
    }
    if (bgmSourceRef.current) {
      try {
        bgmSourceRef.current.stop();
        bgmSourceRef.current.disconnect();
      } catch (e) {}
      bgmSourceRef.current = null;
    }
    activeSceneNumRef.current = null;
  }, []);

  // Synchronized Audio Playback loop during Play
  useEffect(() => {
    const ctx = getAudioContext();

    if (!isPlaying) {
      stopLiveAudio();
      return;
    }

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // 1. Calculate active scene at currentTime
    let accumulatedTime = 0;
    let activeScene: SceneClip | null = null;
    let sceneStartTime = 0;

    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      if (currentTime >= accumulatedTime && currentTime < accumulatedTime + s.duration) {
        activeScene = s;
        sceneStartTime = accumulatedTime;
        break;
      }
      accumulatedTime += s.duration;
    }

    // 2. Start/Switch Voice Clip
    if (activeScene) {
      const sceneNum = activeScene.num;
      const voiceClip = voiceClips[sceneNum];
      const buffer = voiceBuffersRef.current[sceneNum];

      // If active scene changed or voice source not playing
      if (activeSceneNumRef.current !== sceneNum || !activeVoiceSourceRef.current) {
        if (activeVoiceSourceRef.current) {
          try {
            activeVoiceSourceRef.current.stop();
            activeVoiceSourceRef.current.disconnect();
          } catch (e) {}
          activeVoiceSourceRef.current = null;
        }

        activeSceneNumRef.current = sceneNum;

        if (buffer && voiceClip && !voiceClip.isMuted && voiceGainRef.current) {
          const offset = Math.max(0, currentTime - sceneStartTime);
          if (offset < buffer.duration) {
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            src.playbackRate.value = playbackSpeed;
            src.connect(voiceGainRef.current);
            src.start(0, offset);
            activeVoiceSourceRef.current = src;
            src.onended = () => {
              if (activeVoiceSourceRef.current === src) {
                activeVoiceSourceRef.current = null;
              }
            };
          }
        }
      }
    } else {
      if (activeVoiceSourceRef.current) {
        try {
          activeVoiceSourceRef.current.stop();
        } catch (e) {}
        activeVoiceSourceRef.current = null;
      }
      activeSceneNumRef.current = null;
    }

    // 3. Start BGM Source if not already running
    if (bgm.enabled && bgmBufferRef.current && !bgmSourceRef.current && bgmGainRef.current) {
      const bgmBuffer = bgmBufferRef.current;
      const bgmOffset = bgmBuffer.duration > 0 ? currentTime % bgmBuffer.duration : 0;
      const bgmSrc = ctx.createBufferSource();
      bgmSrc.buffer = bgmBuffer;
      bgmSrc.loop = true;
      bgmSrc.playbackRate.value = playbackSpeed;
      bgmSrc.connect(bgmGainRef.current);
      bgmSrc.start(0, bgmOffset);
      bgmSourceRef.current = bgmSrc;
    }
  }, [isPlaying, currentTime, scenes, voiceClips, bgm.enabled, playbackSpeed, getAudioContext, stopLiveAudio]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      stopLiveAudio();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try {
          audioCtxRef.current.close().catch(() => {});
        } catch (e) {}
      }
      audioCtxRef.current = null;
    };
  }, [stopLiveAudio]);

  // Main Canvas Render on CurrentTime / Props change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Canvas internal native resolution
    let W = 1080;
    let H = 1920;
    if (aspectRatio === '16:9') { W = 1920; H = 1080; }
    else if (aspectRatio === '1:1') { W = 1080; H = 1080; }
    else if (aspectRatio === '4:5') { W = 1080; H = 1350; }

    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }

    drawFrame(
      ctx,
      W,
      H,
      currentTime,
      scenes,
      captions,
      subtitleStyle,
      overlays,
      imageCacheRef.current
    );
  }, [currentTime, scenes, captions, subtitleStyle, overlays, aspectRatio]);

  // Keyboard shortcut: Spacebar to toggle Play/Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        onSeek(Math.max(0, currentTime - 0.5));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        onSeek(Math.min(totalDuration, currentTime + 0.5));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlay, onSeek, currentTime, totalDuration]);

  // Format seconds to mm:ss.s
  const formatTimecode = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return `${m < 10 ? '0' : ''}${m}:${parseFloat(s) < 10 ? '0' : ''}${s}`;
  };

  // Compute CSS aspect ratio classes
  const getAspectStyle = () => {
    let ratioCss = '9 / 16';
    if (aspectRatio === '16:9') ratioCss = '16 / 9';
    else if (aspectRatio === '1:1') ratioCss = '1 / 1';
    else if (aspectRatio === '4:5') ratioCss = '4 / 5';

    return {
      aspectRatio: ratioCss,
      maxHeight: '100%',
      maxWidth: '100%',
      transform: viewportScale !== 1.0 ? `scale(${viewportScale})` : undefined,
      transformOrigin: 'center center',
      transition: 'transform 0.15s ease-out'
    };
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090b] relative overflow-hidden select-none">
      {/* Top Viewport Header Toolbar */}
      <div className="h-10 bg-[#121215] border-b border-[#27272a] px-3 sm:px-4 flex items-center justify-between text-[#e4e4e7] flex-shrink-0 z-20">
        {/* Left: Aspect Ratio Selectors */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-[#a1a1aa] mr-1 hidden sm:inline">Ratio:</span>
          {[
            { id: '9:16' as AspectRatioType, label: '9:16', desc: 'Shorts/Reels', icon: Smartphone },
            { id: '16:9' as AspectRatioType, label: '16:9', desc: 'YouTube', icon: Monitor },
            { id: '1:1' as AspectRatioType, label: '1:1', desc: 'Square', icon: Square },
            { id: '4:5' as AspectRatioType, label: '4:5', desc: 'Portrait', icon: Smartphone }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = aspectRatio === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeAspectRatio && onChangeAspectRatio(item.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono font-medium transition-colors ${
                  isActive
                    ? 'bg-[#ffd400]/20 border border-[#ffd400]/80 text-[#ffd400] font-bold'
                    : 'bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-white hover:border-[#3f3f46]'
                }`}
                title={`${item.label} (${item.desc})`}
              >
                <Icon size={11} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Viewport Overlays & Scale Zoom Tools */}
        <div className="flex items-center gap-1.5">
          {/* Safe Zone Toggle */}
          {onToggleSafeZone && (
            <button
              onClick={onToggleSafeZone}
              className={`p-1.5 rounded-md text-[11px] font-medium border transition-colors flex items-center gap-1 ${
                safeZoneOverlay
                  ? 'border-[#ffd400]/60 bg-[#ffd400]/15 text-[#ffd400]'
                  : 'border-[#27272a] bg-[#18181b] text-[#a1a1aa] hover:text-white'
              }`}
              title="Toggle TikTok / Shorts UI Safe Zones"
            >
              <Shield size={12} />
              <span className="hidden md:inline text-[10px]">Safe Zone</span>
            </button>
          )}

          {/* Grid Overlay Toggle */}
          {onToggleGrid && (
            <button
              onClick={onToggleGrid}
              className={`p-1.5 rounded-md text-[11px] font-medium border transition-colors flex items-center gap-1 ${
                gridOverlay
                  ? 'border-[#ffd400]/60 bg-[#ffd400]/15 text-[#ffd400]'
                  : 'border-[#27272a] bg-[#18181b] text-[#a1a1aa] hover:text-white'
              }`}
              title="Toggle Rule-of-Thirds Composition Grid"
            >
              <Grid size={12} />
              <span className="hidden md:inline text-[10px]">Grid</span>
            </button>
          )}

          {/* Viewport Zoom / Fit Presets */}
          <div className="flex items-center bg-[#18181b] border border-[#27272a] rounded-md px-1 py-0.5">
            <button
              onClick={() => setViewportScale(Math.max(0.5, Number((viewportScale - 0.15).toFixed(2))))}
              className="p-1 text-[#a1a1aa] hover:text-white"
              title="Zoom out video view"
            >
              <ZoomOut size={11} />
            </button>
            <button
              onClick={() => setViewportScale(1.0)}
              className="px-1.5 text-[10px] font-mono text-[#ffd400] hover:underline"
              title="Reset to 100% Fit View"
            >
              {viewportScale === 1.0 ? 'Fit' : `${Math.round(viewportScale * 100)}%`}
            </button>
            <button
              onClick={() => setViewportScale(Math.min(2.0, Number((viewportScale + 0.15).toFixed(2))))}
              className="p-1 text-[#a1a1aa] hover:text-white"
              title="Zoom in video view"
            >
              <ZoomIn size={11} />
            </button>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-md border border-[#27272a] bg-[#18181b] text-[#a1a1aa] hover:text-white hover:border-[#3f3f46] transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Player'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Viewport Canvas Stage Container */}
      <div 
        ref={containerRef}
        className="flex-1 flex items-center justify-center p-3 sm:p-5 min-h-0 min-w-0 relative overflow-hidden bg-[#09090b]"
      >
        {/* Canvas Player Box with Aspect Ratio */}
        <div 
          style={getAspectStyle()}
          className="relative rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl bg-[#000000] border border-[#27272a] flex items-center justify-center group flex-shrink-0"
        >
          {/* Main HTML5 Canvas */}
          <canvas
            ref={canvasRef}
            className="w-full h-full object-contain cursor-pointer block"
            onClick={onTogglePlay}
          />

          {/* Safe Zone Overlay (TikTok & Shorts UI Guide) */}
          {safeZoneOverlay && (
            <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-[#ffd400]/40 z-10">
              {/* Header Title Area Safe Margin */}
              <div className="absolute top-0 left-0 right-0 h-[10%] bg-[#000000]/25 border-b border-dashed border-[#ffd400]/40 flex items-center justify-center">
                <span className="text-[10px] font-mono text-[#ffd400] font-bold tracking-wider">
                  TOP BAR SAFE ZONE
                </span>
              </div>

              {/* Right Action Buttons Safe Margin */}
              <div className="absolute top-[10%] right-0 bottom-[22%] w-[16%] bg-[#000000]/20 border-l border-dashed border-[#ffd400]/40 flex items-center justify-center">
                <span className="text-[9px] font-mono text-[#ffd400] font-bold rotate-90 whitespace-nowrap">
                  UI BUTTONS
                </span>
              </div>

              {/* Bottom Caption Safe Margin */}
              <div className="absolute bottom-0 left-0 right-0 h-[22%] bg-[#000000]/25 border-t border-dashed border-[#ffd400]/40 flex items-center justify-center">
                <span className="text-[10px] font-mono text-[#ffd400] font-bold tracking-wider">
                  CAPTION / SOUND SAFE ZONE
                </span>
              </div>
            </div>
          )}

          {/* Grid Lines Overlay (Rule-of-Thirds) */}
          {gridOverlay && (
            <div className="absolute inset-0 pointer-events-none z-10 grid grid-cols-3 grid-rows-3">
              <div className="border-r border-b border-white/20" />
              <div className="border-r border-b border-white/20" />
              <div className="border-b border-white/20" />
              <div className="border-r border-b border-white/20" />
              <div className="border-r border-b border-white/20" />
              <div className="border-b border-white/20" />
              <div className="border-r border-white/20" />
              <div className="border-r border-white/20" />
              <div />
            </div>
          )}

          {/* Quick Play/Pause Big Center Indicator when paused */}
          {!isPlaying && (
            <div 
              onClick={onTogglePlay}
              className="absolute inset-0 flex items-center justify-center bg-[#000000]/25 backdrop-blur-[1px] cursor-pointer"
            >
              <div className="w-16 h-16 rounded-full bg-[#ffd400] text-[#09090b] flex items-center justify-center shadow-2xl transform transition-transform hover:scale-110 active:scale-95">
                <Play size={28} className="translate-x-0.5 fill-current" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transport Controls Bar */}
      <div className="h-12 bg-[#121215] border-t border-[#27272a] px-4 flex items-center justify-between text-[#e4e4e7] flex-shrink-0 z-20">
        {/* Left: Timecode & Skip */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 font-mono text-xs font-bold text-[#ffd400] bg-[#18181b] px-2.5 py-1 rounded-lg border border-[#27272a]">
            <span>{formatTimecode(currentTime)}</span>
            <span className="text-[#71717a]">/</span>
            <span className="text-[#a1a1aa]">{formatTimecode(totalDuration)}</span>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onSeek(0)}
              className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b] transition-colors"
              title="Jump to Start (Home)"
            >
              <SkipBack size={13} />
            </button>
            <button
              onClick={() => onSeek(Math.max(0, currentTime - 1.0))}
              className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b] transition-colors"
              title="Step Backward -1.0s (Left Arrow)"
            >
              <ChevronLeft size={15} />
            </button>
          </div>
        </div>

        {/* Center: Main Play/Pause Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePlay}
            className="w-9 h-9 rounded-full bg-[#ffd400] hover:bg-[#ffe14d] text-[#09090b] flex items-center justify-center shadow-lg shadow-[#ffd400]/20 transition-transform active:scale-95 cursor-pointer font-bold"
            title="Play / Pause (Spacebar)"
          >
            {isPlaying ? (
              <Pause size={16} className="fill-current" />
            ) : (
              <Play size={16} className="translate-x-0.5 fill-current" />
            )}
          </button>

          <button
            onClick={() => onSeek(Math.min(totalDuration, currentTime + 1.0))}
            className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b] transition-colors"
            title="Step Forward +1.0s (Right Arrow)"
          >
            <ChevronRight size={15} />
          </button>

          <button
            onClick={() => onSeek(totalDuration)}
            className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b] transition-colors"
            title="Jump to End"
          >
            <SkipForward size={13} />
          </button>
        </div>

        {/* Right: Loop, Speed, Volume & Fullscreen */}
        <div className="flex items-center gap-3">
          {/* Loop toggle */}
          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              isLooping
                ? 'bg-[#ffd400]/15 text-[#ffd400]'
                : 'text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b]'
            }`}
            title="Toggle Continuous Timeline Loop"
          >
            <Repeat size={13} />
          </button>

          {/* Speed Selector */}
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            className="bg-[#18181b] border border-[#27272a] text-[11px] font-mono text-[#e4e4e7] rounded-lg px-2 py-1 outline-none cursor-pointer"
          >
            <option value={0.5}>0.5x</option>
            <option value={0.75}>0.75x</option>
            <option value={1.0}>1.0x (Normal)</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
            <option value={2.0}>2.0x</option>
          </select>

          {/* Volume Slider */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
            >
              {isMuted || volume === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              className="w-16 accent-[#ffd400] cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
