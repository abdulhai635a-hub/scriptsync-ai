import React from 'react';
import { 
  X, 
  Sparkles, 
  Flame, 
  Compass, 
  Tv, 
  Rocket, 
  Smartphone,
  Play
} from 'lucide-react';
import type { VideoProjectData } from '../../types';
import { generateDefaultLiveProject } from '../../utils/stockMedia';
import { createStyledCanvasImage } from '../../utils/audio';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (project: VideoProjectData) => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate
}) => {
  if (!isOpen) return null;

  const TEMPLATES = [
    {
      id: 'cyberpunk',
      title: 'Neon Cyberpunk Metropolis',
      category: 'Sci-Fi / Reels',
      ratio: '9:16',
      description: 'Futuristic story with vibrant neon styling, energetic synthwave BGM, and high-impact subtitles.',
      bgGradient: 'from-fuchsia-900 to-indigo-950',
      color: '#ffd400',
      build: () => generateDefaultLiveProject()
    },
    {
      id: 'motivation',
      title: 'Daily High-Performance Routine',
      category: 'Self-Growth / TikTok',
      ratio: '9:16',
      description: 'Punchy typography, motivational orchestral score, and clean high contrast framing.',
      bgGradient: 'from-amber-900 to-stone-950',
      color: '#f59e0b',
      build: () => {
        const base = generateDefaultLiveProject();
        base.title = 'Daily High Performance Routine';
        base.captions = [
          { id: 'c1', num: 1, text: 'Champions are built in the dark when nobody is watching.', startTime: 0, endTime: 3.5, duration: 3.5 },
          { id: 'c2', num: 2, text: 'Every morning you have two choices: sleep with dreams or wake up and chase them.', startTime: 3.5, endTime: 7.0, duration: 3.5 },
          { id: 'c3', num: 3, text: 'Consistency beats motivation every single day. Start right now.', startTime: 7.0, endTime: 10.5, duration: 3.5 }
        ];
        base.scenes[0].title = 'Morning Discipline';
        base.scenes[0].motion = 'zoom-in';
        base.scenes[0].filter = 'vibrant';
        base.scenes[1].title = 'Unwavering Focus';
        base.scenes[1].motion = 'pan-left';
        base.scenes[1].filter = 'warm';
        base.scenes[2].title = 'Relentless Drive';
        base.scenes[2].motion = 'drift';
        base.scenes[2].filter = 'cinematic';
        base.subtitleStyle.textColor = '#ffffff';
        base.subtitleStyle.highlightColor = '#f59e0b';
        return base;
      }
    },
    {
      id: 'deepsea',
      title: 'Deep Ocean Mysteries',
      category: 'Documentary / YouTube',
      ratio: '16:9',
      description: 'Atmospheric slow drift, cinematic teal grade, and mysterious ambient soundtrack.',
      bgGradient: 'from-cyan-950 to-blue-950',
      color: '#38bdf8',
      build: () => {
        const base = generateDefaultLiveProject();
        base.title = 'Secrets of the Mariana Trench';
        base.aspectRatio = '16:9';
        base.captions = [
          { id: 'c1', num: 1, text: 'Beneath seven miles of crushing black ocean lies Earth\'s greatest mystery.', startTime: 0, endTime: 4.0, duration: 4.0 },
          { id: 'c2', num: 2, text: 'Organisms that emit their own surreal bioluminescent light glow in the abyss.', startTime: 4.0, endTime: 8.0, duration: 4.0 },
          { id: 'c3', num: 3, text: 'We know more about the surface of Mars than the bottom of our own oceans.', startTime: 8.0, endTime: 12.0, duration: 4.0 }
        ];
        base.scenes.forEach((s) => {
          s.duration = 4.0;
          s.filter = 'cool';
          s.motion = 'drift';
        });
        base.totalDuration = 12.0;
        base.subtitleStyle.fontFamily = 'Inter';
        base.subtitleStyle.highlightColor = '#38bdf8';
        return base;
      }
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#121215] border border-[#27272a] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col text-[#e4e4e7]">
        {/* Header */}
        <div className="p-4 border-b border-[#27272a] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#ffd400]/15 text-[#ffd400]">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#f4f4f5]">Starter Project Templates</h3>
              <p className="text-[11px] text-[#a1a1aa]">Choose a pre-configured template with assets, audio & styles</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Templates Grid */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          {TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              onClick={() => {
                onSelectTemplate(tmpl.build());
                onClose();
              }}
              className="bg-[#18181b] border border-[#27272a] hover:border-[#ffd400] rounded-xl p-3 flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg group"
            >
              <div>
                <div className={`h-24 rounded-lg bg-gradient-to-br ${tmpl.bgGradient} mb-3 flex items-center justify-center border border-white/10 relative overflow-hidden`}>
                  <div className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play size={16} className="text-white fill-current ml-0.5" />
                  </div>
                  <span className="absolute bottom-1 right-1 text-[9px] font-mono font-bold bg-black/70 px-1.5 py-0.5 rounded text-white">
                    {tmpl.ratio}
                  </span>
                </div>

                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-mono font-bold text-[#ffd400]">
                    {tmpl.category}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-[#f4f4f5] group-hover:text-[#ffd400] transition-colors line-clamp-1">
                  {tmpl.title}
                </h4>
                <p className="text-[10px] text-[#a1a1aa] mt-1 line-clamp-3 leading-relaxed">
                  {tmpl.description}
                </p>
              </div>

              <button className="w-full mt-3 py-1.5 rounded-lg bg-[#27272a] group-hover:bg-[#ffd400] group-hover:text-[#09090b] text-xs font-semibold text-[#f4f4f5] transition-colors">
                Load Template
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
