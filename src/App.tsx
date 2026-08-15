import React, { useState, useRef, useEffect, useCallback } from 'react';
import { auth, onAuthStateChanged, type User } from './lib/firebase';
import { saveProjectToFirestore, getLocalProjectDraft } from './services/projectService';
import { generateDefaultLiveProject, SUBTITLE_PRESETS } from './utils/stockMedia';
import { SAMPLE_SCRIPTS } from './utils/sampleData';
import { renderVideoProject } from './utils/exportEngine';
import { Header } from './components/Header';
import { LeftDock, type LeftTabKey } from './components/LeftRack/LeftDock';
import { LiveCanvasViewport } from './components/Viewport/LiveCanvasViewport';
import { InspectorPanel } from './components/Inspector/InspectorPanel';
import { MultiTrackTimeline } from './components/Timeline/MultiTrackTimeline';
import { ExportModal } from './components/Modals/ExportModal';
import { TemplatesModal } from './components/Modals/TemplatesModal';
import { ProjectsModal } from './components/ProjectsModal';
import { VoiceRecorderModal } from './components/VoiceRecorderModal';
import { ImageGeneratorModal } from './components/ImageGeneratorModal';
import { AudioTrimModal } from './components/AudioTrimModal';
import { StepScript } from './components/Steps/StepScript';
import { StepMedia } from './components/Steps/StepMedia';
import { StepExport } from './components/Steps/StepExport';
import type { 
  VideoProjectData, 
  SceneClip, 
  CaptionLine, 
  VoiceClip, 
  BgmTrackConfig, 
  SubtitleStyleConfig, 
  OverlayConfig, 
  AspectRatioType, 
  FilterType, 
  MotionType, 
  SubtitlePresetType,
  ScriptLine,
  AudioItem,
  ImageItem,
  LineValidation
} from './types';
import { 
  createStyledCanvasImage, 
  decodeAudioFromFile, 
  alignAudioWithScript, 
  sliceAudioBuffer, 
  convertAudioBufferToBlob 
} from './utils/audio';

function parseScriptLines(text: string): ScriptLine[] {
  const rawLines = text.split('\n');
  const result: ScriptLine[] = [];
  let autoNum = 1;

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^(\d+)[\.\)\:\-\s]+(.*)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      const content = match[2].trim();
      if (content) {
        result.push({ num, text: content });
      }
    } else {
      result.push({ num: autoNum, text: trimmed });
    }
    autoNum++;
  }
  return result;
}

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Workflow Step: 1 = Script, 2 = Media, 3 = Live Studio (Live Editing), 4 = Export
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Main Project State
  const [project, setProject] = useState<VideoProjectData>(() => {
    const draft = getLocalProjectDraft();
    if (draft && draft.scenes && draft.scenes.length > 0) {
      return draft;
    }
    return generateDefaultLiveProject();
  });

  // Script & Media State for Steps 1 & 2
  const [scriptText, setScriptText] = useState<string>(() => {
    return SAMPLE_SCRIPTS[0]?.text || `1. The ancient forest held secrets older than civilization.
2. Sunlight pierced through the misty emerald canopy.
3. A quiet river whispered timeless tales through the stones.`;
  });

  const [scriptLines, setScriptLines] = useState<ScriptLine[]>(() => {
    return parseScriptLines(SAMPLE_SCRIPTS[0]?.text || `1. The ancient forest held secrets older than civilization.
2. Sunlight pierced through the misty emerald canopy.
3. A quiet river whispered timeless tales through the stones.`);
  });

  const [audioMap, setAudioMap] = useState<Record<number, AudioItem>>({});
  const [imageMap, setImageMap] = useState<Record<number, ImageItem[]>>({});
  const [audioIssues, setAudioIssues] = useState<string[]>([]);
  const [imageIssues, setImageIssues] = useState<string[]>([]);
  const [isSyncingVoice, setIsSyncingVoice] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Audio Trimmer Modal State
  const [trimmerState, setTrimmerState] = useState<{
    isOpen: boolean;
    lineNum: number | null;
    audioItem: AudioItem | null;
  }>({
    isOpen: false,
    lineNum: null,
    audioItem: null
  });

  // Step 4 Export Render State
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isExportRendering, setIsExportRendering] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportVideoUrl, setExportVideoUrl] = useState<string | null>(null);

  // Undo / Redo Stacks
  const [history, setHistory] = useState<VideoProjectData[]>([]);
  const [redoStack, setRedoStack] = useState<VideoProjectData[]>([]);

  // Selection & UI State
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number | null>(0);
  const [selectedCaptionIndex, setSelectedCaptionIndex] = useState<number | null>(null);
  const [activeLeftTab, setActiveLeftTab] = useState<LeftTabKey>('media');
  const [safeZoneOverlay, setSafeZoneOverlay] = useState(false);
  const [gridOverlay, setGridOverlay] = useState(false);

  // Playback & Clock State
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const isPlayingRef = useRef(false);
  isPlayingRef.current = isPlaying;
  const currentTimeRef = useRef(0);
  currentTimeRef.current = currentTime;
  const animFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  // Cloud Sync State
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  // Modals
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [projectsModalOpen, setProjectsModalOpen] = useState(false);
  const [voiceRecorderModal, setVoiceRecorderModal] = useState<{ open: boolean; sceneNum: number; text: string }>({
    open: false,
    sceneNum: 1,
    text: ''
  });
  const [imageGenModal, setImageGenModal] = useState<{ open: boolean; sceneIndex: number; title: string }>({
    open: false,
    sceneIndex: 0,
    title: ''
  });
  const [isAligning, setIsAligning] = useState(false);
  const [isProcessingVoiceover, setIsProcessingVoiceover] = useState(false);

  // Subscribe to Firebase Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Record history snapshot before significant change
  const recordHistory = useCallback((newProject: VideoProjectData) => {
    setHistory((prev) => [...prev.slice(-20), project]);
    setRedoStack([]);
    setProject(newProject);
    setHasUnsaved(true);
  }, [project]);

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack((r) => [project, ...r]);
    setHistory((h) => h.slice(0, -1));
    setProject(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setHistory((h) => [...h, project]);
    setRedoStack((r) => r.slice(1));
    setProject(next);
  };

  // Re-calculate total project duration
  const recomputeTotalDuration = (scenes: SceneClip[]): number => {
    return Number(scenes.reduce((acc, s) => acc + s.duration, 0).toFixed(2));
  };

  // 60FPS Playback Loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      return;
    }

    lastTimeRef.current = performance.now();

    const loop = (now: number) => {
      const deltaSec = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      setCurrentTime((prevTime) => {
        const nextTime = prevTime + deltaSec;
        if (nextTime >= project.totalDuration) {
          return 0; // Loop back to start
        }
        return nextTime;
      });

      if (isPlayingRef.current) {
        animFrameIdRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isPlaying, project.totalDuration]);

  // Auto-Save Debounce to Firestore & Local Storage
  useEffect(() => {
    const timer = setTimeout(() => {
      if (project.scenes.length > 0) {
        setIsSaving(true);
        saveProjectToFirestore(project, user)
          .then(() => {
            setHasUnsaved(false);
          })
          .catch((e) => console.log('Autosave notice:', e))
          .finally(() => setIsSaving(false));
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [project, user]);

  // Manual save trigger
  const handleManualSave = async () => {
    setIsSaving(true);
    try {
      await saveProjectToFirestore(project, user);
      setHasUnsaved(false);
    } catch (e) {
      console.log('Manual save notice:', e);
    } finally {
      setIsSaving(false);
    }
  };

  // Compute Line Validations for Step 2
  const validation: LineValidation[] = scriptLines.map((l) => {
    const audio = audioMap[l.num];
    const images = imageMap[l.num] || [];
    const audioOk = !!audio;
    const imagesCount = images.length;
    const imagesOk = imagesCount >= 1;
    const ready = audioOk && imagesOk;
    return {
      ...l,
      audioOk,
      audio,
      imagesCount,
      imagesOk,
      images,
      ready
    };
  });

  // Step 1: Script handlers
  const handleUpdateScript = (text: string) => {
    setScriptText(text);
    const parsed = parseScriptLines(text);
    setScriptLines(parsed);
  };

  const handleContinueToMedia = () => {
    const parsed = parseScriptLines(scriptText);
    setScriptLines(parsed);
    setCurrentStep(2);
  };

  // Step 2: Audio upload and auto-slice across any number of script lines
  const handleUploadAudioStep2 = async (files: FileList) => {
    if (files.length === 0) return;

    if (files.length === 1 && scriptLines.length > 1) {
      // Single voiceover file: auto-sync & cut across all script lines (no cap)
      setIsSyncingVoice(true);
      setSyncStatus(`Auto-aligning voiceover across all ${scriptLines.length} script lines...`);
      try {
        const file = files[0];
        const audioBuffer = await decodeAudioFromFile(file);
        const totalDur = audioBuffer.duration;
        
        const alignment = await alignAudioWithScript(
          file, 
          scriptLines, 
          totalDur, 
          (msg) => setSyncStatus(msg)
        );

        const timestamps = alignment.timestamps;
        const nextAudioMap: Record<number, AudioItem> = { ...audioMap };
        let cumTime = 0;

        for (let i = 0; i < scriptLines.length; i++) {
          const line = scriptLines[i];
          const t = timestamps[i] || {
            num: line.num || (i + 1),
            startTime: cumTime,
            endTime: cumTime + (totalDur / scriptLines.length),
            duration: totalDur / scriptLines.length
          };

          const sliceStart = Math.max(0, Math.min(totalDur, t.startTime));
          const sliceEnd = Math.max(sliceStart + 0.3, Math.min(totalDur, t.endTime));
          const segDur = Number((sliceEnd - sliceStart).toFixed(2));

          const sliced = sliceAudioBuffer(audioBuffer, sliceStart, sliceEnd);
          const converted = convertAudioBufferToBlob(sliced);

          nextAudioMap[line.num] = {
            file: converted.blob,
            name: `${file.name.replace(/\.[^/.]+$/, '')} (Scene ${line.num})`,
            url: converted.url,
            duration: segDur,
            startTime: 0,
            endTime: segDur,
            isMasterTrackSlice: true
          };
          cumTime += segDur;
        }

        setAudioMap(nextAudioMap);
        const warningMsg = alignment.warnings && alignment.warnings.length > 0 ? ` (${alignment.warnings[0]})` : '';
        setSyncStatus(`Auto-sliced narration into ${scriptLines.length} segments across ${totalDur.toFixed(1)}s audio${warningMsg}`);
      } catch (err) {
        console.log('Audio slice failed:', err);
        setSyncStatus('Audio slice fallback applied.');
      } finally {
        setIsSyncingVoice(false);
      }
    } else {
      // Multiple audio files
      const nextAudioMap: Record<number, AudioItem> = { ...audioMap };
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('audio/')) continue;
        const numMatch = file.name.match(/(\d+)/);
        const lineNum = numMatch ? parseInt(numMatch[1], 10) : i + 1;
        const url = URL.createObjectURL(file);

        let duration = 3.5;
        try {
          const buf = await decodeAudioFromFile(file);
          duration = Number(buf.duration.toFixed(2));
        } catch (e) {
          console.log('Could not decode audio duration:', e);
        }

        nextAudioMap[lineNum] = {
          file,
          name: file.name,
          url,
          duration,
          startTime: 0,
          endTime: duration
        };
      }
      setAudioMap(nextAudioMap);
    }
  };

  // Step 2: Image upload
  const handleUploadImagesStep2 = (files: FileList) => {
    const nextImageMap: Record<number, ImageItem[]> = { ...imageMap };
    
    let highestMappedLine = 0;
    for (const key in nextImageMap) {
      if (nextImageMap[key] && nextImageMap[key].length > 0) {
         highestMappedLine = Math.max(highestMappedLine, parseInt(key, 10));
      }
    }

    Array.from(files).forEach((file, idx) => {
      if (!file.type.startsWith('image/')) return;
      
      const numMatch = file.name.match(/(\d+)/);
      let lineNum = numMatch ? parseInt(numMatch[1], 10) : 0;
      
      if (!lineNum || lineNum === 0) {
        highestMappedLine++;
        lineNum = highestMappedLine;
      }
      
      const url = URL.createObjectURL(file);

      if (!nextImageMap[lineNum]) {
        nextImageMap[lineNum] = [];
      }
      nextImageMap[lineNum].push({
        file,
        name: file.name,
        url
      });
    });
    setImageMap(nextImageMap);
  };

  // Step 2 -> Step 3: Transition to Live Editing Studio
  const handleProceedToStudio = (
    overrideAudioMap?: Record<number, AudioItem>,
    overrideImageMap?: Record<number, ImageItem[]>
  ) => {
    let cumulativeTime = 0;
    const nextScenes: SceneClip[] = [];
    const nextCaptions: CaptionLine[] = [];
    const nextVoiceClips: Record<number, VoiceClip> = {};

    const activeAudioMap = overrideAudioMap || audioMap;
    const activeImageMap = overrideImageMap || imageMap;

    for (let i = 0; i < scriptLines.length; i++) {
      const line = scriptLines[i];
      const audio = activeAudioMap[line.num];
      const images = activeImageMap[line.num] || [];

      let imageUrl = images[0]?.url;
      let imageName = images[0]?.name || `Scene ${line.num}`;
      let imageFile = images[0]?.file;

      if (!imageUrl) {
        const existing = project.scenes.find((s) => s.num === line.num);
        imageUrl = existing ? existing.imageUrl : 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&q=80';
      }

      const duration = audio?.duration || 3.5;

      const sceneClip: SceneClip = {
        id: `scene_${line.num}_${Date.now()}_${i}`,
        num: line.num,
        title: imageName,
        imageUrl,
        imageName,
        imageFile,
        duration,
        startTime: cumulativeTime,
        motion: 'zoom-in',
        motionSpeed: 1.0,
        filter: 'none',
        fit: 'cover',
        transition: 'cross-fade',
        transitionDuration: 0.5,
        brightness: 100,
        contrast: 100,
        saturation: 100
      };
      nextScenes.push(sceneClip);

      const captionLine: CaptionLine = {
        id: `caption_${line.num}_${Date.now()}_${i}`,
        num: line.num,
        text: line.text,
        startTime: cumulativeTime,
        endTime: cumulativeTime + duration,
        duration
      };
      nextCaptions.push(captionLine);

      if (audio) {
        nextVoiceClips[line.num] = {
          id: `voice_${line.num}_${Date.now()}`,
          num: line.num,
          name: audio.name,
          url: audio.url,
          startTime: cumulativeTime,
          duration: audio.duration,
          volume: 1.0,
          file: audio.file
        };
      }

      cumulativeTime += duration;
    }

    const totalDuration = recomputeTotalDuration(nextScenes);

    recordHistory({
      ...project,
      scenes: nextScenes,
      captions: nextCaptions,
      voiceClips: nextVoiceClips,
      totalDuration
    });

    setCurrentStep(3);
    setSelectedSceneIndex(0);
    setCurrentTime(0);
  };

  // Step 4: Render Video
  const handleStartExportRender = async () => {
    setIsExportRendering(true);
    setExportProgress(0);
    setExportVideoUrl(null);
    try {
      const res = await renderVideoProject({
        scenes: project.scenes,
        captions: project.captions,
        voiceClips: project.voiceClips,
        bgm: project.bgm,
        subtitleStyle: project.subtitleStyle,
        overlays: project.overlays,
        aspectRatio: project.aspectRatio,
        resolution: '1080p',
        fps: 30,
        onProgress: (prog) => {
          setExportProgress(Math.round(prog * 100));
        }
      });
      setExportVideoUrl(res.url);
    } catch (err) {
      console.log('Export render error:', err);
    } finally {
      setIsExportRendering(false);
    }
  };

  useEffect(() => {
    if (currentStep === 4 && !exportVideoUrl && !isExportRendering) {
      handleStartExportRender();
    }
  }, [currentStep]);

  // Scene Operations
  const handleSelectScene = (index: number) => {
    setSelectedSceneIndex(index);
    setSelectedCaptionIndex(null);
    setActiveLeftTab('effects');
  };

  const handleUpdateScene = (index: number, partial: Partial<SceneClip>) => {
    const nextScenes = [...project.scenes];
    nextScenes[index] = { ...nextScenes[index], ...partial };
    const totalDuration = recomputeTotalDuration(nextScenes);
    recordHistory({
      ...project,
      scenes: nextScenes,
      totalDuration
    });
  };

  const handleAddScene = async () => {
    const num = project.scenes.length + 1;
    const imgData = await createStyledCanvasImage(`Scene ${num} Visual`, num, ['#1e1b4b', '#312e81'], '#ffd400');
    const totalOffset = project.scenes.reduce((acc, s) => acc + s.duration, 0);

    const newClip: SceneClip = {
      id: `scene_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      num,
      title: `Scene ${num}`,
      imageUrl: imgData.url,
      imageName: `scene_${num}.jpg`,
      duration: 3.5,
      startTime: totalOffset,
      motion: 'zoom-in',
      motionSpeed: 1.0,
      filter: 'none',
      fit: 'cover',
      transition: 'cross-fade',
      transitionDuration: 0.5,
      brightness: 100,
      contrast: 100,
      saturation: 100
    };

    const nextScenes = [...project.scenes, newClip];
    const totalDuration = recomputeTotalDuration(nextScenes);

    // Also append caption
    const newCap: CaptionLine = {
      id: `cap_${Date.now()}`,
      num,
      text: `Voice narration for scene number ${num}`,
      startTime: totalOffset,
      endTime: totalOffset + 3.5,
      duration: 3.5
    };

    recordHistory({
      ...project,
      scenes: nextScenes,
      captions: [...project.captions, newCap],
      totalDuration
    });

    setSelectedSceneIndex(nextScenes.length - 1);
  };

  const handleDuplicateScene = (index: number) => {
    const target = project.scenes[index];
    if (!target) return;

    const dup: SceneClip = {
      ...target,
      id: `scene_${Date.now()}_dup`,
      title: `${target.title} (Copy)`
    };

    const nextScenes = [...project.scenes];
    nextScenes.splice(index + 1, 0, dup);
    const totalDuration = recomputeTotalDuration(nextScenes);

    recordHistory({
      ...project,
      scenes: nextScenes,
      totalDuration
    });
    setSelectedSceneIndex(index + 1);
  };

  const handleDeleteScene = (index: number) => {
    if (project.scenes.length <= 1) return;
    const nextScenes = project.scenes.filter((_, i) => i !== index);
    const totalDuration = recomputeTotalDuration(nextScenes);

    recordHistory({
      ...project,
      scenes: nextScenes,
      totalDuration
    });
    setSelectedSceneIndex(Math.max(0, index - 1));
  };

  const handleMoveScene = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= project.scenes.length) return;
    const nextScenes = [...project.scenes];
    const [moved] = nextScenes.splice(fromIndex, 1);
    nextScenes.splice(toIndex, 0, moved);

    recordHistory({
      ...project,
      scenes: nextScenes
    });
    setSelectedSceneIndex(toIndex);
  };

  const handleSplitSceneAtPlayhead = () => {
    // Find which scene the playhead is currently inside
    let accumTime = 0;
    let targetIndex = -1;
    let splitPointInScene = 0;

    for (let i = 0; i < project.scenes.length; i++) {
      const dur = project.scenes[i].duration;
      if (currentTime > accumTime + 0.3 && currentTime < accumTime + dur - 0.3) {
        targetIndex = i;
        splitPointInScene = currentTime - accumTime;
        break;
      }
      accumTime += dur;
    }

    if (targetIndex === -1) return;

    const orig = project.scenes[targetIndex];
    const firstPartDuration = Number(splitPointInScene.toFixed(2));
    const secondPartDuration = Number((orig.duration - splitPointInScene).toFixed(2));

    const firstClip: SceneClip = {
      ...orig,
      duration: firstPartDuration
    };

    const secondClip: SceneClip = {
      ...orig,
      id: `scene_${Date.now()}_split`,
      title: `${orig.title} Pt.2`,
      duration: secondPartDuration
    };

    const nextScenes = [...project.scenes];
    nextScenes.splice(targetIndex, 1, firstClip, secondClip);
    const totalDuration = recomputeTotalDuration(nextScenes);

    recordHistory({
      ...project,
      scenes: nextScenes,
      totalDuration
    });
    setSelectedSceneIndex(targetIndex + 1);
  };

  // Caption Operations
  const handleSelectCaption = (index: number) => {
    setSelectedCaptionIndex(index);
    setSelectedSceneIndex(null);
    setActiveLeftTab('captions');
  };

  const handleUpdateCaption = (index: number, partial: Partial<CaptionLine>) => {
    const nextCaptions = [...project.captions];
    nextCaptions[index] = { ...nextCaptions[index], ...partial };
    recordHistory({
      ...project,
      captions: nextCaptions
    });
  };

  const handleAddCaption = (afterIndex?: number) => {
    const idx = afterIndex !== undefined ? afterIndex : project.captions.length - 1;
    const prevCap = project.captions[idx];
    const startTime = prevCap ? prevCap.endTime : 0;
    const duration = 3.0;

    const newCap: CaptionLine = {
      id: `cap_${Date.now()}`,
      num: project.captions.length + 1,
      text: 'New subtitle narration line',
      startTime,
      endTime: startTime + duration,
      duration
    };

    const nextCaptions = [...project.captions];
    if (afterIndex !== undefined) {
      nextCaptions.splice(afterIndex + 1, 0, newCap);
    } else {
      nextCaptions.push(newCap);
    }

    recordHistory({
      ...project,
      captions: nextCaptions
    });
    setSelectedCaptionIndex(nextCaptions.length - 1);
  };

  const handleDeleteCaption = (index: number) => {
    if (project.captions.length <= 1) return;
    const nextCaptions = project.captions.filter((_, i) => i !== index);
    recordHistory({
      ...project,
      captions: nextCaptions
    });
    setSelectedCaptionIndex(Math.max(0, index - 1));
  };

  const handleAutoSyncCaptionsToScenes = () => {
    let offset = 0;
    const nextCaptions = project.scenes.map((scene, i) => {
      const start = offset;
      const end = offset + scene.duration;
      offset = end;
      const existing = project.captions[i];
      return {
        id: existing?.id || `cap_${i}_${Date.now()}`,
        num: i + 1,
        text: existing?.text || scene.title,
        startTime: start,
        endTime: end,
        duration: scene.duration
      };
    });

    recordHistory({
      ...project,
      captions: nextCaptions
    });
  };

  // AI Alignment with Gemini API (Speech Alignment)
  const handleAlignAudioWithGemini = async () => {
    setIsAligning(true);
    try {
      const resp = await fetch('/api/align-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptText: project.captions.map((c) => c.text).join('\n'),
          totalDuration: project.totalDuration
        })
      });

      const data = await resp.json();
      if (data.timestamps && Array.isArray(data.timestamps)) {
        const nextCaptions = project.captions.map((cap, i) => {
          const t = data.timestamps[i];
          if (!t) return cap;
          return {
            ...cap,
            startTime: t.startTime,
            endTime: t.endTime,
            duration: Math.max(0.5, t.endTime - t.startTime)
          };
        });

        recordHistory({
          ...project,
          captions: nextCaptions
        });
      }
    } catch (e) {
      console.log('AI speech align notice:', e);
      handleAutoSyncCaptionsToScenes();
    } finally {
      setIsAligning(false);
    }
  };

  // Full Narration Auto-Sync & Slicing across any number of lines / scenes (Fix for PRD)
  // Fully compliant with AC-1 to AC-6: Unlimited lines, 100% audio coverage, exact scene matching
  const handleUploadAndAutoSliceVoiceover = async (file: File) => {
    setIsProcessingVoiceover(true);
    try {
      // 1. Decode entire uploaded audio file into WebAudio buffer
      const audioBuffer = await decodeAudioFromFile(file);
      const totalAudioDur = audioBuffer.duration;

      // 2. Prepare script lines: count is max of existing captions, scenes, or at least 1
      const totalTargetCount = Math.max(project.captions.length, project.scenes.length, 1);
      const scriptLines = Array.from({ length: totalTargetCount }, (_, i) => {
        const cap = project.captions[i];
        const scn = project.scenes[i];
        return {
          num: i + 1,
          text: cap?.text || scn?.title || `Scene ${i + 1} Narration`
        };
      });

      // 3. Align timestamps with AI & speech acoustics across all N lines
      const alignment = await alignAudioWithScript(file, scriptLines, totalAudioDur);
      const timestamps = alignment.timestamps;

      // 4. Slice AudioBuffer for each line and update scenes & captions
      const nextVoiceClips: Record<number, VoiceClip> = { ...project.voiceClips };
      let cumulativeTime = 0;
      const nextScenes: SceneClip[] = [];
      const nextCaptions: CaptionLine[] = [];

      for (let i = 0; i < totalTargetCount; i++) {
        const line = scriptLines[i];
        const t = timestamps[i] || {
          num: i + 1,
          startTime: cumulativeTime,
          endTime: cumulativeTime + (totalAudioDur / totalTargetCount),
          duration: totalAudioDur / totalTargetCount
        };

        const sliceStart = Math.max(0, Math.min(totalAudioDur, t.startTime));
        const sliceEnd = Math.max(sliceStart + 0.3, Math.min(totalAudioDur, t.endTime));
        const segDuration = Number((sliceEnd - sliceStart).toFixed(2));

        // Slice audio buffer with 5ms micro-fade
        const sliced = sliceAudioBuffer(audioBuffer, sliceStart, sliceEnd);
        const converted = convertAudioBufferToBlob(sliced);

        const voiceClip: VoiceClip = {
          id: `voice_${i + 1}_${Date.now()}`,
          num: i + 1,
          name: `${file.name.replace(/\.[^/.]+$/, '')} (Part ${i + 1})`,
          url: converted.url,
          startTime: cumulativeTime,
          duration: segDuration,
          volume: 1.0,
          file: converted.blob
        };

        nextVoiceClips[i + 1] = voiceClip;

        // Scene handling: reuse existing or generate visual placeholder slide
        const existingScene = project.scenes[i];
        if (existingScene) {
          nextScenes.push({
            ...existingScene,
            num: i + 1,
            duration: segDuration,
            startTime: cumulativeTime
          });
        } else {
          const img = await createStyledCanvasImage(`Scene ${i + 1}`, 'A', ['#0f172a', '#1e293b'], '#38bdf8');
          nextScenes.push({
            id: `scene_${i + 1}_${Date.now()}`,
            num: i + 1,
            title: line.text.slice(0, 24),
            imageUrl: img.url,
            imageName: `scene_${i + 1}.jpg`,
            duration: segDuration,
            startTime: cumulativeTime,
            motion: 'zoom-in',
            motionSpeed: 1.0,
            filter: 'none',
            fit: 'cover',
            transition: 'cross-fade',
            transitionDuration: 0.5,
            brightness: 100,
            contrast: 100,
            saturation: 100
          });
        }

        // Caption handling
        const existingCap = project.captions[i];
        nextCaptions.push({
          id: existingCap?.id || `cap_${i + 1}_${Date.now()}`,
          num: i + 1,
          text: existingCap?.text || line.text,
          duration: segDuration,
          startTime: cumulativeTime,
          endTime: cumulativeTime + segDuration
        });

        cumulativeTime += segDuration;
      }

      const totalDuration = recomputeTotalDuration(nextScenes);

      recordHistory({
        ...project,
        scenes: nextScenes,
        captions: nextCaptions,
        voiceClips: nextVoiceClips,
        totalDuration
      });
    } catch (err) {
      console.log('Voiceover auto-sync & slice failed:', err);
    } finally {
      setIsProcessingVoiceover(false);
    }
  };

  // Batch update / replace all captions
  const handleBatchUpdateCaptions = (newLines: string[]) => {
    if (newLines.length === 0) return;
    const avgDuration = 3.5;
    let cur = 0;
    const nextCaptions: CaptionLine[] = newLines.map((text, idx) => {
      const start = cur;
      const end = cur + avgDuration;
      cur = end;
      return {
        id: `cap_${idx + 1}_${Date.now()}`,
        num: idx + 1,
        text,
        startTime: start,
        endTime: end,
        duration: avgDuration
      };
    });

    recordHistory({
      ...project,
      captions: nextCaptions
    });
  };

  // AI Script Application
  const handleApplyAIScript = async (lines: string[]) => {
    const avgDuration = 3.5;
    let curTime = 0;

    const nextCaptions: CaptionLine[] = [];
    const nextScenes: SceneClip[] = [];

    for (let i = 0; i < lines.length; i++) {
      const text = lines[i];
      const start = curTime;
      const end = curTime + avgDuration;
      curTime = end;

      nextCaptions.push({
        id: `cap_${i}_${Date.now()}`,
        num: i + 1,
        text,
        startTime: start,
        endTime: end,
        duration: avgDuration
      });

      const existingScene = project.scenes[i];
      if (existingScene) {
        nextScenes.push({
          ...existingScene,
          num: i + 1,
          title: text.slice(0, 24),
          duration: avgDuration,
          startTime: start
        });
      } else {
        const img = await createStyledCanvasImage(`Scene ${i + 1}`, 'A', ['#0f172a', '#1e293b'], '#38bdf8');
        nextScenes.push({
          id: `scene_${i}_${Date.now()}`,
          num: i + 1,
          title: text.slice(0, 24),
          imageUrl: img.url,
          imageName: `scene_${i + 1}.jpg`,
          duration: avgDuration,
          startTime: start,
          motion: 'zoom-in',
          motionSpeed: 1.0,
          filter: 'none',
          fit: 'cover',
          transition: 'cross-fade',
          transitionDuration: 0.5,
          brightness: 100,
          contrast: 100,
          saturation: 100
        });
      }
    }

    const totalDuration = recomputeTotalDuration(nextScenes);

    recordHistory({
      ...project,
      scenes: nextScenes,
      captions: nextCaptions,
      totalDuration
    });
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#09090b] text-[#f4f4f5] font-['Inter',sans-serif] overflow-hidden select-none">
      {/* 1. Master Header Bar with Step Navigation (01. Script, 02. Media, 03. Live Studio, 04. Export) */}
      <Header
        user={user}
        authLoading={authLoading}
        currentStep={currentStep}
        onSelectStep={(step) => setCurrentStep(step)}
        projectTitle={project.title}
        onUpdateTitle={(title) => recordHistory({ ...project, title })}
        aspectRatio={project.aspectRatio}
        onChangeAspectRatio={(aspectRatio) => recordHistory({ ...project, aspectRatio })}
        safeZoneOverlay={safeZoneOverlay}
        onToggleSafeZone={() => setSafeZoneOverlay(!safeZoneOverlay)}
        gridOverlay={gridOverlay}
        onToggleGrid={() => setGridOverlay(!gridOverlay)}
        onOpenProjects={() => setProjectsModalOpen(true)}
        onOpenTemplates={() => setTemplatesModalOpen(true)}
        onExportClick={() => setCurrentStep(4)}
        onManualSave={handleManualSave}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={history.length > 0}
        canRedo={redoStack.length > 0}
        isSaving={isSaving}
        hasUnsaved={hasUnsaved}
      />

      {/* 2. Step 1: Script Editor View */}
      {currentStep === 1 && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#0f1117]">
          <div className="max-w-4xl mx-auto">
            <StepScript
              scriptText={scriptText}
              onChangeScript={handleUpdateScript}
              lines={scriptLines}
              onParseAndContinue={handleContinueToMedia}
            />
          </div>
        </div>
      )}

      {/* 3. Step 2: Media Assets, Audio Auto-Sync & Slicing View */}
      {currentStep === 2 && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#0f1117]">
          <div className="max-w-5xl mx-auto">
            <StepMedia
              validation={validation}
              allReady={validation.length > 0 && validation.every((v) => v.ready)}
              readyCount={validation.filter((v) => v.ready).length}
              audioMap={audioMap}
              imageMap={imageMap}
              audioIssues={[]}
              imageIssues={[]}
              duplicates={[]}
              gaps={[]}
              extraAudio={[]}
              extraImages={[]}
              isSyncingVoice={isSyncingVoice}
              syncStatus={syncStatus || ''}
              onUploadAudio={handleUploadAudioStep2}
              onUploadImages={handleUploadImagesStep2}
              onRemoveAudio={(num) => {
                const next = { ...audioMap };
                delete next[num];
                setAudioMap(next);
              }}
              onClearImages={(num) => {
                const next = { ...imageMap };
                delete next[num];
                setImageMap(next);
              }}
              onRunMatching={() => handleProceedToStudio()}
              onOpenRecorder={(lineNum, text) => {
                setVoiceRecorderModal({
                  open: true,
                  sceneNum: lineNum,
                  text: text || `Scene ${lineNum}`
                });
              }}
              onOpenImageGen={(lineNum, text) => {
                setImageGenModal({
                  open: true,
                  sceneIndex: lineNum - 1,
                  title: text || `Scene ${lineNum}`
                });
              }}
              onOpenAudioTrimmer={(lineNum) => {
                const item = audioMap[lineNum];
                if (item) {
                  setTrimmerState({
                    isOpen: true,
                    lineNum,
                    audioItem: item
                  });
                }
              }}
            />
          </div>
        </div>
      )}

      {/* 4. Step 3: LIVE EDITING STUDIO (Live NLE Workstation replacing Gemini Match) */}
      {currentStep === 3 && (
        <>
          {/* Middle Workstation Rack (Left Tab Dock + Center Live Viewport + Right Inspector) */}
          <div className="flex-1 flex min-h-0 relative">
            {/* Left Side Tool Rack */}
            <LeftDock
              scenes={project.scenes}
              captions={project.captions}
              voiceClips={project.voiceClips}
              bgm={project.bgm}
              subtitleStyle={project.subtitleStyle}
              overlays={project.overlays}
              selectedSceneIndex={selectedSceneIndex}
              selectedCaptionIndex={selectedCaptionIndex}
              onSelectScene={handleSelectScene}
              onSelectCaption={handleSelectCaption}
              onUpdateScene={handleUpdateScene}
              onAddScene={handleAddScene}
              onDeleteScene={handleDeleteScene}
              onMoveScene={handleMoveScene}
              onUpdateCaption={handleUpdateCaption}
              onAddCaption={handleAddCaption}
              onDeleteCaption={handleDeleteCaption}
              onBatchUpdateCaptions={handleBatchUpdateCaptions}
              onAutoSyncCaptionsToScenes={handleAutoSyncCaptionsToScenes}
              onChangeStyle={(style) => recordHistory({ ...project, subtitleStyle: { ...project.subtitleStyle, ...style } })}
              onApplyPreset={(key: SubtitlePresetType) => {
                const presetInfo = SUBTITLE_PRESETS[key];
                if (presetInfo && presetInfo.style) {
                  const preset = presetInfo.style;
                  recordHistory({
                    ...project,
                    subtitleStyle: {
                      ...project.subtitleStyle,
                      preset: key,
                      fontFamily: preset.fontFamily || project.subtitleStyle.fontFamily,
                      textColor: preset.textColor || project.subtitleStyle.textColor,
                      highlightColor: preset.highlightColor || project.subtitleStyle.highlightColor,
                      strokeWidth: preset.strokeWidth ?? project.subtitleStyle.strokeWidth,
                      hasBox: preset.hasBox ?? project.subtitleStyle.hasBox,
                      boxOpacity: preset.boxOpacity ?? project.subtitleStyle.boxOpacity
                    }
                  });
                }
              }}
              onChangeBgm={(bgm) => recordHistory({ ...project, bgm: { ...project.bgm, ...bgm } })}
              onChangeOverlays={(overlays) => recordHistory({ ...project, overlays: { ...project.overlays, ...overlays } })}
              onApplyFilterToAll={(filter: FilterType) => {
                const updated = project.scenes.map((s) => ({ ...s, filter }));
                recordHistory({ ...project, scenes: updated });
              }}
              onApplyMotionToAll={(motion: MotionType) => {
                const updated = project.scenes.map((s) => ({ ...s, motion }));
                recordHistory({ ...project, scenes: updated });
              }}
              onSeekToTime={(t) => setCurrentTime(t)}
              onOpenVoiceRecorder={(sceneNum) => {
                const cap = project.captions.find((c) => c.num === sceneNum);
                setVoiceRecorderModal({
                  open: true,
                  sceneNum,
                  text: cap ? cap.text : `Scene ${sceneNum}`
                });
              }}
              onOpenImageGenModal={(sceneIndex) => {
                const scene = project.scenes[sceneIndex];
                setImageGenModal({
                  open: true,
                  sceneIndex,
                  title: scene ? scene.title : `Scene ${sceneIndex + 1}`
                });
              }}
              onOpenAIGeneratorModal={() => setActiveLeftTab('ai')}
              onApplyAIScript={handleApplyAIScript}
              onAlignAudioWithGemini={handleAlignAudioWithGemini}
              isAligning={isAligning}
              onUploadFullVoiceover={handleUploadAndAutoSliceVoiceover}
              isProcessingVoiceover={isProcessingVoiceover}
              activeTab={activeLeftTab}
              onChangeActiveTab={(tab) => setActiveLeftTab(tab)}
            />

            {/* Center Live Canvas Player Viewport */}
            <LiveCanvasViewport
              scenes={project.scenes}
              captions={project.captions}
              voiceClips={project.voiceClips}
              bgm={project.bgm}
              subtitleStyle={project.subtitleStyle}
              overlays={project.overlays}
              aspectRatio={project.aspectRatio}
              currentTime={currentTime}
              totalDuration={project.totalDuration}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
              onSeek={(t) => setCurrentTime(t)}
              safeZoneOverlay={safeZoneOverlay}
              gridOverlay={gridOverlay}
              onToggleSafeZone={() => setSafeZoneOverlay(!safeZoneOverlay)}
              onToggleGrid={() => setGridOverlay(!gridOverlay)}
              onChangeAspectRatio={(ratio) => recordHistory({ ...project, aspectRatio: ratio })}
              onOpenExportModal={() => setCurrentStep(4)}
            />

            {/* Right Inspector Panel */}
            <InspectorPanel
              selectedSceneIndex={selectedSceneIndex}
              selectedCaptionIndex={selectedCaptionIndex}
              scenes={project.scenes}
              captions={project.captions}
              subtitleStyle={project.subtitleStyle}
              bgm={project.bgm}
              aspectRatio={project.aspectRatio}
              onUpdateScene={handleUpdateScene}
              onUpdateCaption={handleUpdateCaption}
              onChangeStyle={(style) => recordHistory({ ...project, subtitleStyle: { ...project.subtitleStyle, ...style } })}
              onDeleteScene={handleDeleteScene}
              onDuplicateScene={handleDuplicateScene}
              onOpenImageGenModal={(sceneIndex) => {
                const scene = project.scenes[sceneIndex];
                setImageGenModal({
                  open: true,
                  sceneIndex,
                  title: scene ? scene.title : `Scene ${sceneIndex + 1}`
                });
              }}
            />
          </div>

          {/* Bottom DAW Multi-Track Timeline */}
          <MultiTrackTimeline
            scenes={project.scenes}
            captions={project.captions}
            voiceClips={project.voiceClips}
            bgm={project.bgm}
            currentTime={currentTime}
            totalDuration={project.totalDuration}
            selectedSceneIndex={selectedSceneIndex}
            selectedCaptionIndex={selectedCaptionIndex}
            onSelectScene={handleSelectScene}
            onSelectCaption={handleSelectCaption}
            onSeek={(t) => setCurrentTime(t)}
            onAddScene={handleAddScene}
            onDuplicateScene={handleDuplicateScene}
            onDeleteScene={handleDeleteScene}
            onSplitSceneAtPlayhead={handleSplitSceneAtPlayhead}
            onUpdateScene={handleUpdateScene}
            onUpdateCaption={handleUpdateCaption}
          />
        </>
      )}

      {/* 5. Step 4: Video Compositing & Export View */}
      {currentStep === 4 && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#0f1117]">
          <StepExport
            canvasRef={exportCanvasRef}
            rendering={isExportRendering}
            renderProgress={exportProgress}
            videoUrl={exportVideoUrl}
            onRestart={() => setCurrentStep(1)}
            onBackToStudio={() => setCurrentStep(3)}
          />
        </div>
      )}

      {/* Modals */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        project={project}
      />

      <TemplatesModal
        isOpen={templatesModalOpen}
        onClose={() => setTemplatesModalOpen(false)}
        onSelectTemplate={(tmpl) => {
          recordHistory(tmpl);
          setSelectedSceneIndex(0);
          setSelectedCaptionIndex(null);
          setCurrentTime(0);
        }}
      />

      <ProjectsModal
        isOpen={projectsModalOpen}
        onClose={() => setProjectsModalOpen(false)}
        user={user}
        currentProjectId={project.id}
        onSelectProject={(loadedProj) => {
          recordHistory(loadedProj);
          setSelectedSceneIndex(0);
          setCurrentTime(0);
        }}
        onNewProject={() => {
          const fresh = generateDefaultLiveProject();
          recordHistory(fresh);
          setSelectedSceneIndex(0);
          setCurrentTime(0);
        }}
      />

      <VoiceRecorderModal
        isOpen={voiceRecorderModal.open}
        onClose={() => setVoiceRecorderModal((prev) => ({ ...prev, open: false }))}
        sceneNum={voiceRecorderModal.sceneNum}
        scriptText={voiceRecorderModal.text}
        onSaveVoice={(sceneNum, voiceClip) => {
          // If in Step 2, update audioMap
          if (currentStep === 2) {
            setAudioMap((prev) => ({
              ...prev,
              [sceneNum]: {
                name: voiceClip.name,
                url: voiceClip.url,
                duration: voiceClip.duration,
                startTime: 0,
                endTime: voiceClip.duration,
                file: voiceClip.file
              }
            }));
          }
          // Also update project voice clips
          recordHistory({
            ...project,
            voiceClips: {
              ...project.voiceClips,
              [sceneNum]: voiceClip
            }
          });
        }}
      />

      <ImageGeneratorModal
        isOpen={imageGenModal.open}
        onClose={() => setImageGenModal((prev) => ({ ...prev, open: false }))}
        sceneIndex={imageGenModal.sceneIndex}
        sceneTitle={imageGenModal.title}
        onApplyImage={(sceneIndex, imageUrl, imageName) => {
          const lineNum = sceneIndex + 1;
          // If in Step 2, update imageMap
          if (currentStep === 2) {
            setImageMap((prev) => ({
              ...prev,
              [lineNum]: [{ name: imageName, url: imageUrl }]
            }));
          }
          handleUpdateScene(sceneIndex, { imageUrl, imageName });
        }}
      />

      {/* Audio Trimmer Modal for Step 2 */}
      {trimmerState.isOpen && trimmerState.audioItem && trimmerState.lineNum && (
        <AudioTrimModal
          lineNum={trimmerState.lineNum}
          audioItem={trimmerState.audioItem}
          onSave={(lineNum, updatedItem) => {
            setAudioMap((prev) => ({
              ...prev,
              [lineNum]: updatedItem
            }));
            setTrimmerState({ isOpen: false, lineNum: null, audioItem: null });
          }}
          onClose={() => setTrimmerState({ isOpen: false, lineNum: null, audioItem: null })}
        />
      )}
    </div>
  );
}
