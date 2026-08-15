import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, RotateCcw, Check, X, Volume2 } from 'lucide-react';
import type { VoiceClip } from '../types';

interface VoiceRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneNum: number;
  scriptText: string;
  onSaveVoice: (sceneNum: number, voiceClip: VoiceClip) => void;
}

export const VoiceRecorderModal: React.FC<VoiceRecorderModalProps> = ({
  isOpen,
  onClose,
  sceneNum,
  scriptText,
  onSaveVoice
}) => {
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      cleanup();
    }
  }, [isOpen]);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch (e) {}
    }
    audioContextRef.current = null;
    setRecording(false);
    setAudioLevel(0);
  };

  const startRecording = async () => {
    try {
      cleanup();
      setRecordedBlob(null);
      setRecordedUrl(null);
      setElapsed(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const updateMeter = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const avg = sum / bufferLength;
          setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(updateMeter);
        }
      };
      updateMeter();

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);

        const tempAudio = new Audio(url);
        tempAudio.onloadedmetadata = () => {
          setDuration(tempAudio.duration || elapsed);
        };
      };

      mediaRecorder.start();
      setRecording(true);

      const startTime = Date.now();
      timerRef.current = window.setInterval(() => {
        setElapsed((Date.now() - startTime) / 1000);
      }, 100);
    } catch (err) {
      console.error('Microphone access error:', err);
      alert('Could not access microphone. Please grant browser microphone permission.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      setRecording(false);
      setAudioLevel(0);
    }
  };

  const handleSave = () => {
    if (!recordedBlob || !recordedUrl) return;
    const file = new File([recordedBlob], `scene_${sceneNum}_voice.webm`, { type: 'audio/webm' });
    onSaveVoice(sceneNum, {
      id: `voice_${sceneNum}_${Date.now()}`,
      sceneNum,
      file,
      name: `Scene #${sceneNum} Voiceover`,
      url: recordedUrl,
      duration: duration || elapsed || 3.0
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div className="bg-[#121215] border border-[#27272a] rounded-2xl w-full max-w-md p-6 shadow-2xl text-[#e4e4e7]">
        <div className="flex items-center justify-between pb-4 border-b border-[#27272a] mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[#ffd400]/15 flex items-center justify-center text-[#ffd400]">
              <Mic size={16} />
            </div>
            <h3 className="font-bold text-sm text-[#f4f4f5]">
              Record Voice for Scene #{sceneNum}
            </h3>
          </div>
          <button onClick={onClose} className="text-[#a1a1aa] hover:text-[#f4f4f5]">
            <X size={18} />
          </button>
        </div>

        {/* Script line prompt */}
        {scriptText && (
          <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl mb-4">
            <div className="text-[10px] font-mono text-[#ffd400] mb-1 font-bold">
              READ ALOUD SCRIPT:
            </div>
            <p className="text-xs font-medium text-[#f4f4f5] italic leading-relaxed">
              "{scriptText}"
            </p>
          </div>
        )}

        {/* Recording Visualizer */}
        <div className="flex flex-col items-center justify-center p-6 bg-[#09090b] rounded-xl border border-[#27272a] mb-5 min-h-[140px]">
          {recording ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <div className="flex items-center gap-2 text-xs font-mono text-[#ef4444] animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                RECORDING: {elapsed.toFixed(1)}s
              </div>

              {/* Audio visualizer bar */}
              <div className="w-full max-w-xs h-3 bg-[#18181b] rounded-full overflow-hidden p-0.5 border border-[#27272a]">
                <div
                  className="h-full bg-[#ffd400] rounded-full transition-all duration-75"
                  style={{ width: `${Math.max(5, audioLevel)}%` }}
                />
              </div>
              <span className="text-[10px] text-[#a1a1aa]">Speak clearly into your microphone</span>
            </div>
          ) : recordedUrl ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <div className="flex items-center gap-2 text-xs font-mono text-[#10b981]">
                <Check size={14} />
                RECORDED: {duration ? duration.toFixed(1) : elapsed.toFixed(1)}s
              </div>
              <audio src={recordedUrl} controls className="w-full max-w-xs h-9 mt-1" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-[#a1a1aa]">
              <Mic size={24} className="text-[#a1a1aa]/60" />
              <span className="text-xs">Press start recording and speak narration</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between pt-2">
          {recording ? (
            <button
              onClick={stopRecording}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#ef4444] text-white hover:bg-[#dc2626] flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Square size={14} /> Stop Recording
            </button>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={startRecording}
                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs bg-[#ffd400] text-[#09090b] hover:bg-[#ffe14d] flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Mic size={14} /> {recordedUrl ? 'Re-record' : 'Start Recording'}
              </button>

              {recordedUrl && (
                <button
                  onClick={handleSave}
                  className="py-2.5 px-6 rounded-xl font-bold text-xs bg-[#10b981] text-white hover:bg-[#059669] flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Check size={14} /> Save to Timeline
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
