import React, { useState } from 'react';
import { ImageIcon, Wand2, X, Check, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { createStyledCanvasImage } from '../utils/audio';

interface ImageGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneIndex: number;
  sceneTitle: string;
  onApplyImage: (sceneIndex: number, imageUrl: string, imageName: string) => void;
}

const COLOR_PALETTES: Array<{ name: string; a: [string, string]; b: [string, string]; cA: string; cB: string }> = [
  { name: 'Cyber Indigo & Neon', a: ['#0f172a', '#1e293b'], b: ['#1e1b4b', '#312e81'], cA: '#38bdf8', cB: '#818cf8' },
  { name: 'Warm Sunset Glow', a: ['#451a03', '#78350f'], b: ['#701a75', '#86198f'], cA: '#fbbf24', cB: '#f43f5e' },
  { name: 'Emerald Forest & Deep Moss', a: ['#064e3b', '#065f46'], b: ['#14532d', '#166534'], cA: '#34d399', cB: '#4ade80' },
  { name: 'Cinematic Charcoal & Gold', a: ['#18181b', '#27272a'], b: ['#1c1917', '#292524'], cA: '#ffd400', cB: '#fb923c' }
];

export const ImageGeneratorModal: React.FC<ImageGeneratorModalProps> = ({
  isOpen,
  onClose,
  sceneIndex,
  sceneTitle,
  onApplyImage
}) => {
  const [prompt, setPrompt] = useState(sceneTitle || 'Cinematic futuristic city street at night with neon lights');
  const [selectedPalette, setSelectedPalette] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [previews, setPreviews] = useState<{ imgA?: { url: string; name: string }; imgB?: { url: string; name: string } }>({});
  const [selectedVariation, setSelectedVariation] = useState<'A' | 'B'>('A');

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const pal = COLOR_PALETTES[selectedPalette];
      const imgA = await createStyledCanvasImage(prompt, 'A', pal.a, pal.cA);
      const imgB = await createStyledCanvasImage(prompt, 'B', pal.b, pal.cB);

      setPreviews({
        imgA: { url: imgA.url, name: `Visual A - ${prompt.slice(0, 20)}` },
        imgB: { url: imgB.url, name: `Visual B - ${prompt.slice(0, 20)}` }
      });
    } catch (e) {
      console.error('Image generation error:', e);
    } finally {
      setGenerating(false);
    }
  };

  const handleApply = () => {
    const chosen = selectedVariation === 'A' ? previews.imgA : previews.imgB;
    if (!chosen) return;
    onApplyImage(sceneIndex, chosen.url, chosen.name);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div className="bg-[#121215] border border-[#27272a] rounded-2xl w-full max-w-lg p-6 shadow-2xl text-[#e4e4e7]">
        <div className="flex items-center justify-between pb-4 border-b border-[#27272a] mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[#ffd400]/15 flex items-center justify-center text-[#ffd400]">
              <ImageIcon size={16} />
            </div>
            <h3 className="font-bold text-sm text-[#f4f4f5]">
              Generate Visual for Scene #{sceneIndex + 1}
            </h3>
          </div>
          <button onClick={onClose} className="text-[#a1a1aa] hover:text-[#f4f4f5]">
            <X size={18} />
          </button>
        </div>

        {/* Visual Prompt Input */}
        <div className="space-y-1 mb-4">
          <label className="text-[11px] text-[#a1a1aa] font-medium">Visual Concept Prompt</label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Deep blue ocean trench with glowing bioluminescent creatures..."
            className="w-full p-2 bg-[#18181b] border border-[#27272a] focus:border-[#ffd400] rounded-lg text-xs text-[#f4f4f5] outline-none"
          />
        </div>

        {/* Palette Selector */}
        <div className="mb-4">
          <label className="text-[11px] font-medium text-[#a1a1aa] block mb-2">
            Atmospheric Color Theme
          </label>
          <div className="grid grid-cols-2 gap-2">
            {COLOR_PALETTES.map((pal, idx) => (
              <button
                key={pal.name}
                onClick={() => setSelectedPalette(idx)}
                className={`flex items-center gap-2 p-2 rounded-xl border text-xs text-left transition-all cursor-pointer ${
                  selectedPalette === idx
                    ? 'bg-[#18181b] border-[#ffd400] text-[#f4f4f5] ring-1 ring-[#ffd400]/40'
                    : 'bg-[#09090b] border-[#27272a] text-[#a1a1aa] hover:border-[#3f3f46]'
                }`}
              >
                <div className="flex -space-x-1">
                  <div className="w-3.5 h-3.5 rounded-full border border-black" style={{ background: pal.cA }} />
                  <div className="w-3.5 h-3.5 rounded-full border border-black" style={{ background: pal.cB }} />
                </div>
                <span className="truncate font-semibold">{pal.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Candidate Previews */}
        {previews.imgA && previews.imgB ? (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div
              onClick={() => setSelectedVariation('A')}
              className={`relative rounded-xl overflow-hidden border aspect-9/14 cursor-pointer transition-all ${
                selectedVariation === 'A'
                  ? 'border-[#ffd400] ring-2 ring-[#ffd400]'
                  : 'border-[#27272a] opacity-75'
              }`}
            >
              <img src={previews.imgA.url} alt="Variation A" className="w-full h-full object-cover" />
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 text-[#ffd400] font-mono text-[10px] font-bold">
                VARIATION A
              </span>
            </div>

            <div
              onClick={() => setSelectedVariation('B')}
              className={`relative rounded-xl overflow-hidden border aspect-9/14 cursor-pointer transition-all ${
                selectedVariation === 'B'
                  ? 'border-[#ffd400] ring-2 ring-[#ffd400]'
                  : 'border-[#27272a] opacity-75'
              }`}
            >
              <img src={previews.imgB.url} alt="Variation B" className="w-full h-full object-cover" />
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 text-[#ffd400] font-mono text-[10px] font-bold">
                VARIATION B
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 bg-[#09090b] rounded-xl border border-[#27272a] mb-5 text-center">
            <Wand2 size={24} className="text-[#ffd400] mb-2" />
            <p className="text-xs text-[#a1a1aa]">
              Click Generate to create 2 distinct visual compositions.
            </p>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs bg-[#18181b] text-[#f4f4f5] border border-[#27272a] hover:border-[#ffd400] flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {generating ? (
              <>
                <Loader2 size={14} className="animate-spin text-[#ffd400]" /> Generating...
              </>
            ) : (
              <>
                <RefreshCw size={14} /> {previews.imgA ? 'Regenerate' : 'Generate Visuals'}
              </>
            )}
          </button>

          {previews.imgA && (
            <button
              onClick={handleApply}
              className="py-2.5 px-6 rounded-xl font-bold text-xs bg-[#ffd400] text-[#09090b] hover:bg-[#ffe14d] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-[#ffd400]/20"
            >
              <Check size={14} strokeWidth={2.5} /> Apply to Scene #{sceneIndex + 1}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
