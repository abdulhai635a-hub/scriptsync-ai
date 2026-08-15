import { createSyntheticAudioBlob, createStyledCanvasImage } from './audio';
import type { AudioItem, ImageItem } from '../types';

export const SAMPLE_SCRIPTS = [
  {
    title: 'The Moonlight Signal (3 Lines)',
    linesCount: 3,
    text: `1. The village was quiet, streets empty under the moonlight.
2. Then a golden light flickered in the old tower window.
3. A celestial hum whispered through the valley, awakening the stars.`
  },
  {
    title: 'Echoes of Ancient Mars (5 Lines)',
    linesCount: 5,
    text: `1. Beneath the crimson dunes lay the ruins of an ancient sanctuary.
2. The rover discovered a glowing crystal structure buried in the stone.
3. Decoded glyphs pulsed with vibrant bio-luminescent energy.
4. An automated transmission beacon suddenly calibrated itself to Earth.
5. Humanity had finally unlocked the forgotten interplanetary coordinates.`
  },
  {
    title: 'Cyberpunk Odyssey (6 Lines)',
    linesCount: 6,
    text: `1. Neon reflections danced across rain-slicked asphalt at 3 AM.
2. An autonomous courier darted through the towering sky bridges.
3. Encrypted memory drives hummed inside the titanium briefcase.
4. Security drones swept searchlights over the crowded megacity alleys.
5. She leaped onto the magnetic transit train just before the gates sealed.
6. In this city of silicon and shadows, every second mattered.`
  },
  {
    title: 'Deep Ocean Expedition (10 Lines)',
    linesCount: 10,
    text: `1. The submarine descended silently through the twilight zone.
2. Pressure gauges climbed steadily into the thousands of atmospheres.
3. Bioluminescent jellyfish drifted past like living constellations.
4. Deep beneath the continental shelf, thermal vents glowed in the abyss.
5. Robotic manipulators reached out toward mineral-rich hydrothermal chimneys.
6. Sonar scanners picked up an unexpected structural anomaly in the trench.
7. A submerged cavern opened into an insulated volcanic biosphere.
8. Uncharted marine organisms swarmed in rhythmic, synchronized pulses.
9. HD cameras captured the first continuous footage of this hidden ecosystem.
10. The expedition had uncovered a new frontier of life on Earth.`
  },
  {
    title: 'Cosmic Voyage to the Rings of Saturn (15 Lines)',
    linesCount: 15,
    text: `1. The solar sails unfurled against the backdrop of deep space.
2. Thrusters ignited with a silent blue arc toward the outer planets.
3. Asteroids tumbled in quiet orbit along the asteroid belt.
4. Jupiter loomed vast and storm-swept as a gravitational slingshot.
5. Sensors calibrated for the frozen rings of Saturn.
6. Crystalline ice sheets reflected sunlight across billions of particles.
7. The probe entered the equatorial shadow of the giant gas planet.
8. Magnetic anomalies registered across the rings' intricate gaps.
9. Enceladus vented crystal water geysers into the icy vacuum.
10. Titan appeared like an amber marble wrapped in thick nitrogen haze.
11. Automated rovers separated from the mother ship for atmospheric descent.
12. High-gain antennas locked onto the deep space relay network.
13. Telemetry confirmed all atmospheric sensors operating at peak capacity.
14. Humanity's vision had reached into the outer reaches of the solar system.
15. The voyage into eternity was only just beginning.`
  }
];

export async function loadDemoAssets(selectedScriptIndex = 0): Promise<{
  scriptText: string;
  audioMap: Record<number, AudioItem>;
  imageMap: Record<number, ImageItem[]>;
}> {
  const sample = SAMPLE_SCRIPTS[selectedScriptIndex] || SAMPLE_SCRIPTS[0];
  const audioMap: Record<number, AudioItem> = {};
  const imageMap: Record<number, ImageItem[]> = {};

  const lines = sample.text.split('\n').filter(Boolean);
  const count = lines.length;

  const colorThemes = [
    { a: ['#0f172a', '#1e293b'] as [string, string], b: ['#1e1b4b', '#312e81'] as [string, string], cA: '#38bdf8', cB: '#818cf8' },
    { a: ['#451a03', '#78350f'] as [string, string], b: ['#701a75', '#86198f'] as [string, string], cA: '#fbbf24', cB: '#f43f5e' },
    { a: ['#064e3b', '#065f46'] as [string, string], b: ['#14532d', '#166534'] as [string, string], cA: '#34d399', cB: '#4ade80' },
    { a: ['#311042', '#4c1d95'] as [string, string], b: ['#1f2937', '#111827'] as [string, string], cA: '#ec4899', cB: '#a855f7' },
    { a: ['#1e3a8a', '#172554'] as [string, string], b: ['#042f2e', '#134e4a'] as [string, string], cA: '#60a5fa', cB: '#2dd4bf' },
    { a: ['#7c2d12', '#431407'] as [string, string], b: ['#3b0764', '#581c87'] as [string, string], cA: '#f97316', cB: '#d946ef' }
  ];

  for (let i = 1; i <= count; i++) {
    const pitch = 180 + ((i * 35) % 120);
    const lineDuration = 2.4 + (i % 3) * 0.4;
    
    // 1. Generate synthetic voice audio
    const { blob, url, duration } = await createSyntheticAudioBlob(lineDuration, pitch, `Voice Line ${i}`);
    const audioFile = new File([blob], `00${i}_narration_scene_${i}.wav`, { type: 'audio/wav' });
    audioMap[i] = {
      file: audioFile,
      name: audioFile.name,
      url,
      duration,
      startTime: 0,
      endTime: duration
    };

    // 2. Generate 2 distinct candidate images
    const theme = colorThemes[(i - 1) % colorThemes.length];
    const imgA = await createStyledCanvasImage(`Scene ${i} - Concept Alpha`, 'A', theme.a, theme.cA);
    const imgB = await createStyledCanvasImage(`Scene ${i} - Concept Beta`, 'B', theme.b, theme.cB);

    const fileA = new File([imgA.file], `00${i}_visual_alpha.jpg`, { type: 'image/jpeg' });
    const fileB = new File([imgB.file], `00${i}_visual_beta.jpg`, { type: 'image/jpeg' });

    imageMap[i] = [
      { file: fileA, name: fileA.name, url: imgA.url },
      { file: fileB, name: fileB.name, url: imgB.url }
    ];
  }

  return {
    scriptText: sample.text,
    audioMap,
    imageMap
  };
}
