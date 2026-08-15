import { createStyledCanvasImage, createSyntheticAudioBlob } from './audio';
import type { 
  SceneClip, 
  CaptionLine, 
  VoiceClip, 
  BgmTrackConfig, 
  SubtitleStyleConfig, 
  OverlayConfig, 
  VideoProjectData,
  SubtitlePresetType 
} from '../types';

export const SUBTITLE_PRESETS: Record<SubtitlePresetType, { name: string; description: string; style: Partial<SubtitleStyleConfig> }> = {
  'tiktok-yellow': {
    name: 'Viral Yellow',
    description: 'High contrast yellow text with bold dark stroke',
    style: {
      preset: 'tiktok-yellow',
      fontFamily: 'Space Grotesk',
      fontSize: 38,
      textColor: '#FFD400',
      highlightColor: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 5,
      hasShadow: true,
      shadowColor: 'rgba(0,0,0,0.8)',
      hasBox: false,
      boxColor: '#000000',
      boxOpacity: 0.6,
      positionY: 82,
      animation: 'word-glow',
      textTransform: 'uppercase'
    }
  },
  'viral-karaoke': {
    name: 'Karaoke Neon Glow',
    description: 'Word-by-word active glow with emerald highlights',
    style: {
      preset: 'viral-karaoke',
      fontFamily: 'Inter',
      fontSize: 40,
      textColor: '#FFFFFF',
      highlightColor: '#22C55E',
      strokeColor: '#022C22',
      strokeWidth: 4,
      hasShadow: true,
      shadowColor: 'rgba(0,255,136,0.3)',
      hasBox: true,
      boxColor: '#0f172a',
      boxOpacity: 0.75,
      positionY: 80,
      animation: 'word-glow',
      textTransform: 'uppercase'
    }
  },
  'clean-modern': {
    name: 'Minimal Studio',
    description: 'Clean sans-serif with subtle contrast box',
    style: {
      preset: 'clean-modern',
      fontFamily: 'Inter',
      fontSize: 34,
      textColor: '#FFFFFF',
      highlightColor: '#38BDF8',
      strokeColor: '#0F172A',
      strokeWidth: 2,
      hasShadow: false,
      shadowColor: 'rgba(0,0,0,0.5)',
      hasBox: true,
      boxColor: '#000000',
      boxOpacity: 0.7,
      positionY: 84,
      animation: 'fade',
      textTransform: 'none'
    }
  },
  'cyberpunk-neon': {
    name: 'Cyberpunk Neon',
    description: 'Cyan and magenta electric glow with mono font',
    style: {
      preset: 'cyberpunk-neon',
      fontFamily: 'JetBrains Mono',
      fontSize: 36,
      textColor: '#00F0FF',
      highlightColor: '#FF0055',
      strokeColor: '#120024',
      strokeWidth: 5,
      hasShadow: true,
      shadowColor: 'rgba(0,240,255,0.6)',
      hasBox: true,
      boxColor: '#1a0826',
      boxOpacity: 0.85,
      positionY: 82,
      animation: 'pop',
      textTransform: 'uppercase'
    }
  },
  'cinematic-serif': {
    name: 'Cinematic Movie',
    description: 'Golden movie subtitle styling with wide tracking',
    style: {
      preset: 'cinematic-serif',
      fontFamily: 'Space Grotesk',
      fontSize: 32,
      textColor: '#FEF08A',
      highlightColor: '#F59E0B',
      strokeColor: '#451A03',
      strokeWidth: 3,
      hasShadow: true,
      shadowColor: 'rgba(0,0,0,0.9)',
      hasBox: false,
      boxColor: '#000000',
      boxOpacity: 0.5,
      positionY: 86,
      animation: 'fade',
      textTransform: 'none'
    }
  },
  'comic-pop': {
    name: 'Comic Pop',
    description: 'Bold expressive font with thick cartoon border',
    style: {
      preset: 'comic-pop',
      fontFamily: 'Space Grotesk',
      fontSize: 42,
      textColor: '#FF0055',
      highlightColor: '#FFE600',
      strokeColor: '#FFFFFF',
      strokeWidth: 6,
      hasShadow: true,
      shadowColor: 'rgba(0,0,0,0.95)',
      hasBox: false,
      boxColor: '#000000',
      boxOpacity: 0.5,
      positionY: 78,
      animation: 'pop',
      textTransform: 'uppercase'
    }
  },
  'minimal-box': {
    name: 'Pill Badge',
    description: 'Rounded pill container for maximum readability',
    style: {
      preset: 'minimal-box',
      fontFamily: 'Inter',
      fontSize: 32,
      textColor: '#FFFFFF',
      highlightColor: '#FBBF24',
      strokeColor: 'transparent',
      strokeWidth: 0,
      hasShadow: false,
      shadowColor: 'transparent',
      hasBox: true,
      boxColor: '#1E293B',
      boxOpacity: 0.9,
      positionY: 85,
      animation: 'typewriter',
      textTransform: 'none'
    }
  },
  'fire-gradient': {
    name: 'Flame Surge',
    description: 'Orange & crimson energetic video creator style',
    style: {
      preset: 'fire-gradient',
      fontFamily: 'Space Grotesk',
      fontSize: 40,
      textColor: '#FF5722',
      highlightColor: '#FFD700',
      strokeColor: '#260000',
      strokeWidth: 5,
      hasShadow: true,
      shadowColor: 'rgba(255,87,34,0.5)',
      hasBox: true,
      boxColor: '#1a0505',
      boxOpacity: 0.8,
      positionY: 80,
      animation: 'word-glow',
      textTransform: 'uppercase'
    }
  }
};

export const STOCK_BGM_TRACKS = [
  {
    id: 'lofi_chill',
    title: 'Midnight Lo-Fi Coffee',
    genre: 'Lo-Fi Chill',
    duration: 30,
    tempo: 75,
    key: 'C Minor'
  },
  {
    id: 'cyber_synth',
    title: 'Neo-Tokyo Overdrive',
    genre: 'Synthwave / Electronic',
    duration: 30,
    tempo: 120,
    key: 'D Minor'
  },
  {
    id: 'cinematic_pulse',
    title: 'Deep Orbit Cinematic',
    genre: 'Cinematic Ambient',
    duration: 30,
    tempo: 90,
    key: 'A Minor'
  },
  {
    id: 'upbeat_groove',
    title: 'Sunburst Summer Pop',
    genre: 'Upbeat Energetic',
    duration: 30,
    tempo: 128,
    key: 'G Major'
  },
  {
    id: 'dramatic_tension',
    title: 'Quantum Mystery',
    genre: 'Suspense & Drama',
    duration: 30,
    tempo: 80,
    key: 'E Minor'
  },
  {
    id: 'none',
    title: 'No Background Music',
    genre: 'Muted',
    duration: 0,
    tempo: 0,
    key: ''
  }
];

// Generates Web Audio musical loops dynamically for stock BGM
export function createSyntheticMusicBlob(genreKey: string, durationSec = 30): Promise<{ blob: Blob; url: string }> {
  return new Promise((resolve) => {
    const sampleRate = 44100;
    const totalSamples = Math.floor(sampleRate * durationSec);
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
    const buffer = audioContext.createBuffer(2, totalSamples, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    const bpm = genreKey.includes('cyber') ? 120 : genreKey.includes('upbeat') ? 128 : 80;
    const beatSec = 60 / bpm;

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      const beat = (t / beatSec) % 4;
      let sampleL = 0;
      let sampleR = 0;

      if (genreKey.includes('lofi')) {
        // Soft warm chords + gentle kick / snare
        const chords = [220, 261.63, 329.63, 392]; // Am7
        chords.forEach((freq, idx) => {
          const osc = Math.sin(2 * Math.PI * freq * t + idx * 0.3);
          const filter = Math.sin(2 * Math.PI * 0.2 * t);
          sampleL += osc * 0.05 * (0.8 + 0.2 * filter);
          sampleR += Math.sin(2 * Math.PI * (freq * 1.002) * t) * 0.05;
        });
        // Kick on beat 0, Snare on beat 2
        if (beat < 0.2) {
          sampleL += Math.sin(2 * Math.PI * 55 * (beat / 0.2)) * (1 - beat / 0.2) * 0.3;
          sampleR += Math.sin(2 * Math.PI * 55 * (beat / 0.2)) * (1 - beat / 0.2) * 0.3;
        } else if (beat > 2.0 && beat < 2.2) {
          const sT = beat - 2.0;
          const noise = (Math.random() * 2 - 1) * (1 - sT / 0.2) * 0.15;
          sampleL += noise;
          sampleR += noise;
        }
      } else if (genreKey.includes('cyber')) {
        // Driving synth bassline + arp
        const bassFreq = [55, 65.41, 73.42, 82.41][Math.floor((t / (beatSec * 4)) % 4)];
        const bass = Math.sin(2 * Math.PI * bassFreq * t) + 0.4 * Math.sin(2 * Math.PI * bassFreq * 2 * t);
        const arpStep = Math.floor((t / (beatSec / 4)) % 8);
        const arpFreq = bassFreq * [2, 2.5, 3, 4, 3, 2.5, 4, 5][arpStep];
        const arp = Math.sin(2 * Math.PI * arpFreq * t) * 0.12;

        sampleL += (bass * 0.18 + arp * 0.8) * 0.4;
        sampleR += (bass * 0.18 + arp * 0.8) * 0.4;
      } else if (genreKey.includes('cinematic')) {
        // Deep sub drone + atmospheric swell
        const sub = Math.sin(2 * Math.PI * 45 * t) * 0.2;
        const pad = (Math.sin(2 * Math.PI * 110 * t) + Math.sin(2 * Math.PI * 164.81 * t)) * 0.08 * (0.6 + 0.4 * Math.sin(t * 0.5));
        sampleL += sub + pad;
        sampleR += sub + pad * 1.1;
      } else {
        // Ambient melodic tone
        const tone = (Math.sin(2 * Math.PI * 146.83 * t) + Math.sin(2 * Math.PI * 220 * t)) * 0.1;
        sampleL += tone;
        sampleR += tone;
      }

      // Smooth master envelope
      const env = Math.min(1, t / 1.5) * Math.min(1, (durationSec - t) / 1.5);
      left[i] = Math.max(-1, Math.min(1, sampleL * env));
      right[i] = Math.max(-1, Math.min(1, sampleR * env));
    }

    // Convert to WAV
    const numOfChan = 2;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    let pos = 0;

    function setUint16(data: number) { out.setUint16(pos, data, true); pos += 2; }
    function setUint32(data: number) { out.setUint32(pos, data, true); pos += 4; }

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8);
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt "
    setUint32(16);
    setUint16(1);
    setUint16(numOfChan);
    setUint32(sampleRate);
    setUint32(sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);
    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4);

    let offset = 0;
    while (offset < buffer.length) {
      for (let ch = 0; ch < numOfChan; ch++) {
        const s = ch === 0 ? left[offset] : right[offset];
        const val = (0.5 + s < 0 ? s * 32768 : s * 32767) | 0;
        out.setInt16(pos, Math.max(-32768, Math.min(32767, val)), true);
        pos += 2;
      }
      offset++;
    }

    const blob = new Blob([out.buffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    resolve({ blob, url });
  });
}

// Built-in Sample Projects for instant exploration
export async function createDefaultProject(templateKey = 'cyberpunk'): Promise<VideoProjectData> {
  const templates: Record<string, {
    title: string;
    lines: string[];
    gradients: [string, string][];
    accents: string[];
    preset: SubtitlePresetType;
    bgmId: string;
    filter: any;
    motion: any;
  }> = {
    cyberpunk: {
      title: 'Neon Odyssey 2099',
      lines: [
        'Neon reflections danced across rain-slicked asphalt at 3 AM.',
        'An autonomous courier darted through the towering sky bridges.',
        'Encrypted memory drives hummed inside the titanium briefcase.',
        'Security drones swept searchlights over the crowded megacity.',
        'She leaped onto the hyper-train just before the blast doors sealed.'
      ],
      gradients: [
        ['#09090b', '#18181b'],
        ['#1e1b4b', '#312e81'],
        ['#022c22', '#064e3b'],
        ['#3b0764', '#581c87'],
        ['#451a03', '#78350f']
      ],
      accents: ['#00F0FF', '#FF0055', '#22C55E', '#A855F7', '#F59E0B'],
      preset: 'tiktok-yellow',
      bgmId: 'cyber_synth',
      filter: 'cyberpunk',
      motion: 'zoom-in'
    },
    ancient_mars: {
      title: 'Echoes of Ancient Mars',
      lines: [
        'Beneath the crimson dunes lay the ruins of an ancient sanctuary.',
        'The explorer discovered a glowing crystal buried in the red stone.',
        'Decoded alien glyphs pulsed with vibrant bio-luminescent light.',
        'Humanity had finally unlocked the forgotten coordinates to the stars.'
      ],
      gradients: [
        ['#451a03', '#9a3412'],
        ['#1c1917', '#44403c'],
        ['#042f2e', '#115e59'],
        ['#311042', '#701a75']
      ],
      accents: ['#FB923C', '#F43F5E', '#2DD4BF', '#E879F9'],
      preset: 'viral-karaoke',
      bgmId: 'cinematic_pulse',
      filter: 'cinematic',
      motion: 'drift'
    },
    moonlight: {
      title: 'The Moonlight Signal',
      lines: [
        'The valley was quiet, streets bathed in silver moonlight.',
        'Then a golden ember flickered in the highest astronomy tower.',
        'A celestial melody whispered through the night sky.'
      ],
      gradients: [
        ['#0f172a', '#1e293b'],
        ['#1e1b4b', '#4338ca'],
        ['#064e3b', '#047857']
      ],
      accents: ['#38BDF8', '#818CF8', '#34D399'],
      preset: 'clean-modern',
      bgmId: 'lofi_chill',
      filter: 'vibrant',
      motion: 'pan-right'
    }
  };

  const selected = templates[templateKey] || templates.cyberpunk;
  const scenes: SceneClip[] = [];
  const captions: CaptionLine[] = [];
  const voiceClips: Record<number, VoiceClip> = {};

  let currentOffset = 0;

  for (let i = 0; i < selected.lines.length; i++) {
    const num = i + 1;
    const text = selected.lines[i];
    const dur = 3.2 + (i % 2) * 0.4;
    const grad = selected.gradients[i % selected.gradients.length];
    const accent = selected.accents[i % selected.accents.length];

    // Generate styled visual canvas
    const imgData = await createStyledCanvasImage(`Scene ${num} — ${text.slice(0, 24)}...`, 'A', grad, accent);
    
    // Generate voice tone
    const voiceData = await createSyntheticAudioBlob(dur, 200 + num * 25, `Line ${num}`);

    const scene: SceneClip = {
      id: `scene_${num}_${Date.now()}`,
      num,
      title: `Scene ${num}`,
      imageUrl: imgData.url,
      imageFile: imgData.file,
      duration: dur,
      startTime: currentOffset,
      motion: i % 2 === 0 ? 'zoom-in' : 'pan-right',
      motionSpeed: 1.0,
      filter: 'none',
      fit: 'cover',
      transition: i === 0 ? 'none' : 'cross-fade' as any,
      transitionDuration: 0.5,
      brightness: 100,
      contrast: 100,
      saturation: 100
    };

    // Calculate words
    const words = text.split(' ').map((w, wIdx, arr) => {
      const wDur = dur / arr.length;
      return {
        word: w,
        start: currentOffset + wIdx * wDur,
        end: currentOffset + (wIdx + 1) * wDur
      };
    });

    const caption: CaptionLine = {
      id: `caption_${num}_${Date.now()}`,
      num,
      text,
      startTime: currentOffset,
      endTime: currentOffset + dur,
      duration: dur,
      words
    };

    const voice: VoiceClip = {
      id: `voice_${num}_${Date.now()}`,
      num,
      name: `Scene_${num}_Voice.wav`,
      url: voiceData.url,
      file: voiceData.blob,
      startTime: currentOffset,
      duration: dur,
      volume: 1.0,
      isMuted: false
    };

    scenes.push(scene);
    captions.push(caption);
    voiceClips[num] = voice;

    currentOffset += dur;
  }

  // Generate BGM
  const bgmAsset = await createSyntheticMusicBlob(selected.bgmId, Math.max(30, currentOffset + 5));

  const bgm: BgmTrackConfig = {
    enabled: true,
    id: selected.bgmId,
    title: STOCK_BGM_TRACKS.find(t => t.id === selected.bgmId)?.title || 'Cyber Synth Pulse',
    genre: 'Synthwave',
    url: bgmAsset.url,
    volume: 0.25,
    loop: true,
    fadeIn: 1.0,
    fadeOut: 1.5
  };

  const presetStyle = SUBTITLE_PRESETS[selected.preset]?.style || SUBTITLE_PRESETS['tiktok-yellow'].style;

  const subtitleStyle: SubtitleStyleConfig = {
    preset: selected.preset,
    fontFamily: presetStyle.fontFamily || 'Space Grotesk',
    fontSize: presetStyle.fontSize || 38,
    textColor: presetStyle.textColor || '#FFD400',
    highlightColor: presetStyle.highlightColor || '#FFFFFF',
    strokeColor: presetStyle.strokeColor || '#000000',
    strokeWidth: presetStyle.strokeWidth ?? 5,
    hasShadow: presetStyle.hasShadow ?? true,
    shadowColor: presetStyle.shadowColor || 'rgba(0,0,0,0.8)',
    hasBox: presetStyle.hasBox ?? false,
    boxColor: presetStyle.boxColor || '#000000',
    boxOpacity: presetStyle.boxOpacity ?? 0.6,
    positionY: presetStyle.positionY ?? 82,
    animation: presetStyle.animation || 'word-glow',
    textTransform: presetStyle.textTransform || 'uppercase'
  };

  const overlays: OverlayConfig = {
    showWatermark: false,
    watermarkText: 'SCRIPTSYNC STUDIO',
    showProgressBar: true,
    progressBarColor: '#FFD400',
    showSoundwave: false,
    soundwaveColor: '#38BDF8',
    showCtaBadge: false,
    ctaText: 'FOLLOW FOR MORE',
    ctaPosition: 'bottom-right'
  };

  return {
    id: `proj_${Date.now()}`,
    title: selected.title,
    aspectRatio: '9:16',
    scenes,
    captions,
    voiceClips,
    bgm,
    subtitleStyle,
    overlays,
    totalDuration: Number(currentOffset.toFixed(2)),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function generateDefaultLiveProject(): VideoProjectData {
  const scenes: SceneClip[] = [
    {
      id: 'scene_1',
      num: 1,
      title: 'Neon Odyssey 2099',
      imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1000&auto=format&fit=crop',
      imageName: 'cyberpunk_city.jpg',
      duration: 3.5,
      startTime: 0,
      motion: 'zoom-in',
      motionSpeed: 1.0,
      filter: 'none',
      fit: 'cover',
      transition: 'none',
      transitionDuration: 0.5,
      brightness: 100,
      contrast: 100,
      saturation: 100
    },
    {
      id: 'scene_2',
      num: 2,
      title: 'Autonomous Courier',
      imageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1000&auto=format&fit=crop',
      imageName: 'sky_bridge.jpg',
      duration: 3.5,
      startTime: 3.5,
      motion: 'pan-right',
      motionSpeed: 1.0,
      filter: 'cyberpunk',
      fit: 'cover',
      transition: 'cross-fade',
      transitionDuration: 0.5,
      brightness: 100,
      contrast: 100,
      saturation: 100
    },
    {
      id: 'scene_3',
      num: 3,
      title: 'Encrypted Quantum Drive',
      imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1000&auto=format&fit=crop',
      imageName: 'quantum_matrix.jpg',
      duration: 4.0,
      startTime: 7.0,
      motion: 'zoom-out',
      motionSpeed: 1.0,
      filter: 'none',
      fit: 'cover',
      transition: 'cross-fade',
      transitionDuration: 0.5,
      brightness: 100,
      contrast: 100,
      saturation: 100
    },
    {
      id: 'scene_4',
      num: 4,
      title: 'Hyper-Train Escape',
      imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000&auto=format&fit=crop',
      imageName: 'hyper_rail.jpg',
      duration: 4.0,
      startTime: 11.0,
      motion: 'pan-left',
      motionSpeed: 1.0,
      filter: 'cinematic',
      fit: 'cover',
      transition: 'cross-fade',
      transitionDuration: 0.5,
      brightness: 100,
      contrast: 100,
      saturation: 100
    }
  ];

  const captions: CaptionLine[] = [
    {
      id: 'cap_1',
      num: 1,
      text: 'Neon reflections danced across rain-slicked asphalt at 3 AM.',
      startTime: 0,
      endTime: 3.5,
      duration: 3.5,
      words: [
        { word: 'Neon', start: 0, end: 0.5 },
        { word: 'reflections', start: 0.5, end: 1.1 },
        { word: 'danced', start: 1.1, end: 1.6 },
        { word: 'across', start: 1.6, end: 2.1 },
        { word: 'asphalt', start: 2.1, end: 2.8 },
        { word: 'at 3 AM.', start: 2.8, end: 3.5 }
      ]
    },
    {
      id: 'cap_2',
      num: 2,
      text: 'An autonomous courier darted through the towering sky bridges.',
      startTime: 3.5,
      endTime: 7.0,
      duration: 3.5,
      words: [
        { word: 'An', start: 3.5, end: 3.8 },
        { word: 'autonomous', start: 3.8, end: 4.5 },
        { word: 'courier', start: 4.5, end: 5.2 },
        { word: 'darted', start: 5.2, end: 5.8 },
        { word: 'through', start: 5.8, end: 6.3 },
        { word: 'sky bridges.', start: 6.3, end: 7.0 }
      ]
    },
    {
      id: 'cap_3',
      num: 3,
      text: 'Encrypted memory drives hummed inside the titanium briefcase.',
      startTime: 7.0,
      endTime: 11.0,
      duration: 4.0,
      words: [
        { word: 'Encrypted', start: 7.0, end: 7.8 },
        { word: 'memory', start: 7.8, end: 8.5 },
        { word: 'drives', start: 8.5, end: 9.2 },
        { word: 'hummed', start: 9.2, end: 9.9 },
        { word: 'titanium', start: 9.9, end: 10.4 },
        { word: 'briefcase.', start: 10.4, end: 11.0 }
      ]
    },
    {
      id: 'cap_4',
      num: 4,
      text: 'She leaped onto the hyper-train just before blast doors sealed.',
      startTime: 11.0,
      endTime: 15.0,
      duration: 4.0,
      words: [
        { word: 'She', start: 11.0, end: 11.4 },
        { word: 'leaped', start: 11.4, end: 12.0 },
        { word: 'onto', start: 12.0, end: 12.6 },
        { word: 'hyper-train', start: 12.6, end: 13.5 },
        { word: 'before doors', start: 13.5, end: 14.3 },
        { word: 'sealed.', start: 14.3, end: 15.0 }
      ]
    }
  ];

  const bgm: BgmTrackConfig = {
    enabled: true,
    id: 'cyber_synth',
    title: 'Neo-Tokyo Overdrive',
    genre: 'Synthwave / Electronic',
    volume: 0.25,
    loop: true,
    fadeIn: 1.0,
    fadeOut: 1.5
  };

  const subtitleStyle: SubtitleStyleConfig = {
    preset: 'tiktok-yellow',
    fontFamily: 'Space Grotesk',
    fontSize: 38,
    textColor: '#FFD400',
    highlightColor: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 5,
    hasShadow: true,
    shadowColor: 'rgba(0,0,0,0.85)',
    hasBox: false,
    boxColor: '#000000',
    boxOpacity: 0.6,
    positionY: 82,
    animation: 'word-glow',
    textTransform: 'uppercase'
  };

  const overlays: OverlayConfig = {
    showWatermark: false,
    watermarkText: 'SCRIPTSYNC STUDIO',
    showProgressBar: true,
    progressBarColor: '#FFD400',
    showSoundwave: false,
    soundwaveColor: '#38BDF8',
    showCtaBadge: false,
    ctaText: 'FOLLOW FOR MORE',
    ctaPosition: 'bottom-right'
  };

  return {
    id: `proj_${Date.now()}`,
    title: 'Cyberpunk Neon Chronicle',
    aspectRatio: '9:16',
    scenes,
    captions,
    voiceClips: {},
    bgm,
    subtitleStyle,
    overlays,
    totalDuration: 15.0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

