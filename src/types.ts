export type AspectRatioType = '9:16' | '16:9' | '1:1' | '4:5';

export type MotionType = 'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'drift';
export type FilterType = 'none' | 'vibrant' | 'cinematic' | 'noir' | 'vintage' | 'warm' | 'cool' | 'cyberpunk' | 'retro-wave';
export type TransitionType = 'none' | 'fade' | 'cross-fade' | 'dissolve' | 'slide-left' | 'slide-right' | 'zoom' | 'wipe' | 'glitch';
export type FitMode = 'cover' | 'contain' | 'fill';

export interface SceneClip {
  id: string;
  num: number;
  title: string;
  imageUrl: string;
  imageName?: string;
  imageFile?: File | Blob;
  duration: number; // in seconds
  startTime: number; // calculated offset on timeline
  motion: MotionType;
  motionSpeed: number; // 0.5 to 2.0
  filter: FilterType;
  fit: FitMode;
  transition: TransitionType;
  transitionDuration: number;
  brightness: number; // 0 - 200 (100 default)
  contrast: number; // 0 - 200 (100 default)
  saturation: number; // 0 - 200 (100 default)
}

export interface CaptionWord {
  word: string;
  start: number;
  end: number;
}

export interface CaptionLine {
  id: string;
  num: number;
  text: string;
  startTime: number;
  endTime: number;
  duration: number;
  words?: CaptionWord[];
}

export interface VoiceClip {
  id: string;
  num: number;
  name: string;
  url: string;
  file?: File | Blob;
  startTime: number;
  duration: number;
  volume: number; // 0.0 - 2.0
  isMuted?: boolean;
}

export interface BgmTrackConfig {
  enabled: boolean;
  id: string;
  title: string;
  genre: string;
  url?: string;
  volume: number; // 0.0 - 1.0
  loop: boolean;
  fadeIn: number;
  fadeOut: number;
}

export type SubtitlePresetType = 
  | 'tiktok-yellow' 
  | 'viral-karaoke' 
  | 'clean-modern' 
  | 'cyberpunk-neon' 
  | 'cinematic-serif' 
  | 'comic-pop' 
  | 'minimal-box'
  | 'fire-gradient';

export type SubtitleAnimationType = 
  | 'pop' 
  | 'word-glow' 
  | 'bounce' 
  | 'wave' 
  | 'slide-up' 
  | 'typewriter' 
  | 'fade' 
  | 'none';

export type SubtitleChunkMode = 'smart-dynamic' | '3-words' | '4-words' | '5-words' | '6-words' | 'full';

export interface SubtitleStyleConfig {
  preset: SubtitlePresetType;
  fontFamily: string;
  fontSize: number; // relative size 20 - 64
  textColor: string;
  highlightColor: string;
  strokeColor: string;
  strokeWidth: number; // 0 - 8
  hasShadow: boolean;
  shadowColor: string;
  hasBox: boolean;
  boxColor: string;
  boxOpacity: number;
  positionY: number; // 10% to 90%, default 82%
  animation: SubtitleAnimationType;
  chunkMode?: SubtitleChunkMode;
  maxWordsPerChunk?: number; // default 3 - 6 words randomly/rhythmically
  textTransform: 'none' | 'uppercase' | 'capitalize';
}

export interface OverlayConfig {
  showWatermark: boolean;
  watermarkText: string;
  showProgressBar: boolean;
  progressBarColor: string;
  showSoundwave: boolean;
  soundwaveColor: string;
  showCtaBadge: boolean;
  ctaText: string;
  ctaPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export interface VideoProjectData {
  id: string;
  userId?: string;
  title: string;
  aspectRatio: AspectRatioType;
  scenes: SceneClip[];
  captions: CaptionLine[];
  voiceClips: Record<number, VoiceClip>;
  bgm: BgmTrackConfig;
  subtitleStyle: SubtitleStyleConfig;
  overlays: OverlayConfig;
  totalDuration: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectDocument extends VideoProjectData {
  userId: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// Legacy compatibility types if needed during transition
export interface ScriptLine {
  num: number;
  text: string;
  duplicate?: boolean;
}

export interface AudioItem {
  file: File | Blob;
  name: string;
  url: string;
  duration: number;
  startTime?: number;
  endTime?: number;
  isMasterTrackSlice?: boolean;
  masterAudioUrl?: string;
  masterDuration?: number;
}

export interface ImageItem {
  file: File | Blob;
  name: string;
  url: string;
  previewUrl?: string;
  dataBase64?: string;
}

export interface LineValidation extends ScriptLine {
  audioOk: boolean;
  audio?: AudioItem;
  imagesCount: number;
  imagesOk: boolean;
  images: ImageItem[];
  ready: boolean;
}

export interface MatchSelection {
  index: number;
  confidence: number;
  reason: string;
  method: 'ai' | 'manual' | 'fallback';
  needsReview: boolean;
}
