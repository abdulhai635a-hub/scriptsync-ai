import React, { useRef, useState } from 'react';
import { 
  Music, 
  Volume2, 
  Mic, 
  Upload, 
  Check, 
  Sparkles, 
  Play, 
  Pause,
  Repeat,
  Radio,
  Scissors,
  Loader2,
  Layers
} from 'lucide-react';
import type { BgmTrackConfig, VoiceClip, SceneClip, CaptionLine } from '../../types';
import { STOCK_BGM_TRACKS, createSyntheticMusicBlob } from '../../utils/stockMedia';

interface AudioTabProps {
  bgm: BgmTrackConfig;
  onChangeBgm: (partial: Partial<BgmTrackConfig>) => void;
  voiceClips: Record<number, VoiceClip>;
  scenes: SceneClip[];
  captions: CaptionLine[];
  onOpenVoiceRecorder: (sceneNum: number) => void;
  onUploadFullVoiceover?: (file: File) => Promise<void>;
  isProcessingVoiceover?: boolean;
}

export const AudioTab: React.FC<AudioTabProps> = ({
  bgm,
  onChangeBgm,
  voiceClips,
  scenes,
  captions,
  onOpenVoiceRecorder,
  onUploadFullVoiceover,
  isProcessingVoiceover = false
}) => {
  const customAudioInputRef = useRef<HTMLInputElement>(null);
  const fullVoiceoverInputRef = useRef<HTMLInputElement>(null);

  const handleSelectTrack = async (trackId: string) => {
    if (trackId === 'none') {
      onChangeBgm({ enabled: false, id: 'none' });
      return;
    }

    const track = STOCK_BGM_TRACKS.find((t) => t.id === trackId);
    if (!track) return;

    // Generate synthetic WebAudio buffer for this track
    const asset = await createSyntheticMusicBlob(track.id, 35);
    onChangeBgm({
      enabled: true,
      id: track.id,
      title: track.title,
      genre: track.genre,
      url: asset.url
    });
  };

  const handleCustomAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    onChangeBgm({
      enabled: true,
      id: `custom_${Date.now()}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      genre: 'Custom Upload',
      url
    });
    e.target.value = '';
  };

  const handleFullVoiceoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadFullVoiceover) return;
    await onUploadFullVoiceover(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 text-[#e4e4e7] space-y-5">
      {/* 1. Full Voice Narration Upload & Auto-Sync (PRD Fix: Any number of lines) */}
      <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-[#ffd400]/15 text-[#ffd400]">
            <Scissors size={14} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#f4f4f5]">Full Narration Auto-Slice</h4>
            <p className="text-[10px] text-[#a1a1aa]">Upload 1 voiceover file & sync to all {scenes.length} scenes</p>
          </div>
        </div>

        <input
          type="file"
          ref={fullVoiceoverInputRef}
          onChange={handleFullVoiceoverFile}
          accept="audio/*"
          className="hidden"
        />

        <button
          onClick={() => fullVoiceoverInputRef.current?.click()}
          disabled={isProcessingVoiceover}
          className="w-full py-2.5 px-3 rounded-lg text-xs font-bold bg-[#ffd400] text-[#09090b] hover:bg-[#ffe14d] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
        >
          {isProcessingVoiceover ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Analyzing & Slicing to {scenes.length} Scenes...</span>
            </>
          ) : (
            <>
              <Upload size={14} />
              <span>Upload Voiceover Audio File</span>
            </>
          )}
        </button>

        <p className="text-[10px] text-[#71717a] text-center leading-relaxed">
          Auto-matches spoken words to script lines and precisely slices timestamps across all scenes.
        </p>
      </div>

      {/* 2. Background Music Master */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#f4f4f5]">
            <Music size={14} className="text-[#ffd400]" />
            <span>Background Music Track</span>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={bgm.enabled}
              onChange={(e) => onChangeBgm({ enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-8 h-4 bg-[#27272a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-[#ffd400]"></div>
          </label>
        </div>

        {bgm.enabled && (
          <div className="space-y-3 p-3 bg-[#18181b] border border-[#27272a] rounded-xl">
            {/* Active Track Title */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#a1a1aa]">Active BGM:</span>
              <span className="font-bold text-[#ffd400] max-w-[180px] truncate">{bgm.title}</span>
            </div>

            {/* Volume Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-[#a1a1aa]">
                <span className="flex items-center gap-1">
                  <Volume2 size={11} />
                  <span>BGM Volume</span>
                </span>
                <span className="font-mono text-[#ffd400]">{Math.round(bgm.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                value={bgm.volume}
                onChange={(e) => onChangeBgm({ volume: parseFloat(e.target.value) })}
                className="w-full accent-[#ffd400] cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Built-in Music Library */}
      <div className="space-y-2 pt-1 border-t border-[#27272a]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#f4f4f5]">Built-in Music Library</span>
          <button
            onClick={() => customAudioInputRef.current?.click()}
            className="flex items-center gap-1 text-[10px] text-[#ffd400] hover:underline cursor-pointer"
          >
            <Upload size={10} />
            <span>Upload MP3</span>
          </button>
        </div>

        <input
          type="file"
          ref={customAudioInputRef}
          onChange={handleCustomAudioUpload}
          accept="audio/*"
          className="hidden"
        />

        <div className="space-y-1.5">
          {STOCK_BGM_TRACKS.map((track) => {
            const isSelected = bgm.enabled && bgm.id === track.id;
            return (
              <button
                key={track.id}
                onClick={() => handleSelectTrack(track.id)}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#ffd400] bg-[#ffd400]/10 ring-1 ring-[#ffd400]/40'
                    : 'border-[#27272a] bg-[#18181b] hover:border-[#3f3f46]'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-semibold text-[#f4f4f5] truncate">{track.title}</p>
                  <p className="text-[10px] text-[#a1a1aa] mt-0.5">{track.genre}</p>
                </div>

                {isSelected ? (
                  <Check size={14} className="text-[#ffd400] flex-shrink-0" />
                ) : (
                  <Radio size={13} className="text-[#71717a] flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Voiceover Clips Per Scene */}
      <div className="space-y-2 pt-1 border-t border-[#27272a]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#f4f4f5]">
            <Mic size={14} className="text-[#ffd400]" />
            <span>Scene Voice Segments ({Object.keys(voiceClips).length}/{scenes.length})</span>
          </div>
        </div>

        <div className="space-y-2">
          {scenes.map((scene, i) => {
            const voice = voiceClips[scene.num];
            const caption = captions.find(c => c.num === scene.num);
            return (
              <div
                key={scene.num}
                className="flex items-center justify-between p-2.5 rounded-xl border border-[#27272a] bg-[#18181b]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[10px] font-mono font-bold text-[#ffd400] bg-[#ffd400]/10 px-1.5 py-0.5 rounded">
                    #{scene.num}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#f4f4f5] truncate">
                      {voice ? voice.name : `Scene ${scene.num} Audio`}
                    </p>
                    <p className="text-[10px] text-[#a1a1aa] truncate">
                      {caption?.text ? `"${caption.text.slice(0, 28)}..."` : `Duration: ${scene.duration.toFixed(1)}s`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {voice && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#10b981]/15 text-[#10b981]">
                      {voice.duration ? voice.duration.toFixed(1) : scene.duration.toFixed(1)}s
                    </span>
                  )}
                  <button
                    onClick={() => onOpenVoiceRecorder(scene.num)}
                    className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-[#ffd400] transition-colors cursor-pointer"
                    title="Record direct voice for this scene"
                  >
                    <Mic size={10} />
                    <span>{voice ? 'Re-record' : 'Record'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
