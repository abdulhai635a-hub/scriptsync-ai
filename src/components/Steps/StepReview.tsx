import React, { useState } from 'react';
import { 
  Clapperboard, 
  Sparkles, 
  Check, 
  RefreshCw, 
  Play, 
  Pause, 
  Volume2, 
  ArrowLeft, 
  CheckCircle2,
  Info
} from 'lucide-react';
import type { LineValidation, MatchSelection, AudioItem } from '../../types';

interface StepReviewProps {
  validation: LineValidation[];
  selections: Record<number, MatchSelection>;
  onSwapSelection: (num: number) => void;
  onRenderVideo: () => void;
  onBackToMedia: () => void;
}

export const StepReview: React.FC<StepReviewProps> = ({
  validation,
  selections,
  onSwapSelection,
  onRenderVideo,
  onBackToMedia
}) => {
  const [playingLine, setPlayingLine] = useState<number | null>(null);
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);

  const readyLines = validation.filter((v) => v.ready).sort((a, b) => a.num - b.num);

  const handlePlay = (num: number, audioItem: AudioItem) => {
    if (playingLine === num) {
      audioPlayer?.pause();
      setPlayingLine(null);
      return;
    }
    if (audioPlayer) audioPlayer.pause();
    const a = new Audio(audioItem.url);
    if (audioItem.startTime !== undefined && !audioItem.isMasterTrackSlice) {
      a.currentTime = audioItem.startTime;
    }
    a.play();
    a.onended = () => setPlayingLine(null);
    setAudioPlayer(a);
    setPlayingLine(num);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Review Header Banner */}
      <div className="bg-[#1b1e27] border border-[#2c3140] rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#37c2b9]/15 flex items-center justify-center text-[#37c2b9]">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h3 className="font-['Space_Grotesk'] font-bold text-base text-[#edeef2]">
              AI Image Selection & Review
            </h3>
            <p className="text-xs text-[#8a8fa0]">
              Gemini analyzed and selected the best candidate for each line. Tap any candidate image to manually override.
            </p>
          </div>
        </div>

        <button
          onClick={onBackToMedia}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#8a8fa0] bg-[#232733] border border-[#2c3140] hover:text-[#edeef2] transition-colors"
        >
          <ArrowLeft size={13} />
          <span>Edit Assets</span>
        </button>
      </div>

      {/* Lines Review Cards */}
      <div className="flex flex-col gap-4">
        {readyLines.map((v) => {
          const sel = selections[v.num] || { index: 0, confidence: 0.8, reason: 'Candidate A', method: 'fallback', needsReview: false };
          const chosenImage = v.images[sel.index];

          return (
            <div
              key={v.num}
              className="bg-[#1b1e27] border border-[#2c3140] rounded-2xl p-5 flex flex-col md:flex-row gap-5 shadow-sm"
            >
              {/* Line Meta & Audio */}
              <div className="flex flex-col justify-between md:w-1/3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-9 h-7 rounded-md bg-[#232733] border border-[#2c3140] text-xs font-mono font-bold text-[#ffd400] flex items-center justify-center">
                      {String(v.num).padStart(3, '0')}
                    </span>
                    <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-[#ffd400]/10 text-[#ffd400] border border-[#ffd400]/30 font-bold">
                      {sel.method === 'ai' ? 'Gemini Matched' : sel.method === 'manual' ? 'Manual Override' : 'Selected'}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-[#edeef2] leading-relaxed mb-3">
                    "{v.text}"
                  </p>
                </div>

                {/* Voice player & duration */}
                <div className="flex items-center gap-2 pt-2 border-t border-[#2c3140]/60">
                  <button
                    onClick={() => handlePlay(v.num, v.audio!)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#232733] border border-[#2c3140] hover:border-[#ffd400] text-xs font-medium text-[#edeef2] transition-colors"
                  >
                    {playingLine === v.num ? <Pause size={13} className="text-[#ffd400]" /> : <Play size={13} className="text-[#ffd400]" />}
                    <span>Voiceover ({v.audio?.duration.toFixed(1)}s)</span>
                  </button>
                </div>
              </div>

              {/* Candidate Images Comparison */}
              <div className="flex-1 flex flex-col justify-between">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {v.images.map((img, idx) => {
                    const isSelected = idx === sel.index;
                    return (
                      <button
                        key={idx}
                        onClick={() => !isSelected && onSwapSelection(v.num)}
                        className={`relative rounded-xl overflow-hidden aspect-9/14 bg-black border-2 transition-all group text-left cursor-pointer ${
                          isSelected
                            ? 'border-[#ffd400] ring-2 ring-[#ffd400]/30 shadow-lg scale-[1.01]'
                            : 'border-[#2c3140] opacity-45 hover:opacity-85 hover:border-[#8a8fa0]'
                        }`}
                      >
                        <img
                          src={img.url}
                          alt={`Candidate ${idx === 0 ? 'A' : 'B'}`}
                          className="w-full h-full object-cover"
                        />

                        {/* Top Badge */}
                        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-xs text-[10px] font-mono font-bold text-[#edeef2]">
                          <span>{idx === 0 ? 'CANDIDATE A' : 'CANDIDATE B'}</span>
                        </div>

                        {/* Selected Indicator Badge */}
                        {isSelected ? (
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#ffd400] text-[#12141a] flex items-center justify-center shadow-md">
                            <Check size={14} className="stroke-[3]" />
                          </div>
                        ) : (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="px-3 py-1 rounded-full bg-black/80 text-xs font-semibold text-[#ffd400] border border-[#ffd400]/40">
                              Choose this
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* AI Reasoning notes */}
                <div className="p-3 bg-[#232733] border border-[#2c3140] rounded-xl flex items-center justify-between text-xs text-[#8a8fa0] gap-3">
                  <div className="flex items-center gap-2 truncate">
                    <Sparkles size={13} className="text-[#ffd400] shrink-0" />
                    <span className="truncate">
                      <strong className="text-[#edeef2] font-medium">AI Reasoning:</strong> {sel.reason || 'Optimal thematic alignment'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                    <span>Confidence:</span>
                    <span className="text-[#37c2b9] font-bold">
                      {Math.round((sel.confidence || 0.85) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Render Final Video Button */}
      <div className="flex justify-end pt-3">
        <button
          onClick={onRenderVideo}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-['Space_Grotesk'] font-bold text-sm bg-[#ffd400] text-[#1a1500] hover:bg-[#ffe14d] transition-all shadow-lg active:scale-95"
        >
          <Clapperboard size={18} />
          <span>Render Final Video (9:16)</span>
        </button>
      </div>
    </div>
  );
};
