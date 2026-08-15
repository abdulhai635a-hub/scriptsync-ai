import React, { useEffect, useRef } from 'react';
import { 
  Download, 
  RotateCcw, 
  Clapperboard, 
  Loader2, 
  Share2, 
  CheckCircle2, 
  Sparkles,
  Play,
  Film,
  ArrowLeft
} from 'lucide-react';

interface StepExportProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  rendering: boolean;
  renderProgress: number;
  videoUrl: string | null;
  onRestart: () => void;
  onBackToStudio?: () => void;
}

export const StepExport: React.FC<StepExportProps> = ({
  canvasRef,
  rendering,
  renderProgress,
  videoUrl,
  onRestart,
  onBackToStudio
}) => {
  return (
    <div className="bg-[#1b1e27] border border-[#2c3140] rounded-2xl p-8 flex flex-col items-center shadow-sm max-w-2xl mx-auto">
      <div className="flex items-center justify-between w-full mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#ffd400]/15 flex items-center justify-center text-[#ffd400]">
            <Film size={18} />
          </div>
          <h3 className="font-['Space_Grotesk'] font-bold text-base text-[#edeef2]">
            {videoUrl ? 'Video Render Complete' : 'Compositing Final Video'}
          </h3>
        </div>

        {onBackToStudio && (
          <button
            onClick={onBackToStudio}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#8a8fa0] bg-[#232733] border border-[#2c3140] hover:text-[#edeef2] transition-colors cursor-pointer"
          >
            <ArrowLeft size={13} />
            <span>Back to Live Studio</span>
          </button>
        )}
      </div>

      {/* 9:16 Canvas / Video Display Frame */}
      <div className="relative w-[280px] sm:w-[320px] aspect-9/16 rounded-2xl overflow-hidden border-2 border-[#2c3140] bg-black shadow-2xl mb-6">
        {/* Render Canvas */}
        <canvas
          ref={canvasRef}
          className={`w-full h-full object-cover ${videoUrl ? 'hidden' : 'block'}`}
        />

        {/* Generated Video Player */}
        {videoUrl && (
          <video
            src={videoUrl}
            controls
            autoPlay
            loop
            className="w-full h-full object-cover"
          />
        )}

        {/* Live rendering overlay */}
        {rendering && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
            <Loader2 size={32} className="text-[#ffd400] animate-spin mb-3" />
            <span className="font-['Space_Grotesk'] font-bold text-sm text-[#edeef2] mb-1">
              Rendering Video Frames
            </span>
            <span className="text-xs text-[#8a8fa0] mb-4">
              Compositing smooth zoom, audio waveforms, and dynamic subtitles...
            </span>

            <div className="w-full h-2 bg-[#232733] rounded-full overflow-hidden border border-[#2c3140]">
              <div
                className="h-full bg-[#ffd400] rounded-full transition-all duration-150"
                style={{ width: `${renderProgress}%` }}
              />
            </div>
            <span className="text-xs font-mono text-[#ffd400] font-bold mt-2">
              {renderProgress}%
            </span>
          </div>
        )}
      </div>

      {/* Action Controls */}
      {videoUrl && !rendering && (
        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          <div className="flex items-center gap-3 w-full">
            <a
              href={videoUrl}
              download="scriptsync_output.webm"
              className="flex-1 py-3 px-6 rounded-full font-['Space_Grotesk'] font-bold text-sm bg-[#ffd400] text-[#1a1500] hover:bg-[#ffe14d] flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 text-center no-underline cursor-pointer"
            >
              <Download size={16} />
              <span>Download WebM Video</span>
            </a>

            <button
              onClick={onRestart}
              className="p-3 rounded-full bg-[#232733] border border-[#2c3140] hover:border-[#ffd400] text-[#edeef2] transition-colors cursor-pointer"
              title="Create another video"
            >
              <RotateCcw size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#37c2b9] font-mono bg-[#37c2b9]/10 px-3.5 py-1.5 rounded-full border border-[#37c2b9]/30">
            <CheckCircle2 size={13} />
            <span>Ready for TikTok, Shorts & Reels</span>
          </div>
        </div>
      )}
    </div>
  );
};
