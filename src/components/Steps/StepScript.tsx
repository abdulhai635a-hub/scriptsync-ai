import React, { useState } from 'react';
import { 
  FileText, 
  ArrowRight, 
  Sparkles, 
  Check, 
  AlertCircle, 
  BookOpen, 
  Loader2,
  Copy
} from 'lucide-react';
import { SAMPLE_SCRIPTS } from '../../utils/sampleData';
import type { ScriptLine } from '../../types';

interface StepScriptProps {
  scriptText: string;
  onChangeScript: (text: string) => void;
  lines: ScriptLine[];
  onParseAndContinue: () => void;
}

export const StepScript: React.FC<StepScriptProps> = ({
  scriptText,
  onChangeScript,
  lines,
  onParseAndContinue
}) => {
  const [generating, setGenerating] = useState(false);
  const [topicPrompt, setTopicPrompt] = useState('');
  const [showAiHelper, setShowAiHelper] = useState(false);

  const handleGenerateAi = async () => {
    setGenerating(true);
    try {
      const resp = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicPrompt || 'A mysterious discovery' })
      });
      const data = await resp.json();
      if (data.script) {
        onChangeScript(data.script);
        setShowAiHelper(false);
      }
    } catch (e) {
      console.error('Script generation error:', e);
    } finally {
      setGenerating(false);
    }
  };

  const lineCount = lines.length;

  return (
    <div className="bg-[#1b1e27] border border-[#2c3140] rounded-2xl p-6 shadow-sm">
      {/* Title & Actions */}
      <div className="flex items-center justify-between pb-4 border-b border-[#2c3140] mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#ffd400]/15 flex items-center justify-center text-[#ffd400]">
            <FileText size={18} />
          </div>
          <div>
            <h2 className="font-['Space_Grotesk'] font-bold text-base text-[#edeef2]">
              01. Numbered Script Editor
            </h2>
            <p className="text-xs text-[#8a8fa0]">
              Every line starts with a serial number (<code className="text-[#ffd400] font-mono">1.</code>, <code className="text-[#ffd400] font-mono">2)</code>, <code className="text-[#ffd400] font-mono">3 -</code>) that links your voice and image assets.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAiHelper(!showAiHelper)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#ffd400] bg-[#ffd400]/10 border border-[#ffd400]/30 hover:bg-[#ffd400]/20 transition-all"
          >
            <Sparkles size={13} />
            <span>Generate with Gemini</span>
          </button>
        </div>
      </div>

      {/* AI Generator Helper Box */}
      {showAiHelper && (
        <div className="p-4 bg-[#232733] border border-[#ffd400]/40 rounded-xl mb-5 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#ffd400] font-mono flex items-center gap-1.5">
              <Sparkles size={14} /> GEMINI SCRIPT ASSISTANT
            </span>
            <button onClick={() => setShowAiHelper(false)} className="text-xs text-[#8a8fa0] hover:text-[#edeef2]">
              Cancel
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={topicPrompt}
              onChange={(e) => setTopicPrompt(e.target.value)}
              placeholder="e.g. A mysterious signal from space, secrets of deep ocean trench, future AI city..."
              className="flex-1 bg-[#12141a] border border-[#2c3140] rounded-lg px-3 py-2 text-xs text-[#edeef2] outline-none focus:border-[#ffd400]"
              onKeyDown={(e) => e.key === 'Enter' && handleGenerateAi()}
            />
            <button
              onClick={handleGenerateAi}
              disabled={generating}
              className="px-4 py-2 rounded-lg font-['Space_Grotesk'] font-bold text-xs bg-[#ffd400] text-[#1a1500] hover:bg-[#ffe14d] flex items-center gap-1.5 shrink-0 transition-all"
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              <span>Generate</span>
            </button>
          </div>
        </div>
      )}

      {/* Script Textarea */}
      <div className="relative mb-4">
        <textarea
          value={scriptText}
          onChange={(e) => onChangeScript(e.target.value)}
          placeholder={`1. The village was quiet, streets empty under the moonlight.\n2. Then a light flickered in the old tower window.\n3. Something was awake inside.`}
          className="w-full min-h-[220px] bg-[#232733] border border-[#2c3140] rounded-xl p-4 text-xs font-mono text-[#edeef2] outline-none focus:border-[#ffd400] transition-colors resize-y leading-relaxed"
        />

        {/* Floating line count badge */}
        <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md bg-[#12141a]/90 border border-[#2c3140] text-[11px] font-mono text-[#8a8fa0] flex items-center gap-1.5 backdrop-blur-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#37c2b9]" />
          <span>{lineCount} {lineCount === 1 ? 'line' : 'lines'} detected</span>
        </div>
      </div>

      {/* Sample Presets */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="text-xs text-[#8a8fa0] font-mono flex items-center gap-1 mr-1">
          <BookOpen size={12} /> Presets:
        </span>
        {SAMPLE_SCRIPTS.map((preset) => (
          <button
            key={preset.title}
            onClick={() => onChangeScript(preset.text)}
            className="px-2.5 py-1 rounded-md bg-[#232733] border border-[#2c3140] hover:border-[#ffd400]/50 text-[11px] text-[#edeef2] transition-colors"
          >
            {preset.title}
          </button>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between pt-4 border-t border-[#2c3140]">
        <div className="text-xs text-[#8a8fa0] flex items-center gap-1.5">
          <Check size={14} className="text-[#37c2b9]" />
          <span>Auto-synchronizes serial IDs with uploaded assets in step 2</span>
        </div>

        <button
          onClick={onParseAndContinue}
          disabled={!scriptText.trim() || lineCount === 0}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-['Space_Grotesk'] font-bold text-sm bg-[#ffd400] text-[#1a1500] hover:bg-[#ffe14d] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md active:scale-95"
        >
          <span>Parse & Continue</span>
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
};
