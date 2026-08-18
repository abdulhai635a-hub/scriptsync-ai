import React from 'react';
import { 
  Palette, 
  Sparkles, 
  Type, 
  Square, 
  Check,
  AlignVerticalJustifyCenter,
  MoveVertical,
  Captions,
  CaptionsOff
} from 'lucide-react';
import type { SubtitleStyleConfig, SubtitlePresetType } from '../../types';
import { SUBTITLE_PRESETS } from '../../utils/stockMedia';

interface StyleTabProps {
  style: SubtitleStyleConfig;
  onChangeStyle: (partial: Partial<SubtitleStyleConfig>) => void;
  onApplyPreset: (presetKey: SubtitlePresetType) => void;
}

export const StyleTab: React.FC<StyleTabProps> = ({
  style,
  onChangeStyle,
  onApplyPreset
}) => {
  // Optional in the type so old projects keep their subtitles; only an explicit
  // false counts as off.
  const subtitlesOn = style.enabled !== false;

  const fontOptions = [
    { label: 'Space Grotesk (Modern Display)', value: 'Space Grotesk' },
    { label: 'Inter (Clean Sans)', value: 'Inter' },
    { label: 'JetBrains Mono (Tech / Code)', value: 'JetBrains Mono' },
    { label: 'Impact / Headline Heavy', value: 'Impact' },
    { label: 'Cinematic Movie (Serif)', value: 'Cinzel' },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 text-[#e4e4e7] space-y-5">
      {/* Master on/off. Sits above everything because it decides whether any of
          the settings below apply at all — both in the preview and the export. */}
      <button
        onClick={() => onChangeStyle({ enabled: subtitlesOn ? false : true })}
        className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
          subtitlesOn
            ? 'border-[#ffd400]/50 bg-[#ffd400]/10'
            : 'border-[#27272a] bg-[#18181b] hover:border-[#3f3f46]'
        }`}
        title={subtitlesOn ? 'Subtitles are burned into the video' : 'Video will export with no subtitles'}
      >
        <span className="flex items-center gap-2">
          {subtitlesOn
            ? <Captions size={16} className="text-[#ffd400]" />
            : <CaptionsOff size={16} className="text-[#71717a]" />}
          <span className="flex flex-col items-start">
            <span className="text-xs font-bold text-[#f4f4f5]">Subtitles</span>
            <span className="text-[10px] text-[#a1a1aa]">
              {subtitlesOn ? 'Shown in preview and export' : 'Hidden everywhere — clean video'}
            </span>
          </span>
        </span>

        <span
          className={`relative w-10 h-[22px] rounded-full transition-colors shrink-0 ${
            subtitlesOn ? 'bg-[#ffd400]' : 'bg-[#3f3f46]'
          }`}
        >
          <span
            className={`absolute top-[3px] w-4 h-4 rounded-full bg-white transition-all ${
              subtitlesOn ? 'left-[21px]' : 'left-[3px]'
            }`}
          />
        </span>
      </button>

      {/* Everything below only matters while subtitles are on. */}
      <div className={subtitlesOn ? '' : 'opacity-40 pointer-events-none select-none'}>
      {/* Preset Cards Grid */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#f4f4f5] mb-2.5">
          <Sparkles size={14} className="text-[#ffd400]" />
          <span>Subtitle Style Presets</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {Object.entries(SUBTITLE_PRESETS).map(([key, data]) => {
            const isCurrent = style.preset === key;
            return (
              <button
                key={key}
                onClick={() => onApplyPreset(key as SubtitlePresetType)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isCurrent
                    ? 'border-[#ffd400] bg-[#ffd400]/10 ring-1 ring-[#ffd400]/40'
                    : 'border-[#27272a] bg-[#18181b] hover:border-[#3f3f46]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[#f4f4f5] truncate">
                    {data.name}
                  </span>
                  {isCurrent && <Check size={12} className="text-[#ffd400]" />}
                </div>
                <p className="text-[10px] text-[#a1a1aa] line-clamp-2 leading-snug">
                  {data.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Animation & Word Display Flow */}
      <div className="space-y-3 pt-1 border-t border-[#27272a]">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#f4f4f5]">
          <Sparkles size={14} className="text-[#ffd400]" />
          <span>Subtitle Animation & Display</span>
        </div>

        {/* Animation Picker */}
        <div className="space-y-1">
          <label className="text-[11px] text-[#a1a1aa] font-medium">Caption Animation</label>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'pop', label: '🔥 Pop & Bounce' },
              { id: 'word-glow', label: '✨ Karaoke Glow' },
              { id: 'bounce', label: '⚡ Dynamic Bounce' },
              { id: 'wave', label: '🌊 Harmonic Wave' },
              { id: 'slide-up', label: '🎬 Cinematic Slide' },
              { id: 'typewriter', label: '⌨️ Typewriter' },
              { id: 'fade', label: '🌫️ Smooth Fade' },
              { id: 'none', label: '⏹️ Static' }
            ].map((anim) => (
              <button
                key={anim.id}
                onClick={() => onChangeStyle({ animation: anim.id as any })}
                className={`px-2 py-1.5 rounded-lg border text-left text-[11px] font-medium transition-all ${
                  style.animation === anim.id
                    ? 'border-[#ffd400] bg-[#ffd400]/20 text-[#ffd400] font-bold'
                    : 'border-[#27272a] bg-[#18181b] text-[#d4d4d8] hover:border-[#3f3f46]'
                }`}
              >
                {anim.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Sentence & Word Chunking (3-6 Words max) */}
        <div className="space-y-2 pt-2 border-t border-[#27272a]/60">
          <div className="flex items-center justify-between">
            <label className="text-[11px] text-[#a1a1aa] font-medium">Display Pacing (3-6 Words)</label>
            <span className="text-[10px] font-mono text-[#ffd400] bg-[#27272a] px-1.5 py-0.5 rounded">
              {style.chunkMode === 'smart-dynamic' || !style.chunkMode
                ? 'Dynamic (3-6 words)'
                : style.chunkMode.replace('-', ' ')}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {[
              { id: 'smart-dynamic', label: 'Dynamic 3-6' },
              { id: '3-words', label: '3 Words' },
              { id: '4-words', label: '4 Words' },
              { id: '5-words', label: '5 Words' },
              { id: '6-words', label: '6 Words' },
              { id: 'full', label: 'Full Line' }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => onChangeStyle({ chunkMode: m.id as any })}
                className={`py-1 px-1.5 rounded-md border text-[10px] text-center font-medium transition-colors ${
                  (style.chunkMode || 'smart-dynamic') === m.id
                    ? 'border-[#ffd400] bg-[#ffd400]/20 text-[#ffd400] font-bold'
                    : 'border-[#27272a] bg-[#18181b] text-[#a1a1aa] hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[#71717a] leading-tight">
            Limits subtitle display to punchy 3, 4, 5, or 6 word bursts (never &gt; 6 words).
          </p>
        </div>
      </div>

      {/* Typography & Font Settings */}
      <div className="space-y-3 pt-1 border-t border-[#27272a]">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#f4f4f5]">
          <Type size={14} className="text-[#ffd400]" />
          <span>Typography & Text</span>
        </div>

        {/* Font Family */}
        <div className="space-y-1">
          <label className="text-[11px] text-[#a1a1aa] font-medium">Font Family</label>
          <select
            value={style.fontFamily}
            onChange={(e) => onChangeStyle({ fontFamily: e.target.value })}
            className="w-full bg-[#18181b] border border-[#27272a] focus:border-[#ffd400] text-xs text-[#f4f4f5] rounded-lg p-2 outline-none"
          >
            {fontOptions.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Font Size Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-[#a1a1aa]">
            <span>Font Size</span>
            <span className="font-mono text-[#ffd400]">{style.fontSize}px</span>
          </div>
          <input
            type="range"
            min="20"
            max="64"
            value={style.fontSize}
            onChange={(e) => onChangeStyle({ fontSize: parseInt(e.target.value, 10) })}
            className="w-full accent-[#ffd400] cursor-pointer"
          />
        </div>

        {/* Text Transform Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-[11px] text-[#a1a1aa]">Text Casing</label>
          <div className="flex bg-[#18181b] p-0.5 rounded-lg border border-[#27272a]">
            {(['none', 'uppercase', 'capitalize'] as const).map((t) => (
              <button
                key={t}
                onClick={() => onChangeStyle({ textTransform: t })}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded capitalize ${
                  style.textTransform === t
                    ? 'bg-[#ffd400] text-[#09090b]'
                    : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Colors & Stroke */}
      <div className="space-y-3 pt-1 border-t border-[#27272a]">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#f4f4f5]">
          <Palette size={14} className="text-[#ffd400]" />
          <span>Colors & Outline</span>
        </div>

        {/* Text Color & Highlight Color */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[11px] text-[#a1a1aa]">Text Color</label>
            <div className="flex items-center gap-2 bg-[#18181b] border border-[#27272a] p-1.5 rounded-lg">
              <input
                type="color"
                value={style.textColor}
                onChange={(e) => onChangeStyle({ textColor: e.target.value })}
                className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
              />
              <span className="text-[11px] font-mono text-[#f4f4f5]">{style.textColor}</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-[#a1a1aa]">Highlight Glow</label>
            <div className="flex items-center gap-2 bg-[#18181b] border border-[#27272a] p-1.5 rounded-lg">
              <input
                type="color"
                value={style.highlightColor}
                onChange={(e) => onChangeStyle({ highlightColor: e.target.value })}
                className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
              />
              <span className="text-[11px] font-mono text-[#f4f4f5]">{style.highlightColor}</span>
            </div>
          </div>
        </div>

        {/* Stroke Width Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-[#a1a1aa]">
            <span>Outline Stroke Width</span>
            <span className="font-mono text-[#ffd400]">{style.strokeWidth}px</span>
          </div>
          <input
            type="range"
            min="0"
            max="8"
            value={style.strokeWidth}
            onChange={(e) => onChangeStyle({ strokeWidth: parseInt(e.target.value, 10) })}
            className="w-full accent-[#ffd400] cursor-pointer"
          />
        </div>
      </div>

      {/* Box Container & Position */}
      <div className="space-y-3 pt-1 border-t border-[#27272a]">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#f4f4f5]">
          <MoveVertical size={14} className="text-[#ffd400]" />
          <span>Layout & Position</span>
        </div>

        {/* Position Y Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-[#a1a1aa]">
            <span>Vertical Position</span>
            <span className="font-mono text-[#ffd400]">{style.positionY}%</span>
          </div>
          <input
            type="range"
            min="15"
            max="88"
            value={style.positionY}
            onChange={(e) => onChangeStyle({ positionY: parseInt(e.target.value, 10) })}
            className="w-full accent-[#ffd400] cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-[#71717a]">
            <span>Top</span>
            <span>Center</span>
            <span>Bottom (Reels)</span>
          </div>
        </div>

        {/* Background Box Pill */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="chkBox"
              checked={style.hasBox}
              onChange={(e) => onChangeStyle({ hasBox: e.target.checked })}
              className="accent-[#ffd400] w-4 h-4 rounded cursor-pointer"
            />
            <label htmlFor="chkBox" className="text-xs text-[#f4f4f5] font-medium cursor-pointer">
              Background Pill Container
            </label>
          </div>
        </div>

        {style.hasBox && (
          <div className="space-y-2 pl-6">
            <div className="flex justify-between text-[11px] text-[#a1a1aa]">
              <span>Box Opacity</span>
              <span className="font-mono">{Math.round(style.boxOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.05"
              value={style.boxOpacity}
              onChange={(e) => onChangeStyle({ boxOpacity: parseFloat(e.target.value) })}
              className="w-full accent-[#ffd400] cursor-pointer"
            />
          </div>
        )}
      </div>
    </div>
    </div>
  );
};
