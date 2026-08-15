import React, { useState } from 'react';
import { 
  Sparkles, 
  Wand2, 
  Mic, 
  Image as ImageIcon, 
  FileText, 
  Loader2, 
  Check,
  Zap,
  Volume2
} from 'lucide-react';
import type { SceneClip, CaptionLine, VoiceClip } from '../../types';

interface AIToolsTabProps {
  scenes: SceneClip[];
  captions: CaptionLine[];
  onApplyAIScript: (scriptLines: string[]) => void;
  onOpenImageGenModal: (sceneIndex: number) => void;
  onAlignAudioWithGemini: () => Promise<void>;
  isAligning: boolean;
}

export const AIToolsTab: React.FC<AIToolsTabProps> = ({
  scenes,
  captions,
  onApplyAIScript,
  onOpenImageGenModal,
  onAlignAudioWithGemini,
  isAligning
}) => {
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('cinematic & suspenseful');
  const [linesCount, setLinesCount] = useState(4);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<string[] | null>(null);

  const handleGenerateScript = async () => {
    setIsGeneratingScript(true);
    try {
      const resp = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim() || 'A breakthrough sci-fi mystery in a cyberpunk metropolis',
          tone: `${tone} with ${linesCount} lines`
        })
      });

      const data = await resp.json();
      if (data.script) {
        const lines = data.script
          .split('\n')
          .map((l: string) => l.replace(/^\d+[\.\)\-]\s*/, '').trim())
          .filter(Boolean);
        setGeneratedScript(lines);
      }
    } catch (e) {
      console.warn('Script gen failed:', e);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleApplyScript = () => {
    if (generatedScript && generatedScript.length > 0) {
      onApplyAIScript(generatedScript);
      setGeneratedScript(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 text-[#e4e4e7] space-y-5">
      {/* Script Generator Card */}
      <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-[#ffd400]/15 text-[#ffd400]">
            <FileText size={14} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#f4f4f5]">AI Script Generator</h4>
            <p className="text-[10px] text-[#a1a1aa]">Powered by Gemini 3.7 Flash</p>
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <label className="text-[11px] text-[#a1a1aa] block mb-1">Story Topic / Theme</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Secrets of the deepest ocean trench..."
              className="w-full p-2 bg-[#09090b] border border-[#27272a] focus:border-[#ffd400] rounded-lg text-xs text-[#f4f4f5] outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-[#a1a1aa] block mb-1">Narration Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full p-1.5 bg-[#09090b] border border-[#27272a] focus:border-[#ffd400] rounded-lg text-xs text-[#f4f4f5] outline-none"
              >
                <option value="cinematic & suspenseful">Cinematic</option>
                <option value="energetic & viral TikTok">Viral TikTok</option>
                <option value="documentary & educational">Documentary</option>
                <option value="mysterious & horror">Mystery / Horror</option>
                <option value="inspirational & motivational">Motivational</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-[#a1a1aa] block mb-1">Lines Count</label>
              <select
                value={linesCount}
                onChange={(e) => setLinesCount(parseInt(e.target.value, 10))}
                className="w-full p-1.5 bg-[#09090b] border border-[#27272a] focus:border-[#ffd400] rounded-lg text-xs text-[#f4f4f5] outline-none"
              >
                <option value={3}>3 Scenes</option>
                <option value={4}>4 Scenes</option>
                <option value={5}>5 Scenes</option>
                <option value={6}>6 Scenes</option>
                <option value={8}>8 Scenes</option>
                <option value={10}>10 Scenes</option>
                <option value={15}>15 Scenes</option>
                <option value={20}>20 Scenes</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerateScript}
            disabled={isGeneratingScript}
            className="w-full py-2 rounded-lg text-xs font-bold bg-[#ffd400] text-[#09090b] hover:bg-[#ffe14d] transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isGeneratingScript ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Writing Story...</span>
              </>
            ) : (
              <>
                <Wand2 size={13} />
                <span>Generate Video Script</span>
              </>
            )}
          </button>
        </div>

        {/* Generated Script Result */}
        {generatedScript && (
          <div className="pt-2 border-t border-[#27272a] space-y-2">
            <p className="text-[11px] font-bold text-[#ffd400]">Generated Story Draft:</p>
            <div className="space-y-1 bg-[#09090b] p-2 rounded-lg text-[11px] font-mono text-[#e4e4e7]">
              {generatedScript.map((l, i) => (
                <p key={i}>
                  <span className="text-[#ffd400]">#{i + 1}</span> {l}
                </p>
              ))}
            </div>

            <button
              onClick={handleApplyScript}
              className="w-full py-1.5 rounded-lg text-xs font-bold bg-[#10b981] text-white hover:bg-[#059669] transition-colors flex items-center justify-center gap-1.5"
            >
              <Check size={13} />
              <span>Apply Story to Timeline</span>
            </button>
          </div>
        )}
      </div>

      {/* AI Voice Alignment */}
      <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-[#38bdf8]/15 text-[#38bdf8]">
            <Mic size={14} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#f4f4f5]">AI Speech Alignment</h4>
            <p className="text-[10px] text-[#a1a1aa]">Matches voice spoken cadence to subtitle cuts</p>
          </div>
        </div>

        <button
          onClick={onAlignAudioWithGemini}
          disabled={isAligning}
          className="w-full py-2 rounded-lg text-xs font-bold bg-[#27272a] hover:bg-[#3f3f46] text-[#ffd400] transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {isAligning ? (
            <>
              <Loader2 size={13} className="animate-spin text-[#ffd400]" />
              <span>Aligning Audio Cadence...</span>
            </>
          ) : (
            <>
              <Zap size={13} />
              <span>Auto-Align All Timestamps</span>
            </>
          )}
        </button>
      </div>

      {/* AI Image Generation */}
      <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-[#a855f7]/15 text-[#a855f7]">
            <ImageIcon size={14} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#f4f4f5]">AI Visual Generator</h4>
            <p className="text-[10px] text-[#a1a1aa]">Create scene visual backgrounds with prompts</p>
          </div>
        </div>

        <button
          onClick={() => onOpenImageGenModal(0)}
          className="w-full py-2 rounded-lg text-xs font-bold bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] hover:text-[#ffd400] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Sparkles size={13} className="text-[#ffd400]" />
          <span>Open Visual Generator</span>
        </button>
      </div>
    </div>
  );
};
