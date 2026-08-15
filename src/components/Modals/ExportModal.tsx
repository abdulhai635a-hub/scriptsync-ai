import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Film, 
  Check, 
  Loader2, 
  Sparkles, 
  Volume2, 
  Smartphone, 
  Monitor,
  Play,
  RotateCcw
} from 'lucide-react';
import type { VideoProjectData } from '../../types';
import { renderVideoProject, type RenderProgress } from '../../utils/exportEngine';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: VideoProjectData;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  project
}) => {
  const [resolution, setResolution] = useState<'1080p' | '720p' | '4k'>('1080p');
  const [fps, setFps] = useState<30 | 60>(30);
  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState<RenderProgress>({
    progress: 0,
    frame: 0,
    totalFrames: 0,
    status: ''
  });
  const [renderedBlobUrl, setRenderedBlobUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartRender = async () => {
    setIsRendering(true);
    setRenderedBlobUrl(null);

    try {
      const result = await renderVideoProject({
        scenes: project.scenes,
        captions: project.captions,
        voiceClips: project.voiceClips,
        bgm: project.bgm,
        subtitleStyle: project.subtitleStyle,
        overlays: project.overlays,
        aspectRatio: project.aspectRatio,
        resolution,
        fps,
        onProgress: (p, frame, totalFrames, status) => {
          setProgress({
            progress: p,
            frame,
            totalFrames,
            status
          });
        }
      });

      setRenderedBlobUrl(result.url);
    } catch (err) {
      console.error('Render error:', err);
      alert('Video export failed. Check browser Web Audio permissions.');
    } finally {
      setIsRendering(false);
    }
  };

  const handleDownload = () => {
    if (!renderedBlobUrl) return;
    const a = document.createElement('a');
    a.href = renderedBlobUrl;
    a.download = `${project.title.replace(/\s+/g, '_')}_${project.aspectRatio}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#121215] border border-[#27272a] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col text-[#e4e4e7]">
        {/* Header */}
        <div className="p-4 border-b border-[#27272a] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#ffd400]/15 text-[#ffd400]">
              <Film size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#f4f4f5]">Export & Render Video</h3>
              <p className="text-[11px] text-[#a1a1aa]">{project.title} • {project.aspectRatio}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {!renderedBlobUrl && !isRendering ? (
            <>
              {/* Settings */}
              <div className="space-y-3">
                {/* Resolution */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#f4f4f5]">Target Resolution</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: '1080p', label: '1080p FHD', sub: 'Recommended' },
                      { id: '720p', label: '720p HD', sub: 'Fast Render' },
                      { id: '4k', label: '4K Ultra', sub: 'Highest Quality' }
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setResolution(item.id as any)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          resolution === item.id
                            ? 'border-[#ffd400] bg-[#ffd400]/10 text-[#ffd400]'
                            : 'border-[#27272a] bg-[#18181b] text-[#e4e4e7] hover:border-[#3f3f46]'
                        }`}
                      >
                        <p className="text-xs font-bold">{item.label}</p>
                        <p className="text-[10px] text-[#a1a1aa]">{item.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Framerate */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#f4f4f5]">Framerate (FPS)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 30, label: '30 FPS', sub: 'Standard Social Media' },
                      { id: 60, label: '60 FPS', sub: 'Ultra Smooth Motion' }
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setFps(item.id as any)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          fps === item.id
                            ? 'border-[#ffd400] bg-[#ffd400]/10 text-[#ffd400]'
                            : 'border-[#27272a] bg-[#18181b] text-[#e4e4e7] hover:border-[#3f3f46]'
                        }`}
                      >
                        <p className="text-xs font-bold">{item.label}</p>
                        <p className="text-[10px] text-[#a1a1aa]">{item.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Project Specs Summary */}
                <div className="p-3 rounded-xl bg-[#18181b] border border-[#27272a] text-xs space-y-1 text-[#a1a1aa]">
                  <div className="flex justify-between">
                    <span>Aspect Ratio:</span>
                    <span className="font-mono text-[#ffd400]">{project.aspectRatio}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Scene Clips:</span>
                    <span className="font-mono text-[#ffd400]">{project.scenes.length} Scenes</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Duration:</span>
                    <span className="font-mono text-[#ffd400]">{project.totalDuration.toFixed(1)}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Audio Mixing:</span>
                    <span className="font-mono text-[#ffd400]">Voiceover + BGM ({project.bgm.title})</span>
                  </div>
                </div>
              </div>

              {/* Render Button */}
              <button
                onClick={handleStartRender}
                className="w-full py-3 rounded-xl bg-[#ffd400] hover:bg-[#ffe14d] text-[#09090b] font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#ffd400]/20 transition-transform active:scale-95 cursor-pointer"
              >
                <Sparkles size={16} />
                <span>Start Video Export</span>
              </button>
            </>
          ) : isRendering ? (
            /* Rendering Progress State */
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#ffd400]/15 text-[#ffd400] flex items-center justify-center mx-auto">
                <Loader2 size={32} className="animate-spin" />
              </div>

              <div>
                <h4 className="text-sm font-bold text-[#f4f4f5]">{progress.message || 'Rendering frames...'}</h4>
                <p className="text-xs text-[#a1a1aa] mt-1 font-mono">
                  Frame {progress.currentFrame} / {progress.totalFrames} ({progress.percent}%)
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#27272a] h-2.5 rounded-full overflow-hidden">
                <div
                  style={{ width: `${progress.percent}%` }}
                  className="bg-[#ffd400] h-full transition-all duration-150"
                />
              </div>

              <p className="text-[11px] text-[#71717a]">
                High quality client-side canvas and Web Audio rendering in progress.
              </p>
            </div>
          ) : (
            /* Render Complete State */
            <div className="space-y-4 py-2 text-center">
              <div className="w-12 h-12 rounded-full bg-[#10b981]/15 text-[#10b981] flex items-center justify-center mx-auto">
                <Check size={24} />
              </div>

              <div>
                <h4 className="text-sm font-bold text-[#f4f4f5]">Video Export Ready!</h4>
                <p className="text-xs text-[#a1a1aa] mt-0.5">Your video has been rendered with full audio.</p>
              </div>

              {/* Video Preview */}
              <div className="rounded-xl overflow-hidden bg-black border border-[#27272a] max-h-60 flex items-center justify-center">
                <video
                  src={renderedBlobUrl!}
                  controls
                  autoPlay
                  className="max-h-56 w-auto"
                />
              </div>

              {/* Download Button */}
              <div className="flex gap-2">
                <button
                  onClick={handleStartRender}
                  className="flex-1 py-2.5 rounded-xl border border-[#27272a] hover:bg-[#18181b] text-xs font-semibold text-[#e4e4e7] flex items-center justify-center gap-1.5"
                >
                  <RotateCcw size={14} />
                  <span>Re-Render</span>
                </button>

                <button
                  onClick={handleDownload}
                  className="flex-2 py-2.5 rounded-xl bg-[#ffd400] hover:bg-[#ffe14d] text-[#09090b] font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#ffd400]/20"
                >
                  <Download size={14} strokeWidth={2.5} />
                  <span>Download Video (.webm)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
