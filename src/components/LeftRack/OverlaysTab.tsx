import React from 'react';
import { 
  Layers, 
  Sparkles, 
  Clock, 
  Activity, 
  Tag, 
  Bookmark,
  Check
} from 'lucide-react';
import type { OverlayConfig } from '../../types';

interface OverlaysTabProps {
  overlays: OverlayConfig;
  onChangeOverlays: (partial: Partial<OverlayConfig>) => void;
}

export const OverlaysTab: React.FC<OverlaysTabProps> = ({
  overlays,
  onChangeOverlays
}) => {
  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 text-[#e4e4e7] space-y-5">
      {/* Progress Bar Overlay */}
      <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-[#ffd400]" />
            <span className="text-xs font-bold text-[#f4f4f5]">Bottom Progress Bar</span>
          </div>

          <input
            type="checkbox"
            checked={overlays.showProgressBar}
            onChange={(e) => onChangeOverlays({ showProgressBar: e.target.checked })}
            className="accent-[#ffd400] w-4 h-4 rounded cursor-pointer"
          />
        </div>

        {overlays.showProgressBar && (
          <div className="space-y-2 pt-1 border-t border-[#27272a]">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-[#a1a1aa]">Bar Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={overlays.progressBarColor}
                  onChange={(e) => onChangeOverlays({ progressBarColor: e.target.value })}
                  className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer"
                />
                <span className="text-[10px] font-mono text-[#ffd400]">{overlays.progressBarColor}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Watermark Branding */}
      <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag size={14} className="text-[#ffd400]" />
            <span className="text-xs font-bold text-[#f4f4f5]">Studio Watermark</span>
          </div>

          <input
            type="checkbox"
            checked={overlays.showWatermark}
            onChange={(e) => onChangeOverlays({ showWatermark: e.target.checked })}
            className="accent-[#ffd400] w-4 h-4 rounded cursor-pointer"
          />
        </div>

        {overlays.showWatermark && (
          <div className="space-y-2 pt-1 border-t border-[#27272a]">
            <label className="text-[11px] text-[#a1a1aa]">Watermark Text</label>
            <input
              type="text"
              value={overlays.watermarkText}
              onChange={(e) => onChangeOverlays({ watermarkText: e.target.value })}
              placeholder="@YOUR_HANDLE or BRAND"
              className="w-full p-2 bg-[#09090b] border border-[#27272a] focus:border-[#ffd400] rounded-lg text-xs text-[#f4f4f5] outline-none font-mono"
            />
          </div>
        )}
      </div>

      {/* Call to Action Badge */}
      <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark size={14} className="text-[#ffd400]" />
            <span className="text-xs font-bold text-[#f4f4f5]">Call-to-Action Badge</span>
          </div>

          <input
            type="checkbox"
            checked={overlays.showCtaBadge}
            onChange={(e) => onChangeOverlays({ showCtaBadge: e.target.checked })}
            className="accent-[#ffd400] w-4 h-4 rounded cursor-pointer"
          />
        </div>

        {overlays.showCtaBadge && (
          <div className="space-y-2.5 pt-1 border-t border-[#27272a]">
            <div>
              <label className="text-[11px] text-[#a1a1aa]">Badge Text</label>
              <input
                type="text"
                value={overlays.ctaText}
                onChange={(e) => onChangeOverlays({ ctaText: e.target.value })}
                placeholder="FOLLOW FOR PART 2"
                className="w-full p-2 bg-[#09090b] border border-[#27272a] focus:border-[#ffd400] rounded-lg text-xs text-[#f4f4f5] outline-none font-bold uppercase"
              />
            </div>

            <div>
              <label className="text-[11px] text-[#a1a1aa] block mb-1">Badge Position</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const).map((pos) => (
                  <button
                    key={pos}
                    onClick={() => onChangeOverlays({ ctaPosition: pos })}
                    className={`py-1 text-[10px] font-semibold rounded capitalize border transition-all ${
                      overlays.ctaPosition === pos
                        ? 'border-[#ffd400] bg-[#ffd400]/15 text-[#ffd400]'
                        : 'border-[#27272a] bg-[#09090b] text-[#a1a1aa] hover:border-[#3f3f46]'
                    }`}
                  >
                    {pos.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
