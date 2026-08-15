import React from 'react';
import { 
  Sparkles, 
  Sliders, 
  Sun, 
  Contrast, 
  Eye, 
  Compass, 
  Tv, 
  Flame,
  Check
} from 'lucide-react';
import type { FilterType, MotionType, SceneClip } from '../../types';

interface EffectsTabProps {
  selectedScene: SceneClip | null;
  selectedSceneIndex: number | null;
  onUpdateScene: (index: number, partial: Partial<SceneClip>) => void;
  onApplyFilterToAll: (filter: FilterType) => void;
  onApplyMotionToAll: (motion: MotionType) => void;
}

export const EffectsTab: React.FC<EffectsTabProps> = ({
  selectedScene,
  selectedSceneIndex,
  onUpdateScene,
  onApplyFilterToAll,
  onApplyMotionToAll
}) => {
  const filterOptions: Array<{ id: FilterType; name: string; desc: string }> = [
    { id: 'none', name: 'Original / Clean', desc: 'No color alterations' },
    { id: 'vibrant', name: 'Vibrant Boost', desc: 'Pop colors and rich saturation' },
    { id: 'cinematic', name: 'Cinematic Teal & Orange', desc: 'Hollywood block-buster color grade' },
    { id: 'cyberpunk', name: 'Cyberpunk Neon', desc: 'Electric hue shift & deep blacks' },
    { id: 'noir', name: 'Noir Classic B&W', desc: 'High contrast monochrome' },
    { id: 'vintage', name: 'Vintage 35mm Film', desc: 'Warm nostalgic sepia tone' },
    { id: 'warm', name: 'Golden Hour Glow', desc: 'Warm sunset ambience' },
    { id: 'cool', name: 'Cool Nordic Glacier', desc: 'Crisp blue atmospheric tones' }
  ];

  const motionOptions: Array<{ id: MotionType; name: string; desc: string }> = [
    { id: 'zoom-in', name: 'Ken Burns Zoom In', desc: 'Smooth focal push' },
    { id: 'zoom-out', name: 'Ken Burns Zoom Out', desc: 'Wide contextual reveal' },
    { id: 'pan-left', name: 'Cinematic Pan Left', desc: 'Smooth horizontal glide' },
    { id: 'pan-right', name: 'Cinematic Pan Right', desc: 'Horizontal scan' },
    { id: 'drift', name: 'Organic Floating Drift', desc: 'Subtle vertical & scale float' },
    { id: 'none', name: 'Static Frame', desc: 'Fixed camera framing' }
  ];

  if (!selectedScene || selectedSceneIndex === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-[#a1a1aa] space-y-2">
        <Sparkles size={28} className="text-[#ffd400]" />
        <p className="text-xs font-semibold text-[#f4f4f5]">No Visual Clip Selected</p>
        <p className="text-[11px]">Click on any clip in the timeline or media tab to adjust color grading and motion effects.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 text-[#e4e4e7] space-y-5">
      {/* Active Clip Header */}
      <div className="p-2.5 bg-[#18181b] border border-[#27272a] rounded-xl flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-[#f4f4f5]">Editing: {selectedScene.title}</p>
          <p className="text-[10px] text-[#a1a1aa]">Scene #{selectedScene.num} • {selectedScene.duration.toFixed(1)}s</p>
        </div>
        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#ffd400]/15 text-[#ffd400]">
          Active
        </span>
      </div>

      {/* Color Grading Presets */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#f4f4f5]">
            <Sparkles size={14} className="text-[#ffd400]" />
            <span>Color Grading Filters</span>
          </div>
          <button
            onClick={() => onApplyFilterToAll(selectedScene.filter)}
            className="text-[10px] text-[#ffd400] hover:underline cursor-pointer"
            title="Apply this filter to all scenes in the project"
          >
            Apply to All
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {filterOptions.map((f) => {
            const isSelected = selectedScene.filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => onUpdateScene(selectedSceneIndex, { filter: f.id })}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#ffd400] bg-[#ffd400]/10 ring-1 ring-[#ffd400]/40'
                    : 'border-[#27272a] bg-[#18181b] hover:border-[#3f3f46]'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] font-bold text-[#f4f4f5] truncate">{f.name}</span>
                  {isSelected && <Check size={11} className="text-[#ffd400]" />}
                </div>
                <p className="text-[9px] text-[#a1a1aa] line-clamp-1">{f.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ken Burns Motion */}
      <div className="space-y-2.5 pt-1 border-t border-[#27272a]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#f4f4f5]">
            <Compass size={14} className="text-[#ffd400]" />
            <span>Camera Motion (Ken Burns)</span>
          </div>
          <button
            onClick={() => onApplyMotionToAll(selectedScene.motion)}
            className="text-[10px] text-[#ffd400] hover:underline cursor-pointer"
            title="Apply this motion style to all scenes in the project"
          >
            Apply to All
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {motionOptions.map((m) => {
            const isSelected = selectedScene.motion === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onUpdateScene(selectedSceneIndex, { motion: m.id })}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#ffd400] bg-[#ffd400]/10 ring-1 ring-[#ffd400]/40'
                    : 'border-[#27272a] bg-[#18181b] hover:border-[#3f3f46]'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] font-bold text-[#f4f4f5] truncate">{m.name}</span>
                  {isSelected && <Check size={11} className="text-[#ffd400]" />}
                </div>
                <p className="text-[9px] text-[#a1a1aa] line-clamp-1">{m.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Adjustments Sliders */}
      <div className="space-y-3 pt-1 border-t border-[#27272a]">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#f4f4f5]">
          <Sliders size={14} className="text-[#ffd400]" />
          <span>Manual Color Adjustments</span>
        </div>

        {/* Brightness */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-[#a1a1aa]">
            <span className="flex items-center gap-1"><Sun size={11} /> Brightness</span>
            <span className="font-mono text-[#ffd400]">{selectedScene.brightness ?? 100}%</span>
          </div>
          <input
            type="range"
            min="40"
            max="180"
            value={selectedScene.brightness ?? 100}
            onChange={(e) => onUpdateScene(selectedSceneIndex, { brightness: parseInt(e.target.value, 10) })}
            className="w-full accent-[#ffd400] cursor-pointer"
          />
        </div>

        {/* Contrast */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-[#a1a1aa]">
            <span className="flex items-center gap-1"><Contrast size={11} /> Contrast</span>
            <span className="font-mono text-[#ffd400]">{selectedScene.contrast ?? 100}%</span>
          </div>
          <input
            type="range"
            min="40"
            max="180"
            value={selectedScene.contrast ?? 100}
            onChange={(e) => onUpdateScene(selectedSceneIndex, { contrast: parseInt(e.target.value, 10) })}
            className="w-full accent-[#ffd400] cursor-pointer"
          />
        </div>

        {/* Saturation */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-[#a1a1aa]">
            <span className="flex items-center gap-1"><Flame size={11} /> Saturation</span>
            <span className="font-mono text-[#ffd400]">{selectedScene.saturation ?? 100}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="200"
            value={selectedScene.saturation ?? 100}
            onChange={(e) => onUpdateScene(selectedSceneIndex, { saturation: parseInt(e.target.value, 10) })}
            className="w-full accent-[#ffd400] cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
