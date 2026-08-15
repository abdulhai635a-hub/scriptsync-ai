import React, { useState } from 'react';
import { 
  Type, 
  Plus, 
  Trash2, 
  Sparkles, 
  Clock, 
  Split, 
  Play, 
  RotateCcw,
  Wand2,
  Check
} from 'lucide-react';
import type { CaptionLine, SceneClip, VoiceClip } from '../../types';

interface CaptionsTabProps {
  captions: CaptionLine[];
  scenes: SceneClip[];
  voiceClips: Record<number, VoiceClip>;
  selectedCaptionIndex: number | null;
  onSelectCaption: (index: number) => void;
  onUpdateCaption: (index: number, partial: Partial<CaptionLine>) => void;
  onAddCaption: (afterIndex?: number) => void;
  onDeleteCaption: (index: number) => void;
  onBatchUpdateCaptions?: (lines: string[]) => void;
  onAutoSyncCaptionsToScenes: () => void;
  onSeekToTime: (time: number) => void;
  onOpenAIGeneratorModal: () => void;
}

export const CaptionsTab: React.FC<CaptionsTabProps> = ({
  captions,
  scenes,
  voiceClips,
  selectedCaptionIndex,
  onSelectCaption,
  onUpdateCaption,
  onAddCaption,
  onDeleteCaption,
  onBatchUpdateCaptions,
  onAutoSyncCaptionsToScenes,
  onSeekToTime,
  onOpenAIGeneratorModal
}) => {
  const [quickScriptText, setQuickScriptText] = useState('');
  const [showBatchModal, setShowBatchModal] = useState(false);

  const handleBatchImport = () => {
    const rows = quickScriptText
      .split('\n')
      .map((r) => r.replace(/^\d+[\.\)\-]\s*/, '').trim())
      .filter(Boolean);

    if (rows.length === 0) return;

    if (onBatchUpdateCaptions) {
      onBatchUpdateCaptions(rows);
    } else {
      let curStart = 0;
      const avgDuration = 3.2;
      rows.forEach((text, i) => {
        const start = curStart;
        const end = curStart + avgDuration;
        if (i < captions.length) {
          onUpdateCaption(i, { text, startTime: start, endTime: end, duration: avgDuration });
        } else {
          onAddCaption();
        }
        curStart = end;
      });
    }

    setShowBatchModal(false);
    setQuickScriptText('');
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 text-[#e4e4e7] space-y-4">
      {/* Header / Tools */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#f4f4f5]">
          <Type size={14} className="text-[#ffd400]" />
          <span>Captions & Script ({captions.length})</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onAutoSyncCaptionsToScenes}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-[#27272a] hover:bg-[#3f3f46] text-[#ffd400] transition-colors"
            title="Auto-align subtitle timestamps to match scene visual clip lengths"
          >
            <Clock size={10} />
            <span>Auto Sync</span>
          </button>

          <button
            onClick={onOpenAIGeneratorModal}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-[#ffd400]/15 hover:bg-[#ffd400]/25 text-[#ffd400] transition-colors"
            title="Write script with Gemini AI"
          >
            <Wand2 size={10} />
            <span>AI Script</span>
          </button>
        </div>
      </div>

      {/* Batch Import Button */}
      <button
        onClick={() => setShowBatchModal(!showBatchModal)}
        className="w-full py-1.5 px-3 rounded-lg border border-dashed border-[#3f3f46] hover:border-[#ffd400] text-center text-xs text-[#a1a1aa] hover:text-[#ffd400] transition-colors cursor-pointer"
      >
        {showBatchModal ? 'Close Script Editor' : 'Paste Full Script (Numbered/Multi-line)'}
      </button>

      {showBatchModal && (
        <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl space-y-2">
          <textarea
            value={quickScriptText}
            onChange={(e) => setQuickScriptText(e.target.value)}
            placeholder="1. First line of narration...&#10;2. Second line of narration...&#10;3. Third line..."
            rows={5}
            className="w-full p-2 bg-[#09090b] border border-[#27272a] rounded-lg text-xs text-[#f4f4f5] outline-none font-mono resize-none focus:border-[#ffd400]"
          />
          <button
            onClick={handleBatchImport}
            className="w-full py-1.5 rounded-lg text-xs font-bold bg-[#ffd400] text-[#09090b] hover:bg-[#ffe14d] transition-colors cursor-pointer"
          >
            Apply to Captions
          </button>
        </div>
      )}

      {/* Captions List */}
      <div className="space-y-2.5">
        {captions.map((cap, index) => {
          const isSelected = selectedCaptionIndex === index;
          return (
            <div
              key={cap.id || index}
              onClick={() => {
                onSelectCaption(index);
                onSeekToTime(cap.startTime);
              }}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'border-[#ffd400] bg-[#27272a]/95 ring-1 ring-[#ffd400]/40'
                  : 'border-[#27272a] bg-[#18181b] hover:border-[#3f3f46]'
              }`}
            >
              {/* Top row: Number & Timestamps */}
              <div className="flex items-center justify-between text-[11px] font-mono text-[#a1a1aa] mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[#ffd400] bg-[#ffd400]/10 px-1.5 py-0.5 rounded">
                    #{index + 1}
                  </span>
                  <span>
                    {cap.startTime.toFixed(1)}s - {cap.endTime.toFixed(1)}s
                  </span>
                  <span className="text-[10px] text-[#71717a]">
                    ({cap.duration.toFixed(1)}s)
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeekToTime(cap.startTime);
                    }}
                    className="p-1 rounded text-[#a1a1aa] hover:text-[#ffd400] hover:bg-[#3f3f46]"
                    title="Jump playhead to line start"
                  >
                    <Play size={10} />
                  </button>
                  {captions.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCaption(index);
                      }}
                      className="p-1 rounded text-[#a1a1aa] hover:text-[#ef4444] hover:bg-[#ef4444]/10"
                      title="Delete caption line"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              </div>

              {/* Subtitle Textarea */}
              <textarea
                value={cap.text}
                onChange={(e) => onUpdateCaption(index, { text: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                rows={2}
                placeholder="Enter subtitle text..."
                className="w-full p-2 bg-[#09090b]/80 border border-[#27272a] focus:border-[#ffd400] rounded-lg text-xs text-[#f4f4f5] outline-none resize-none"
              />

              {/* Timing Fine Adjustment */}
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#a1a1aa] font-mono">
                <div className="flex items-center gap-1">
                  <span>Start:</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={Number(cap.startTime.toFixed(1))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      onUpdateCaption(index, { 
                        startTime: val, 
                        duration: Math.max(0.5, cap.endTime - val) 
                      });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-12 bg-[#09090b] border border-[#27272a] rounded px-1 text-center text-[#f4f4f5] outline-none"
                  />
                  <span>s</span>
                </div>

                <div className="flex items-center gap-1">
                  <span>End:</span>
                  <input
                    type="number"
                    step="0.1"
                    min={cap.startTime + 0.2}
                    value={Number(cap.endTime.toFixed(1))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || (cap.startTime + 1);
                      onUpdateCaption(index, { 
                        endTime: val, 
                        duration: Math.max(0.5, val - cap.startTime) 
                      });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-12 bg-[#09090b] border border-[#27272a] rounded px-1 text-center text-[#f4f4f5] outline-none"
                  />
                  <span>s</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add New Line Button */}
      <button
        onClick={() => onAddCaption()}
        className="w-full py-2 rounded-xl border border-dashed border-[#3f3f46] hover:border-[#ffd400] bg-[#18181b] hover:bg-[#202025] text-xs font-semibold text-[#ffd400] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
      >
        <Plus size={13} />
        <span>Add New Caption Line</span>
      </button>
    </div>
  );
};
