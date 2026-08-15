import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, Scissors, Check, RefreshCw } from 'lucide-react';
import type { AudioItem } from '../types';
import { decodeAudioFromFile } from '../utils/audio';

interface AudioTrimModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioItem: AudioItem | null;
  lineNum: number | null;
  onSave: (lineNum: number, startTime: number, endTime: number) => void;
}

export const AudioTrimModal: React.FC<AudioTrimModalProps> = ({
  isOpen,
  onClose,
  audioItem,
  lineNum,
  onSave
}) => {
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTimeoutRef = useRef<number | null>(null);

  // Initialize and load audio
  useEffect(() => {
    if (!isOpen || !audioItem) return;
    
    // Set initial bounds
    const initialStart = audioItem.startTime ?? 0;
    const initialEnd = audioItem.endTime ?? audioItem.duration;
    
    setStartTime(initialStart);
    setEndTime(initialEnd);
    setBuffer(null);
    setIsLoading(true);

    if (audioItem.file) {
      decodeAudioFromFile(audioItem.file).then(buf => {
        setBuffer(buf);
        setIsLoading(false);
      }).catch(err => {
        console.error("Error decoding audio for trim modal", err);
        setIsLoading(false);
      });
    }
  }, [isOpen, audioItem]);

  // Clean up playback on unmount or close
  useEffect(() => {
    if (!isOpen) {
      stopPlayback();
    }
    return () => {
      stopPlayback();
    };
  }, [isOpen]);

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
    }
    setIsPlaying(false);
  };

  // Draw waveform
  useEffect(() => {
    if (!buffer || !canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Responsive width based on container
    const width = containerRef.current.clientWidth;
    const height = 120;
    
    canvas.width = width;
    canvas.height = height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw background for waveform area
    ctx.fillStyle = '#1b1e27';
    ctx.fillRect(0, 0, width, height);

    const data = buffer.getChannelData(0);
    // Draw the waveform (downsampled for performance)
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.fillStyle = '#38bdf8'; // Base waveform color

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      
      const x = i;
      const y = (1 + min) * amp;
      const h = Math.max(1, (max - min) * amp);
      
      ctx.fillRect(x, y, 1, h);
    }

    // Overlay shading for out-of-bounds regions (before startTime, after endTime)
    const totalDuration = buffer.duration;
    const startX = (startTime / totalDuration) * width;
    const endX = (endTime / totalDuration) * width;

    // Dim the excluded regions
    ctx.fillStyle = 'rgba(20, 22, 30, 0.75)'; 
    ctx.fillRect(0, 0, startX, height);
    ctx.fillRect(endX, 0, width - endX, height);

    // Draw boundary lines (handles)
    ctx.fillStyle = '#ffd400';
    ctx.fillRect(startX - 1, 0, 2, height);
    ctx.fillRect(endX - 1, 0, 2, height);
    
    // Draw active region border top/bottom
    ctx.fillStyle = '#ffd400';
    ctx.fillRect(startX, 0, endX - startX, 2);
    ctx.fillRect(startX, height - 2, endX - startX, 2);

  }, [buffer, startTime, endTime]);

  const handlePlayPreview = () => {
    if (!audioItem || !audioItem.url) return;
    
    if (isPlaying) {
      stopPlayback();
      return;
    }

    const audio = new Audio(audioItem.url);
    audioRef.current = audio;
    audio.currentTime = startTime;
    
    audio.play().catch(console.error);
    setIsPlaying(true);

    const playDuration = Math.max(0.1, endTime - startTime) * 1000;
    
    playTimeoutRef.current = window.setTimeout(() => {
      audio.pause();
      setIsPlaying(false);
    }, playDuration);

    audio.onended = () => {
      setIsPlaying(false);
    };
  };

  const handleSave = () => {
    if (lineNum !== null) {
      onSave(lineNum, startTime, endTime);
    }
  };

  if (!isOpen || !audioItem) return null;

  const totalDuration = buffer?.duration || audioItem.duration;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#181a22] border border-[#2e3444] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e3444] bg-[#1d202b]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30">
              <Scissors size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#edeef2] font-['Space_Grotesk']">
                Trim Voice Audio
              </h3>
              <p className="text-xs text-[#8a8fa0] mt-0.5">
                Line {lineNum} • Adjust exact start and end points
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8a8fa0] hover:text-[#edeef2] hover:bg-[#2e3444] rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 bg-[#14161e] flex flex-col gap-6">
          
          {/* Waveform Visualization */}
          <div className="relative border border-[#2e3444] rounded-xl overflow-hidden bg-[#1b1e27]" ref={containerRef}>
            {isLoading ? (
              <div className="h-[120px] flex items-center justify-center text-[#8a8fa0] text-sm gap-2">
                <RefreshCw size={16} className="animate-spin text-[#ffd400]" />
                Decoding audio waveform...
              </div>
            ) : (
              <canvas 
                ref={canvasRef} 
                className="w-full block h-[120px] cursor-crosshair"
                onClick={(e) => {
                  // Click to jump nearest handle
                  if (!buffer || !containerRef.current) return;
                  const rect = containerRef.current.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const clickTime = (x / rect.width) * totalDuration;
                  
                  // Move whichever handle is closer
                  const distToStart = Math.abs(clickTime - startTime);
                  const distToEnd = Math.abs(clickTime - endTime);
                  
                  if (distToStart < distToEnd) {
                    setStartTime(Math.max(0, Math.min(clickTime, endTime - 0.1)));
                  } else {
                    setEndTime(Math.max(startTime + 0.1, Math.min(clickTime, totalDuration)));
                  }
                }}
              />
            )}
            
            {/* Range input overlay for easy dragging. We use a trick with CSS to make two ranges overlap 
                but it's often easier to just rely on number inputs or custom logic below. */}
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-mono text-[#8a8fa0] flex justify-between">
                  <span>Start Time</span>
                  <span className="text-[#edeef2]">{startTime.toFixed(2)}s</span>
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max={totalDuration} 
                  step="0.01" 
                  value={startTime} 
                  onChange={(e) => setStartTime(Math.min(parseFloat(e.target.value), endTime - 0.1))}
                  className="w-full accent-[#ffd400]"
                />
              </div>
              
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-mono text-[#8a8fa0] flex justify-between">
                  <span>End Time</span>
                  <span className="text-[#edeef2]">{endTime.toFixed(2)}s</span>
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max={totalDuration} 
                  step="0.01" 
                  value={endTime} 
                  onChange={(e) => setEndTime(Math.max(parseFloat(e.target.value), startTime + 0.1))}
                  className="w-full accent-[#ffd400]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between bg-[#12141a] p-3 rounded-xl border border-[#2e3444]">
              <div className="text-xs font-mono">
                <span className="text-[#8a8fa0]">Trimmed Length: </span>
                <span className="text-[#38bdf8] font-bold">{(endTime - startTime).toFixed(2)}s</span>
              </div>
              <button
                onClick={handlePlayPreview}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  isPlaying 
                    ? 'bg-[#ffd400] text-[#12141a] border-[#ffd400]' 
                    : 'bg-[#232733] hover:bg-[#2d3242] text-[#edeef2] border-[#3e455c]'
                }`}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                {isPlaying ? 'Stop' : 'Play Selection'}
              </button>
            </div>
          </div>
          
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#2e3444] bg-[#1d202b]">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[#232733] hover:bg-[#2e3444] text-[#8a8fa0] hover:text-[#edeef2] text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-[#ffd400] hover:bg-[#ffdf33] text-[#12141a] text-xs font-bold font-['Space_Grotesk'] transition-all shadow-md flex items-center gap-2"
          >
            <Check size={16} />
            Apply Trim
          </button>
        </div>
      </div>
    </div>
  );
};
