import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Plus, 
  Scissors, 
  Trash2, 
  Copy, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Type, 
  Film, 
  Mic, 
  Music,
  Clock,
  Sparkles
} from 'lucide-react';
import type { SceneClip, CaptionLine, VoiceClip, BgmTrackConfig } from '../../types';

interface MultiTrackTimelineProps {
  scenes: SceneClip[];
  captions: CaptionLine[];
  voiceClips: Record<number, VoiceClip>;
  bgm: BgmTrackConfig;
  currentTime: number;
  totalDuration: number;
  selectedSceneIndex: number | null;
  selectedCaptionIndex: number | null;
  onSelectScene: (index: number) => void;
  onSelectCaption: (index: number) => void;
  onSeek: (time: number) => void;
  onAddScene: () => void;
  onDuplicateScene: (index: number) => void;
  onDeleteScene: (index: number) => void;
  onSplitSceneAtPlayhead: () => void;
  onUpdateScene: (index: number, partial: Partial<SceneClip>) => void;
  onUpdateCaption: (index: number, partial: Partial<CaptionLine>) => void;
}

export const MultiTrackTimeline: React.FC<MultiTrackTimelineProps> = ({
  scenes,
  captions,
  voiceClips,
  bgm,
  currentTime,
  totalDuration,
  selectedSceneIndex,
  selectedCaptionIndex,
  onSelectScene,
  onSelectCaption,
  onSeek,
  onAddScene,
  onDuplicateScene,
  onDeleteScene,
  onSplitSceneAtPlayhead,
  onUpdateScene,
  onUpdateCaption
}) => {
  // Pixels per second zoom factor (default 70px per second)
  const [zoom, setZoom] = useState(70);
  const [timelineHeight, setTimelineHeight] = useState<'normal' | 'tall'>('normal');
  const timelineTracksRef = useRef<HTMLDivElement>(null);
  const isDraggingPlayheadRef = useRef(false);

  // Drag-to-Resize State
  const [resizeState, setResizeState] = useState<{
    type: 'scene' | 'caption';
    index: number;
    edge: 'left' | 'right' | 'move';
    startX: number;
    initialDuration: number;
    initialStartTime: number;
    initialEndTime: number;
  } | null>(null);

  const resizeStateRef = useRef(resizeState);
  resizeStateRef.current = resizeState;

  // Compute total timeline width in pixels
  const timelineWidth = Math.max(1600, totalDuration * zoom + 500);

  // Fit whole project to current viewport width
  const handleFitTimeline = () => {
    if (!timelineTracksRef.current || totalDuration <= 0) return;
    const availableWidth = timelineTracksRef.current.clientWidth - 100;
    const computedZoom = Math.max(15, Math.min(180, Math.floor(availableWidth / Math.max(1, totalDuration))));
    setZoom(computedZoom);
    if (timelineTracksRef.current) {
      timelineTracksRef.current.scrollLeft = 0;
    }
  };

  // Scroll Timeline Horizontally via Wheel
  const handleTimelineWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!timelineTracksRef.current) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    timelineTracksRef.current.scrollLeft += delta * 0.8;
  };

  // Handle Playhead Scrubbing via Mouse
  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (resizeStateRef.current) return;
    isDraggingPlayheadRef.current = true;
    updatePlayheadFromEvent(e);
  };

  const updatePlayheadFromEvent = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!timelineTracksRef.current) return;
    const rect = timelineTracksRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left + timelineTracksRef.current.scrollLeft;
    const seekTime = Math.max(0, Math.min(totalDuration, offsetX / zoom));
    onSeek(seekTime);
  };

  const handleStartResize = (
    e: React.MouseEvent,
    type: 'scene' | 'caption',
    index: number,
    edge: 'left' | 'right' | 'move'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (type === 'scene' && !scenes[index]) return;
    if (type === 'caption' && !captions[index]) return;

    const initialDuration = type === 'scene' ? (scenes[index]?.duration ?? 3) : (captions[index]?.duration ?? 3);
    const initialStartTime = type === 'scene' ? 0 : (captions[index]?.startTime ?? 0);
    const initialEndTime = type === 'scene' ? (scenes[index]?.duration ?? 3) : (captions[index]?.endTime ?? 3);

    setResizeState({
      type,
      index,
      edge,
      startX: e.clientX,
      initialDuration,
      initialStartTime,
      initialEndTime
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingPlayheadRef.current) {
        updatePlayheadFromEvent(e);
      } else if (resizeStateRef.current) {
        const { type, index, edge, startX, initialDuration, initialStartTime, initialEndTime } = resizeStateRef.current;
        const deltaSec = (e.clientX - startX) / zoom;

        if (type === 'scene') {
          const newDur = Math.max(0.5, Math.min(60, Number((initialDuration + deltaSec).toFixed(2))));
          onUpdateScene(index, { duration: newDur });
        } else if (type === 'caption') {
          if (edge === 'right') {
            const newEnd = Math.max(initialStartTime + 0.3, Number((initialEndTime + deltaSec).toFixed(2)));
            const newDur = Number((newEnd - initialStartTime).toFixed(2));
            onUpdateCaption(index, { endTime: newEnd, duration: newDur });
          } else if (edge === 'left') {
            const newStart = Math.max(0, Math.min(initialEndTime - 0.3, Number((initialStartTime + deltaSec).toFixed(2))));
            const newDur = Number((initialEndTime - newStart).toFixed(2));
            onUpdateCaption(index, { startTime: newStart, duration: newDur });
          } else if (edge === 'move') {
            const newStart = Math.max(0, Number((initialStartTime + deltaSec).toFixed(2)));
            const newEnd = Number((newStart + initialDuration).toFixed(2));
            onUpdateCaption(index, { startTime: newStart, endTime: newEnd });
          }
        }
      }
    };

    const handleMouseUp = () => {
      isDraggingPlayheadRef.current = false;
      if (resizeStateRef.current) {
        setResizeState(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [zoom, totalDuration, onUpdateScene, onUpdateCaption]);

  // Generate ruler tick marks
  const tickCount = Math.ceil(totalDuration) + 6;
  const rulerTicks = Array.from({ length: tickCount }, (_, i) => i);

  // Auto-scroll timeline to follow playhead if playhead moves out of view
  useEffect(() => {
    if (!timelineTracksRef.current || isDraggingPlayheadRef.current || resizeState) return;
    const playheadPx = currentTime * zoom;
    const container = timelineTracksRef.current;
    const scrollLeft = container.scrollLeft;
    const viewWidth = container.clientWidth;

    if (playheadPx < scrollLeft || playheadPx > scrollLeft + viewWidth - 60) {
      container.scrollLeft = Math.max(0, playheadPx - viewWidth / 3);
    }
  }, [currentTime, zoom, resizeState]);

  return (
    <div className={`${timelineHeight === 'tall' ? 'h-80' : 'h-64'} border-t border-[#27272a] bg-[#121215] flex flex-col select-none text-[#e4e4e7] z-20 transition-all duration-150`}>
      {/* Timeline Quick Tools Bar */}
      <div className="h-9 border-b border-[#27272a] bg-[#18181b] px-3 sm:px-4 flex items-center justify-between flex-shrink-0">
        {/* Left: Tools (Add, Split, Duplicate, Delete) */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onAddScene}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-xs font-semibold text-[#ffd400] transition-colors cursor-pointer"
            title="Add new visual clip to timeline end"
          >
            <Plus size={12} />
            <span>Add Clip</span>
          </button>

          <button
            onClick={onSplitSceneAtPlayhead}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-xs font-medium text-[#e4e4e7] hover:text-[#ffd400] transition-colors cursor-pointer"
            title="Split active scene clip at playhead position (Ctrl+K)"
          >
            <Scissors size={12} />
            <span>Split</span>
          </button>

          {selectedSceneIndex !== null && (
            <>
              <button
                onClick={() => onDuplicateScene(selectedSceneIndex)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-xs font-medium text-[#e4e4e7] transition-colors cursor-pointer"
                title="Duplicate selected clip"
              >
                <Copy size={12} />
                <span className="hidden sm:inline">Duplicate</span>
              </button>

              {scenes.length > 1 && (
                <button
                  onClick={() => onDeleteScene(selectedSceneIndex)}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-[#ef4444]/15 hover:bg-[#ef4444]/25 text-xs font-semibold text-[#ef4444] transition-colors cursor-pointer"
                  title="Delete selected clip"
                >
                  <Trash2 size={12} />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Right: Zoom Level, Fit All & Height Toggle */}
        <div className="flex items-center gap-2">
          {/* Fit Entire Timeline Button */}
          <button
            onClick={handleFitTimeline}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#27272a] hover:bg-[#3f3f46] text-[11px] font-mono text-[#ffd400] transition-colors cursor-pointer"
            title="Fit entire project into view"
          >
            <Sparkles size={11} />
            <span>Fit All</span>
          </button>

          {/* Zoom Slider */}
          <div className="flex items-center gap-1 bg-[#121215] px-1.5 py-0.5 rounded border border-[#27272a]">
            <button
              onClick={() => setZoom(Math.max(25, zoom - 15))}
              className="p-1 rounded text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
              title="Zoom out"
            >
              <ZoomOut size={12} />
            </button>
            <input
              type="range"
              min="25"
              max="200"
              value={zoom}
              onChange={(e) => setZoom(parseInt(e.target.value, 10))}
              className="w-14 sm:w-20 accent-[#ffd400] cursor-pointer"
            />
            <span className="text-[10px] font-mono text-[#ffd400] w-8 text-center hidden sm:inline">
              {zoom}px
            </span>
            <button
              onClick={() => setZoom(Math.min(220, zoom + 15))}
              className="p-1 rounded text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
              title="Zoom in"
            >
              <ZoomIn size={12} />
            </button>
          </div>

          {/* Timeline Height Toggle */}
          <button
            onClick={() => setTimelineHeight(timelineHeight === 'normal' ? 'tall' : 'normal')}
            className={`p-1.5 rounded text-xs transition-colors border ${
              timelineHeight === 'tall'
                ? 'border-[#ffd400]/60 bg-[#ffd400]/15 text-[#ffd400]'
                : 'border-[#27272a] bg-[#121215] text-[#a1a1aa] hover:text-white'
            }`}
            title={timelineHeight === 'tall' ? 'Collapse Timeline' : 'Expand Timeline Height'}
          >
            <Maximize2 size={12} />
          </button>
        </div>
      </div>

      {/* Main Track Workspace Area */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Track Headers (Left Static Column) */}
        <div className="w-24 sm:w-28 border-r border-[#27272a] bg-[#151519] flex flex-col flex-shrink-0 z-10">
          {/* Ruler Corner Spacer */}
          <div className="h-6 border-b border-[#27272a] flex items-center px-2 text-[10px] font-mono text-[#71717a]">
            TRACKS
          </div>

          {/* Track 1: Subtitles */}
          <div className="h-10 border-b border-[#27272a] flex items-center px-2 sm:px-2.5 gap-1.5 text-[11px] font-semibold text-[#ffd400] bg-[#18181c]">
            <Type size={12} />
            <span className="truncate">Subtitles</span>
          </div>

          {/* Track 2: Video Visuals */}
          <div className={`${timelineHeight === 'tall' ? 'h-28' : 'h-20'} border-b border-[#27272a] flex items-center px-2 sm:px-2.5 gap-1.5 text-[11px] font-semibold text-[#60a5fa] bg-[#151519] transition-all`}>
            <Film size={12} />
            <span className="truncate">Visuals</span>
          </div>

          {/* Track 3: Voiceover Audio */}
          <div className="h-10 border-b border-[#27272a] flex items-center px-2 sm:px-2.5 gap-1.5 text-[11px] font-semibold text-[#34d399] bg-[#18181c]">
            <Mic size={12} />
            <span className="truncate">Voiceover</span>
          </div>

          {/* Track 4: Background Music */}
          <div className="h-9 flex items-center px-2 sm:px-2.5 gap-1.5 text-[11px] font-semibold text-[#c084fc] bg-[#151519]">
            <Music size={12} />
            <span className="truncate">BGM</span>
          </div>
        </div>

        {/* Scrollable Tracks Area */}
        <div 
          ref={timelineTracksRef}
          onMouseDown={handleTimelineMouseDown}
          onWheel={handleTimelineWheel}
          className="flex-1 overflow-x-auto overflow-y-hidden relative bg-[#09090b] cursor-pointer timeline-scroll"
        >
          <div style={{ width: `${timelineWidth}px` }} className="relative h-full">
            {/* 1. Timecode Ruler */}
            <div className="h-6 border-b border-[#27272a] bg-[#121215] relative flex items-end">
              {rulerTicks.map((sec) => (
                <div
                  key={sec}
                  style={{ left: `${sec * zoom}px` }}
                  className="absolute bottom-0 flex flex-col items-center pointer-events-none"
                >
                  <span className="text-[9px] font-mono text-[#71717a] -translate-x-1/2 mb-0.5">
                    {sec}s
                  </span>
                  <div className="w-[1px] h-2 bg-[#3f3f46]" />
                </div>
              ))}
            </div>

            {/* Red Scrubbing Playhead Needle & Line */}
            <div
              style={{ left: `${currentTime * zoom}px` }}
              className="absolute top-0 bottom-0 w-[2px] bg-[#ffd400] z-30 pointer-events-none shadow-md shadow-[#ffd400]/50"
            >
              {/* Playhead Diamond Header */}
              <div className="w-3.5 h-3.5 bg-[#ffd400] rounded-sm transform -translate-x-[6px] rotate-45 flex items-center justify-center -top-1 absolute shadow-lg" />
            </div>

            {/* TRACK 1: Subtitle Chips with Drag-Resize Handles */}
            <div className="h-10 border-b border-[#27272a] relative bg-[#121215]/50 flex items-center">
              {captions.map((cap, index) => {
                const isSelected = selectedCaptionIndex === index;
                const left = cap.startTime * zoom;
                const width = Math.max(28, cap.duration * zoom);

                return (
                  <div
                    key={cap.id || index}
                    style={{ left: `${left}px`, width: `${width}px` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCaption(index);
                      onSeek(cap.startTime);
                    }}
                    className={`absolute h-7 rounded-md border px-1.5 flex items-center gap-1 text-[10px] font-medium truncate transition-colors group cursor-grab active:cursor-grabbing ${
                      isSelected
                        ? 'border-[#ffd400] bg-[#ffd400]/30 text-[#ffffff] ring-1 ring-[#ffd400]'
                        : 'border-[#ca8a04]/40 bg-[#eab308]/15 text-[#ffd400] hover:bg-[#eab308]/25'
                    }`}
                    title={`#${index + 1}: ${cap.text} (${cap.duration.toFixed(1)}s)`}
                  >
                    {/* Left Trim Handle */}
                    <div
                      onMouseDown={(e) => handleStartResize(e, 'caption', index, 'left')}
                      className="absolute left-0 top-0 bottom-0 w-2 hover:w-2.5 bg-[#ffd400]/60 hover:bg-[#ffd400] cursor-ew-resize rounded-l-sm opacity-0 group-hover:opacity-100 transition-opacity z-20"
                      title="Drag to trim start"
                    />

                    <span className="font-bold pl-1">#{index + 1}</span>
                    <span className="truncate">{cap.text}</span>

                    {/* Right Resize Handle */}
                    <div
                      onMouseDown={(e) => handleStartResize(e, 'caption', index, 'right')}
                      className="absolute right-0 top-0 bottom-0 w-2 hover:w-2.5 bg-[#ffd400]/60 hover:bg-[#ffd400] cursor-ew-resize rounded-r-sm opacity-0 group-hover:opacity-100 transition-opacity z-20"
                      title="Drag to adjust caption duration"
                    />
                  </div>
                );
              })}
            </div>

            {/* TRACK 2: Scene Visual Clips with Interactive Edge Handles */}
            <div className="h-20 border-b border-[#27272a] relative bg-[#151519]/70 flex items-center">
              {(() => {
                let offsetTime = 0;
                return scenes.map((scene, index) => {
                  const isSelected = selectedSceneIndex === index;
                  const left = offsetTime * zoom;
                  const width = Math.max(38, scene.duration * zoom);
                  offsetTime += scene.duration;

                  return (
                    <div
                      key={scene.id || index}
                      style={{ left: `${left}px`, width: `${width}px` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectScene(index);
                        onSeek(left / zoom);
                      }}
                      className={`absolute h-18 rounded-lg border overflow-hidden transition-colors flex items-center group cursor-pointer ${
                        isSelected
                          ? 'border-[#ffd400] bg-[#27272a] ring-2 ring-[#ffd400]'
                          : 'border-[#3b82f6]/40 bg-[#1e293b]/70 hover:border-[#60a5fa]'
                      }`}
                    >
                      {/* Thumbnail background */}
                      <img
                        src={scene.imageUrl}
                        alt={scene.title}
                        className="w-14 h-full object-cover flex-shrink-0 border-r border-[#3f3f46]/40 pointer-events-none"
                      />

                      <div className="flex-1 p-1.5 min-w-0 flex flex-col justify-between h-full pointer-events-none">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-white truncate">
                            #{scene.num} {scene.title}
                          </span>
                          <span className="text-[9px] font-mono text-[#ffd400] bg-black/60 px-1 rounded">
                            {scene.duration.toFixed(1)}s
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-[9px] text-[#93c5fd]">
                          <span className="capitalize">{scene.motion}</span>
                          {scene.filter !== 'none' && <span>• {scene.filter}</span>}
                        </div>
                      </div>

                      {/* Right Edge Resize Handle */}
                      <div
                        onMouseDown={(e) => handleStartResize(e, 'scene', index, 'right')}
                        className="absolute right-0 top-0 bottom-0 w-3 hover:w-3.5 bg-[#ffd400]/40 hover:bg-[#ffd400] cursor-ew-resize flex items-center justify-center rounded-r-lg group-hover:opacity-100 opacity-70 transition-all z-20"
                        title="Drag right edge to stretch or shrink clip duration"
                      >
                        <div className="w-[2px] h-6 bg-[#09090b] rounded-full" />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* TRACK 3: Voiceover Waves */}
            <div className="h-10 border-b border-[#27272a] relative bg-[#121215]/50 flex items-center">
              {(() => {
                let offsetTime = 0;
                return scenes.map((scene, index) => {
                  const left = offsetTime * zoom;
                  const width = Math.max(30, scene.duration * zoom);
                  const voice = voiceClips[scene.num];
                  offsetTime += scene.duration;

                  return (
                    <div
                      key={scene.num}
                      style={{ left: `${left}px`, width: `${width}px` }}
                      className="absolute h-7 rounded-md border border-[#059669]/40 bg-[#10b981]/15 px-2 flex items-center justify-between text-[10px] text-[#34d399] font-mono overflow-hidden"
                    >
                      <span className="truncate">{voice ? voice.name : `Voice #${scene.num}`}</span>
                      <div className="flex items-center gap-0.5 opacity-60">
                        <div className="w-1 h-3 bg-[#34d399] rounded" />
                        <div className="w-1 h-5 bg-[#34d399] rounded" />
                        <div className="w-1 h-2 bg-[#34d399] rounded" />
                        <div className="w-1 h-4 bg-[#34d399] rounded" />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* TRACK 4: Background Music Track */}
            <div className="h-9 relative bg-[#151519]/70 flex items-center">
              {bgm.enabled ? (
                <div
                  style={{ left: '0px', width: `${totalDuration * zoom}px` }}
                  className="absolute h-6 rounded-md border border-[#9333ea]/40 bg-[#a855f7]/15 px-2 flex items-center justify-between text-[10px] text-[#c084fc] font-mono"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Music size={11} />
                    <span className="truncate font-semibold">{bgm.title}</span>
                  </div>
                  <span className="text-[9px] text-[#e9d5ff]">
                    Vol: {Math.round(bgm.volume * 100)}%
                  </span>
                </div>
              ) : (
                <div className="pl-4 text-[10px] text-[#71717a] italic">
                  No Background Music Active
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
