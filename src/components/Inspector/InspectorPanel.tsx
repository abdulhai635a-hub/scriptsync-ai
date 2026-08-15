import React, { useRef } from 'react';
import { 
  Sliders, 
  Trash2, 
  Copy, 
  Scissors, 
  Sparkles, 
  Sun, 
  Contrast, 
  Flame, 
  Compass, 
  Layers, 
  Type, 
  Maximize2,
  Minimize2,
  Clock,
  Wand2,
  Film
} from 'lucide-react';
import type { 
  SceneClip, 
  CaptionLine, 
  SubtitleStyleConfig, 
  BgmTrackConfig, 
  AspectRatioType, 
  FilterType, 
  MotionType 
} from '../../types';

interface InspectorPanelProps {
  selectedSceneIndex: number | null;
  selectedCaptionIndex: number | null;
  scenes: SceneClip[];
  captions: CaptionLine[];
  subtitleStyle: SubtitleStyleConfig;
  bgm: BgmTrackConfig;
  aspectRatio: AspectRatioType;
  onUpdateScene: (index: number, partial: Partial<SceneClip>) => void;
  onUpdateCaption: (index: number, partial: Partial<CaptionLine>) => void;
  onChangeStyle: (partial: Partial<SubtitleStyleConfig>) => void;
  onDeleteScene: (index: number) => void;
  onDuplicateScene: (index: number) => void;
  onOpenImageGenModal: (sceneIndex: number) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedSceneIndex,
  selectedCaptionIndex,
  scenes,
  captions,
  subtitleStyle,
  bgm,
  aspectRatio,
  onUpdateScene,
  onUpdateCaption,
  onChangeStyle,
  onDeleteScene,
  onDuplicateScene,
  onOpenImageGenModal
}) => {
  const replaceFileRef = useRef<HTMLInputElement>(null);

  const activeScene = selectedSceneIndex !== null ? scenes[selectedSceneIndex] : null;
  const activeCaption = selectedCaptionIndex !== null ? captions[selectedCaptionIndex] : null;

  const handleReplaceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || selectedSceneIndex === null) return;
    const url = URL.createObjectURL(file);
    onUpdateScene(selectedSceneIndex, {
      imageUrl: url,
      imageName: file.name,
      imageFile: file
    });
    e.target.value = '';
  };

  return (
    <aside className="w-72 h-full border-l border-[#27272a] bg-[#121215] flex flex-col text-[#e4e4e7] select-none z-20 overflow-y-auto p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#f4f4f5]">
          <Sliders size={14} className="text-[#ffd400]" />
          <span>Properties Inspector</span>
        </div>
        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#27272a] text-[#ffd400]">
          {activeScene ? `Scene #${activeScene.num}` : activeCaption ? `Caption #${selectedCaptionIndex! + 1}` : 'Project'}
        </span>
      </div>

      {/* 1. SCENE CLIP PROPERTIES */}
      {activeScene && selectedSceneIndex !== null ? (
        <div className="space-y-4">
          {/* Thumbnail & Quick Actions */}
          <div className="relative rounded-xl overflow-hidden border border-[#27272a] bg-[#09090b] group">
            <img
              src={activeScene.imageUrl}
              alt={activeScene.title}
              className="w-full h-32 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2 justify-between">
              <span className="text-[11px] font-bold text-white truncate max-w-[140px]">
                {activeScene.title}
              </span>
              <span className="text-[10px] font-mono text-[#ffd400] bg-black/60 px-1.5 py-0.5 rounded">
                {activeScene.duration.toFixed(1)}s
              </span>
            </div>
          </div>

          <input
            type="file"
            ref={replaceFileRef}
            onChange={handleReplaceFile}
            accept="image/*"
            className="hidden"
          />

          {/* Action Row */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => replaceFileRef.current?.click()}
              className="py-1.5 px-2 rounded-lg bg-[#18181b] hover:bg-[#27272a] text-[11px] font-semibold text-[#e4e4e7] hover:text-[#ffd400] border border-[#27272a] transition-colors"
            >
              Replace
            </button>
            <button
              onClick={() => onOpenImageGenModal(selectedSceneIndex)}
              className="py-1.5 px-2 rounded-lg bg-[#ffd400]/10 hover:bg-[#ffd400]/20 text-[11px] font-semibold text-[#ffd400] border border-[#ffd400]/30 transition-colors flex items-center justify-center gap-1"
            >
              <Wand2 size={11} />
              <span>AI Gen</span>
            </button>
            <button
              onClick={() => onDuplicateScene(selectedSceneIndex)}
              className="py-1.5 px-2 rounded-lg bg-[#18181b] hover:bg-[#27272a] text-[11px] font-semibold text-[#e4e4e7] border border-[#27272a] transition-colors flex items-center justify-center gap-1"
            >
              <Copy size={11} />
              <span>Dup</span>
            </button>
          </div>

          {/* Title Edit */}
          <div className="space-y-1">
            <label className="text-[11px] text-[#a1a1aa] font-medium">Scene Title</label>
            <input
              type="text"
              value={activeScene.title}
              onChange={(e) => onUpdateScene(selectedSceneIndex, { title: e.target.value })}
              className="w-full p-2 bg-[#18181b] border border-[#27272a] focus:border-[#ffd400] rounded-lg text-xs text-[#f4f4f5] outline-none"
            />
          </div>

          {/* Duration Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-[#a1a1aa]">
              <span>Clip Duration</span>
              <span className="font-mono text-[#ffd400]">{activeScene.duration.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="15.0"
              step="0.1"
              value={activeScene.duration}
              onChange={(e) => onUpdateScene(selectedSceneIndex, { duration: parseFloat(e.target.value) })}
              className="w-full accent-[#ffd400] cursor-pointer"
            />
          </div>

          {/* Ken Burns Motion */}
          <div className="space-y-1">
            <label className="text-[11px] text-[#a1a1aa] font-medium">Motion Effect</label>
            <select
              value={activeScene.motion}
              onChange={(e) => onUpdateScene(selectedSceneIndex, { motion: e.target.value as MotionType })}
              className="w-full p-2 bg-[#18181b] border border-[#27272a] focus:border-[#ffd400] rounded-lg text-xs text-[#f4f4f5] outline-none"
            >
              <option value="zoom-in">Ken Burns Zoom In</option>
              <option value="zoom-out">Ken Burns Zoom Out</option>
              <option value="pan-left">Cinematic Pan Left</option>
              <option value="pan-right">Cinematic Pan Right</option>
              <option value="drift">Organic Floating Drift</option>
              <option value="none">Static Framing</option>
            </select>
          </div>

          {/* Fit Mode */}
          <div className="space-y-1">
            <label className="text-[11px] text-[#a1a1aa] font-medium">Framing / Fit</label>
            <div className="grid grid-cols-3 gap-1">
              {(['cover', 'contain', 'fill'] as const).map((fit) => (
                <button
                  key={fit}
                  onClick={() => onUpdateScene(selectedSceneIndex, { fit })}
                  className={`py-1 text-[10px] font-semibold rounded capitalize border transition-all ${
                    activeScene.fit === fit
                      ? 'border-[#ffd400] bg-[#ffd400]/15 text-[#ffd400]'
                      : 'border-[#27272a] bg-[#18181b] text-[#a1a1aa]'
                  }`}
                >
                  {fit}
                </button>
              ))}
            </div>
          </div>

          {/* Transition */}
          <div className="space-y-1">
            <label className="text-[11px] text-[#a1a1aa] font-medium">Transition to Next</label>
            <select
              value={activeScene.transition}
              onChange={(e) => onUpdateScene(selectedSceneIndex, { transition: e.target.value as any })}
              className="w-full p-2 bg-[#18181b] border border-[#27272a] focus:border-[#ffd400] rounded-lg text-xs text-[#f4f4f5] outline-none"
            >
              <option value="cross-fade">Smooth Cross-Fade</option>
              <option value="fade-black">Dip to Black</option>
              <option value="slide-left">Whip Slide Left</option>
              <option value="slide-up">Whip Slide Up</option>
              <option value="zoom">Dynamic Zoom Cut</option>
              <option value="none">Direct Hard Cut</option>
            </select>
          </div>

          {/* Delete Scene Button */}
          {scenes.length > 1 && (
            <button
              onClick={() => onDeleteScene(selectedSceneIndex)}
              className="w-full py-2 rounded-lg bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-xs font-semibold text-[#ef4444] border border-[#ef4444]/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-4"
            >
              <Trash2 size={13} />
              <span>Delete Scene Clip</span>
            </button>
          )}
        </div>
      ) : activeCaption && selectedCaptionIndex !== null ? (
        /* 2. CAPTION PROPERTIES */
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] text-[#a1a1aa] font-medium">Subtitle Narration</label>
            <textarea
              value={activeCaption.text}
              onChange={(e) => onUpdateCaption(selectedCaptionIndex, { text: e.target.value })}
              rows={3}
              className="w-full p-2 bg-[#18181b] border border-[#27272a] focus:border-[#ffd400] rounded-lg text-xs text-[#f4f4f5] outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] text-[#a1a1aa]">Start Time (s)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={Number(activeCaption.startTime.toFixed(1))}
                onChange={(e) => onUpdateCaption(selectedCaptionIndex, { startTime: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 bg-[#18181b] border border-[#27272a] rounded-lg text-xs text-[#f4f4f5] outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-[#a1a1aa]">End Time (s)</label>
              <input
                type="number"
                step="0.1"
                min={activeCaption.startTime + 0.2}
                value={Number(activeCaption.endTime.toFixed(1))}
                onChange={(e) => onUpdateCaption(selectedCaptionIndex, { endTime: parseFloat(e.target.value) || (activeCaption.startTime + 1) })}
                className="w-full p-2 bg-[#18181b] border border-[#27272a] rounded-lg text-xs text-[#f4f4f5] outline-none"
              />
            </div>
          </div>
        </div>
      ) : (
        /* 3. GLOBAL PROJECT PROPERTIES */
        <div className="space-y-4">
          <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#f4f4f5]">
              <Film size={14} className="text-[#ffd400]" />
              <span>Project Summary</span>
            </div>
            <div className="text-[11px] space-y-1 text-[#a1a1aa]">
              <div className="flex justify-between">
                <span>Aspect Ratio:</span>
                <span className="font-mono text-[#ffd400]">{aspectRatio}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Clips:</span>
                <span className="font-mono text-[#ffd400]">{scenes.length} Scenes</span>
              </div>
              <div className="flex justify-between">
                <span>Captions:</span>
                <span className="font-mono text-[#ffd400]">{captions.length} Lines</span>
              </div>
              <div className="flex justify-between">
                <span>BGM Track:</span>
                <span className="font-mono text-[#ffd400]">{bgm.enabled ? bgm.title : 'None'}</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-[#71717a] text-center">
            Click on any timeline clip or caption to adjust its individual properties.
          </p>
        </div>
      )}
    </aside>
  );
};
