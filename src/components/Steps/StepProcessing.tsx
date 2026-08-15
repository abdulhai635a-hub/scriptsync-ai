import React from 'react';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';

interface StepProcessingProps {
  progress: number;
  label: string;
}

export const StepProcessing: React.FC<StepProcessingProps> = ({ progress, label }) => {
  return (
    <div className="bg-[#1b1e27] border border-[#2c3140] rounded-2xl p-10 flex flex-col items-center justify-center min-h-[340px] text-center shadow-sm">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-[#ffd400]/10 border border-[#ffd400]/30 flex items-center justify-center">
          <Wand2 size={28} className="text-[#ffd400] animate-pulse" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#12141a] border border-[#2c3140] flex items-center justify-center">
          <Loader2 size={13} className="text-[#ffd400] animate-spin" />
        </div>
      </div>

      <h3 className="font-['Space_Grotesk'] font-bold text-lg text-[#edeef2] mb-1">
        Gemini 2.5 Flash Visual Matching
      </h3>
      <p className="text-xs text-[#8a8fa0] max-w-sm mb-6">
        Analyzing visual subjects, lighting, composition, and emotional alignment against each narration line.
      </p>

      {/* Current Task Description */}
      <div className="px-4 py-2 rounded-xl bg-[#232733] border border-[#2c3140] text-xs text-[#edeef2] font-mono mb-5 max-w-md truncate">
        {label || 'Evaluating visual candidates...'}
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-sm flex flex-col gap-2">
        <div className="w-full h-2.5 bg-[#232733] rounded-full overflow-hidden border border-[#2c3140] p-0.5">
          <div
            className="h-full bg-[#ffd400] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] font-mono text-[#8a8fa0]">
          <span>Processing script lines</span>
          <span className="text-[#ffd400] font-bold">{progress}%</span>
        </div>
      </div>
    </div>
  );
};
