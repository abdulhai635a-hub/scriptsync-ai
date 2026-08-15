import React, { useState } from 'react';
import { 
  Mic, 
  Image as ImageIcon, 
  Check, 
  X, 
  AlertTriangle, 
  Upload, 
  Wand2, 
  Play, 
  Pause, 
  Sparkles,
  Info,
  Layers,
  Clock,
  Loader2,
  CheckCircle2,
  Scissors
} from 'lucide-react';
import type { LineValidation, AudioItem, ImageItem } from '../../types';

interface StepMediaProps {
  validation: LineValidation[];
  allReady: boolean;
  readyCount: number;
  audioMap: Record<number, AudioItem>;
  imageMap: Record<number, ImageItem[]>;
  audioIssues: Array<{ name: string; reason: string }>;
  imageIssues: Array<{ name: string; reason: string }>;
  duplicates: Array<{ num: number; text: string }>;
  gaps: number[];
  extraAudio: number[];
  extraImages: number[];
  isSyncingVoice?: boolean;
  syncStatus?: string;
  onUploadAudio: (files: FileList) => void;
  onUploadImages: (files: FileList) => void;
  onRemoveAudio: (num: number) => void;
  onClearImages: (num: number) => void;
  onRunMatching: () => void;
  onOpenRecorder: (lineNum: number, lineText: string) => void;
  onOpenImageGen: (lineNum: number, lineText: string) => void;
  onOpenAudioTrimmer?: (lineNum: number) => void;
}

export const StepMedia: React.FC<StepMediaProps> = ({
  validation,
  allReady,
  readyCount,
  audioMap,
  imageMap,
  audioIssues,
  imageIssues,
  duplicates,
  gaps,
  extraAudio,
  extraImages,
  isSyncingVoice = false,
  syncStatus = '',
  onUploadAudio,
  onUploadImages,
  onRemoveAudio,
  onClearImages,
  onRunMatching,
  onOpenRecorder,
  onOpenImageGen,
  onOpenAudioTrimmer
}) => {
  const [dragAudio, setDragAudio] = useState(false);
  const [dragImage, setDragImage] = useState(false);
  const [playingLine, setPlayingLine] = useState<number | null>(null);
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);

  const handlePlayAudio = (num: number, audioItem: AudioItem) => {
    if (playingLine === num) {
      audioPlayer?.pause();
      if ((window as any)._audioPlayTimeout) clearTimeout((window as any)._audioPlayTimeout);
      setPlayingLine(null);
      return;
    }
    if (audioPlayer) {
      audioPlayer.pause();
      if ((window as any)._audioPlayTimeout) clearTimeout((window as any)._audioPlayTimeout);
    }
    
    if (!audioItem.url) return;
    
    const audio = new Audio(audioItem.url);
    const start = audioItem.startTime || 0;
    const end = audioItem.endTime || audioItem.duration;

    audio.currentTime = start;
    audio.play().catch(err => console.error("Audio play error:", err));
    
    const durationMs = (end - start) * 1000;
    (window as any)._audioPlayTimeout = setTimeout(() => {
      audio.pause();
      setPlayingLine(null);
    }, durationMs);

    audio.onended = () => {
      if ((window as any)._audioPlayTimeout) clearTimeout((window as any)._audioPlayTimeout);
      setPlayingLine(null);
    };
    setAudioPlayer(audio);
    setPlayingLine(num);
  };

  const totalImageCount = Object.values(imageMap).reduce((a: number, arr: ImageItem[]) => a + (arr ? arr.length : 0), 0);
  const totalAudioCount = Object.keys(audioMap).length;
  const hasIssues = duplicates.length > 0 || gaps.length > 0 || audioIssues.length > 0 || imageIssues.length > 0 || extraAudio.length > 0 || extraImages.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Auto-Sync Audio Status Message Banner */}
      {(isSyncingVoice || syncStatus) && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-md transition-all animate-in fade-in ${
          isSyncingVoice 
            ? 'bg-[#1e2333] border-[#ffd400]/40 text-[#ffd400]' 
            : 'bg-[#1b2725] border-[#37c2b9]/40 text-[#37c2b9]'
        }`}>
          <div className="flex items-center gap-3">
            {isSyncingVoice ? (
              <Loader2 size={20} className="animate-spin text-[#ffd400]" />
            ) : (
              <CheckCircle2 size={20} className="text-[#37c2b9]" />
            )}
            <div>
              <div className="text-xs font-bold font-mono tracking-wide uppercase">
                {isSyncingVoice ? 'Auto-Sync & Speech Slicing in Progress' : 'Voice Narration Auto-Synced'}
              </div>
              <p className="text-xs text-[#edeef2] mt-0.5">
                {syncStatus || 'Matching spoken words and cutting exact voice segments for each script line...'}
              </p>
            </div>
          </div>
          {isSyncingVoice && (
            <span className="text-[11px] font-mono font-bold px-2 py-1 rounded bg-[#ffd400]/20 text-[#ffd400]">
              AUTO CUTTING
            </span>
          )}
        </div>
      )}

      {/* Dropzones Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Voice Dropzone with Automatic Alignment & Cut on Upload */}
        <DropzoneCard
          icon={<Mic size={18} className="text-[#ffd400]" />}
          title="Voice Narration Audio"
          badgeText={isSyncingVoice ? 'Auto Syncing...' : `${totalAudioCount} / ${validation.length} lines`}
          badgeOk={totalAudioCount >= validation.length && validation.length > 0}
          hint="Upload 1 master audio voiceover or individual voice clips. When uploaded, voice is automatically cut to match each script line and sets each image's duration!"
          active={dragAudio}
          setActive={setDragAudio}
          accept="audio/*"
          isLoading={isSyncingVoice}
          onFiles={(files) => {
            onUploadAudio(files);
          }}
        />

        {/* Image Dropzone */}
        <DropzoneCard
          icon={<ImageIcon size={18} className="text-[#ffd400]" />}
          title="Candidate Images (1-2 per Line)"
          badgeText={`${totalImageCount} images`}
          badgeOk={totalImageCount >= validation.length && validation.length > 0}
          hint="One or two candidate images per line with matching serial prefix (e.g., 001.jpg, 001_a.jpg)."
          active={dragImage}
          setActive={setDragImage}
          accept="image/*"
          onFiles={onUploadImages}
        />
      </div>

      {/* Flagged Issues Banner if any */}
      {hasIssues && (
        <div className="bg-[#232733] border border-[#ff5d5d]/40 rounded-xl p-4 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-[#ff5d5d]" />
            <h4 className="text-xs font-bold text-[#ff5d5d] uppercase font-mono tracking-wider">
              Flagged Discrepancies
            </h4>
          </div>
          <ul className="text-xs text-[#8a8fa0] space-y-1.5 list-disc list-inside">
            {duplicates.map((d) => (
              <li key={`dup-${d.num}`}>
                Script line <span className="font-mono text-[#ffd400] font-semibold">{d.num}</span> is duplicated in your script.
              </li>
            ))}
            {gaps.length > 0 && (
              <li>
                Serial gap detected: line{gaps.length > 1 ? 's' : ''} <span className="font-mono text-[#ffd400] font-semibold">{gaps.join(', ')}</span> missing between lowest and highest.
              </li>
            )}
            {audioIssues.map((f, idx) => (
              <li key={`ai-${idx}`}>
                Voice file <span className="font-mono text-[#edeef2]">{f.name}</span> — {f.reason}.
              </li>
            ))}
            {imageIssues.map((f, idx) => (
              <li key={`ii-${idx}`}>
                Image file <span className="font-mono text-[#edeef2]">{f.name}</span> — {f.reason}.
              </li>
            ))}
            {extraAudio.map((num) => (
              <li key={`extra-audio-${num}`} className="flex items-center gap-2">
                <span>Extra voice clip for serial <span className="font-mono text-[#ffd400]">{num}</span> has no matching script line.</span>
                <button
                  onClick={() => onRemoveAudio(num)}
                  className="px-1.5 py-0.5 rounded bg-[#ff5d5d]/20 text-[#ff5d5d] text-[10px] font-mono hover:bg-[#ff5d5d]/30"
                >
                  Remove
                </button>
              </li>
            ))}
            {extraImages.map((num) => (
              <li key={`extra-img-${num}`} className="flex items-center gap-2">
                <span>Extra images for serial <span className="font-mono text-[#ffd400]">{num}</span> have no matching script line.</span>
                <button
                  onClick={() => onClearImages(num)}
                  className="px-1.5 py-0.5 rounded bg-[#ff5d5d]/20 text-[#ff5d5d] text-[10px] font-mono hover:bg-[#ff5d5d]/30"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sync Ledger Table */}
      <div className="bg-[#1b1e27] border border-[#2c3140] rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#2c3140] flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-['Space_Grotesk'] font-bold text-sm text-[#edeef2]">
              Synchronized Asset Ledger ({validation.length} Lines)
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#232733] border border-[#2c3140] text-[#8a8fa0]">
              {readyCount} of {validation.length} lines ready
            </span>
          </div>

          <div className="text-xs text-[#8a8fa0] flex items-center gap-1.5">
            <Clock size={13} className="text-[#ffd400]" />
            <span>Each line's image is displayed for the exact length of that line's voice cut</span>
          </div>
        </div>

        {/* Ledger Rows */}
        <div className="flex flex-col gap-2.5">
          {validation.map((v) => (
            <div
              key={v.num}
              className={`p-3 rounded-xl border flex items-center gap-3.5 transition-all flex-wrap sm:flex-nowrap ${
                v.ready
                  ? 'bg-[#232733]/80 border-[#37c2b9]/40'
                  : 'bg-[#232733]/40 border-[#2c3140]'
              }`}
            >
              {/* Line Serial Badge */}
              <span className="w-9 h-7 rounded-md bg-[#12141a] border border-[#2c3140] text-xs font-mono font-bold text-[#ffd400] flex items-center justify-center shrink-0">
                {String(v.num).padStart(3, '0')}
              </span>

              {/* Script Text */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#edeef2] truncate font-medium">
                  {v.text}
                </p>
                {v.audio ? (
                  <p className="text-[10px] text-[#38bdf8] font-mono mt-0.5 flex items-center gap-1.5">
                    <span className="bg-[#38bdf8]/10 text-[#38bdf8] px-1.5 py-0.5 rounded border border-[#38bdf8]/20">
                      Voice Cut: {v.audio.duration.toFixed(2)}s
                    </span>
                    <span className="text-[#8a8fa0]">
                      → Image display duration: {v.audio.duration.toFixed(2)}s
                    </span>
                  </p>
                ) : (
                  <p className="text-[10px] text-[#8a8fa0] font-mono mt-0.5">
                    Upload voice audio to auto-cut and sync this line
                  </p>
                )}
              </div>

              {/* Audio Status & Player */}
              <div className="flex items-center gap-1.5 shrink-0">
                {v.audioOk && v.audio ? (
                  <div className="flex items-center gap-1 bg-[#12141a] px-2 py-1 rounded-lg border border-[#37c2b9]/30">
                    <button
                      onClick={() => handlePlayAudio(v.num, v.audio!)}
                      className="text-[#37c2b9] hover:text-[#43d9cf] p-0.5 flex items-center gap-1 text-xs font-mono"
                      title="Play voice cut for this line"
                    >
                      {playingLine === v.num ? <Pause size={13} /> : <Play size={13} />}
                      <span>{v.audio.duration.toFixed(1)}s</span>
                    </button>
                    {onOpenAudioTrimmer && (
                      <button
                        onClick={() => onOpenAudioTrimmer(v.num)}
                        className="text-[#ffd400] hover:text-[#ffdf33] p-0.5 ml-1"
                        title="Trim audio timing"
                      >
                        <Scissors size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => onRemoveAudio(v.num)}
                      className="text-[#8a8fa0] hover:text-[#ff5d5d] ml-1 p-0.5"
                      title="Remove voice clip"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onOpenRecorder(v.num, v.text)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#232733] border border-[#ff5d5d]/40 text-[#ff5d5d] hover:bg-[#ff5d5d]/10 text-[11px] font-medium transition-colors"
                      title="Record voice for this line"
                    >
                      <Mic size={11} />
                      <span>Record</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Images Preview & Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {v.imagesCount > 0 ? (
                  <div className="flex items-center gap-1">
                    <div className="flex -space-x-1.5">
                      {v.images.map((im, idx) => (
                        <img
                          key={idx}
                          src={im.url}
                          alt=""
                          className="w-7 h-9 rounded object-cover border border-[#2c3140]"
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => onClearImages(v.num)}
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ml-1 ${
                        v.imagesOk
                          ? 'bg-[#37c2b9]/15 text-[#37c2b9] border-[#37c2b9]/40'
                          : 'bg-[#ff5d5d]/15 text-[#ff5d5d] border-[#ff5d5d]/40'
                      }`}
                      title="Click to clear images"
                    >
                      {v.imagesCount} {v.imagesCount === 1 ? 'img' : 'imgs'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onOpenImageGen(v.num, v.text)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#232733] border border-[#ffd400]/40 text-[#ffd400] hover:bg-[#ffd400]/10 text-[11px] font-medium"
                    title="Generate candidate images"
                  >
                    <Sparkles size={11} />
                    <span>Generate</span>
                  </button>
                )}
              </div>

              {/* Ready Indicator */}
              <div className="w-6 flex items-center justify-center shrink-0">
                {v.ready ? (
                  <Check size={16} className="text-[#37c2b9]" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-[#8a8fa0]/40" />
                )}
              </div>
            </div>
          ))}

          {validation.length === 0 && (
            <div className="text-center py-8 text-xs text-[#8a8fa0]">
              No script lines available. Return to step 1 to enter your script.
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-[#8a8fa0]">
          {!allReady && (
            <span className="flex items-center gap-1.5 text-[#ffb020]">
              <Info size={14} />
              Fill all voice clips and at least 1 image per line to unlock AI matching.
            </span>
          )}
        </div>

        <button
          onClick={onRunMatching}
          disabled={!allReady}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-['Space_Grotesk'] font-bold text-sm bg-[#ffd400] text-[#1a1500] hover:bg-[#ffe14d] transition-all disabled:opacity-35 disabled:cursor-not-allowed shadow-md active:scale-95"
        >
          <Wand2 size={16} />
          <span>Run AI Image Matching</span>
        </button>
      </div>
    </div>
  );
};

interface DropzoneCardProps {
  icon: React.ReactNode;
  title: string;
  badgeText: string;
  badgeOk?: boolean;
  hint: string;
  active: boolean;
  setActive: (v: boolean) => void;
  accept: string;
  isLoading?: boolean;
  onFiles: (files: FileList) => void;
}

const DropzoneCard: React.FC<DropzoneCardProps> = ({
  icon,
  title,
  badgeText,
  badgeOk,
  hint,
  active,
  setActive,
  accept,
  isLoading = false,
  onFiles
}) => {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <div
      className={`border-2 border-dashed rounded-2xl p-5 transition-all flex flex-col justify-between min-h-[170px] ${
        active
          ? 'border-[#ffd400] bg-[#ffd400]/5'
          : 'border-[#2c3140] bg-[#1b1e27] hover:border-[#8a8fa0]/60'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setActive(true);
      }}
      onDragLeave={() => setActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setActive(false);
        if (e.dataTransfer.files?.length) {
          onFiles(e.dataTransfer.files);
        }
      }}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[#232733] flex items-center justify-center">
              {icon}
            </div>
            <span className="font-semibold text-sm text-[#edeef2]">{title}</span>
          </div>

          <span
            className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
              badgeOk
                ? 'bg-[#37c2b9]/15 text-[#37c2b9] border-[#37c2b9]/30'
                : 'bg-[#232733] text-[#8a8fa0] border-[#2c3140]'
            }`}
          >
            {badgeText}
          </span>
        </div>

        <p className="text-xs text-[#8a8fa0] leading-relaxed mb-4">{hint}</p>
      </div>

      <div className="pt-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isLoading}
          className="w-full py-2 px-3 rounded-xl bg-[#232733] border border-[#2c3140] hover:border-[#ffd400]/60 text-xs font-semibold text-[#edeef2] flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 size={13} className="animate-spin text-[#ffd400]" />
          ) : (
            <Upload size={13} className="text-[#ffd400]" />
          )}
          <span>{isLoading ? 'Auto-Slicing & Syncing...' : 'Upload Audio (Auto Sync & Cut)'}</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              onFiles(e.target.files);
            }
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
};


