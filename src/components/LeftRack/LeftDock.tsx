import React, { useState } from 'react';
import { 
  FolderOpen, 
  Type, 
  Palette, 
  Music, 
  Sparkles, 
  Layers, 
  Wand2, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import { MediaTab } from './MediaTab';
import { CaptionsTab } from './CaptionsTab';
import { StyleTab } from './StyleTab';
import { AudioTab } from './AudioTab';
import { EffectsTab } from './EffectsTab';
import { OverlaysTab } from './OverlaysTab';
import { AIToolsTab } from './AIToolsTab';
import type { 
  SceneClip, 
  CaptionLine, 
  VoiceClip, 
  BgmTrackConfig, 
  SubtitleStyleConfig, 
  OverlayConfig, 
  FilterType, 
  MotionType, 
  SubtitlePresetType 
} from '../../types';

export type LeftTabKey = 'media' | 'captions' | 'style' | 'audio' | 'effects' | 'overlays' | 'ai';

interface LeftDockProps {
  scenes: SceneClip[];
  captions: CaptionLine[];
  voiceClips: Record<number, VoiceClip>;
  bgm: BgmTrackConfig;
  subtitleStyle: SubtitleStyleConfig;
  overlays: OverlayConfig;
  selectedSceneIndex: number | null;
  selectedCaptionIndex: number | null;
  onSelectScene: (index: number) => void;
  onSelectCaption: (index: number) => void;
  onUpdateScene: (index: number, partial: Partial<SceneClip>) => void;
  onAddScene: () => void;
  onDeleteScene: (index: number) => void;
  onMoveScene: (fromIndex: number, toIndex: number) => void;
  onUpdateCaption: (index: number, partial: Partial<CaptionLine>) => void;
  onAddCaption: (afterIndex?: number) => void;
  onDeleteCaption: (index: number) => void;
  onBatchUpdateCaptions?: (lines: string[]) => void;
  onAutoSyncCaptionsToScenes: () => void;
  onChangeStyle: (partial: Partial<SubtitleStyleConfig>) => void;
  onApplyPreset: (presetKey: SubtitlePresetType) => void;
  onChangeBgm: (partial: Partial<BgmTrackConfig>) => void;
  onChangeOverlays: (partial: Partial<OverlayConfig>) => void;
  onApplyFilterToAll: (filter: FilterType) => void;
  onApplyMotionToAll: (motion: MotionType) => void;
  onSeekToTime: (time: number) => void;
  onOpenVoiceRecorder: (sceneNum: number) => void;
  onOpenImageGenModal: (sceneIndex: number) => void;
  onOpenAIGeneratorModal: () => void;
  onApplyAIScript: (lines: string[]) => void;
  onAlignAudioWithGemini: () => Promise<void>;
  isAligning: boolean;
  onUploadFullVoiceover?: (file: File) => Promise<void>;
  isProcessingVoiceover?: boolean;
  activeTab: LeftTabKey;
  onChangeActiveTab: (tab: LeftTabKey) => void;
}

export const LeftDock: React.FC<LeftDockProps> = ({
  scenes,
  captions,
  voiceClips,
  bgm,
  subtitleStyle,
  overlays,
  selectedSceneIndex,
  selectedCaptionIndex,
  onSelectScene,
  onSelectCaption,
  onUpdateScene,
  onAddScene,
  onDeleteScene,
  onMoveScene,
  onUpdateCaption,
  onAddCaption,
  onDeleteCaption,
  onBatchUpdateCaptions,
  onAutoSyncCaptionsToScenes,
  onChangeStyle,
  onApplyPreset,
  onChangeBgm,
  onChangeOverlays,
  onApplyFilterToAll,
  onApplyMotionToAll,
  onSeekToTime,
  onOpenVoiceRecorder,
  onOpenImageGenModal,
  onOpenAIGeneratorModal,
  onApplyAIScript,
  onAlignAudioWithGemini,
  isAligning,
  onUploadFullVoiceover,
  isProcessingVoiceover = false,
  activeTab,
  onChangeActiveTab
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const TABS = [
    { key: 'media' as LeftTabKey, label: 'Media', icon: FolderOpen },
    { key: 'captions' as LeftTabKey, label: 'Captions', icon: Type },
    { key: 'style' as LeftTabKey, label: 'Style', icon: Palette },
    { key: 'audio' as LeftTabKey, label: 'Audio', icon: Music },
    { key: 'effects' as LeftTabKey, label: 'FX & Motion', icon: Sparkles },
    { key: 'overlays' as LeftTabKey, label: 'Overlays', icon: Layers },
    { key: 'ai' as LeftTabKey, label: 'AI Tools', icon: Wand2 },
  ];

  return (
    <aside className="flex h-full border-r border-[#27272a] bg-[#121215] select-none z-20 transition-all">
      {/* Icon Rail (Vertical Navigation Bar) */}
      <div className="flex flex-col items-center py-3 px-1.5 border-r border-[#27272a] bg-[#0d0d10] space-y-1.5 flex-shrink-0 w-16">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                onChangeActiveTab(tab.key);
                if (isCollapsed) setIsCollapsed(false);
              }}
              className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#ffd400] text-[#09090b] shadow-md shadow-[#ffd400]/20 font-bold'
                  : 'text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b]'
              }`}
              title={tab.label}
            >
              <Icon size={18} />
              <span className="text-[9px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}

        <div className="flex-1" />

        {/* Collapse toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#18181b] transition-colors"
          title={isCollapsed ? 'Expand Dock' : 'Collapse Dock'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Main Tab Panel Content */}
      {!isCollapsed && (
        <div className="w-80 h-full flex flex-col bg-[#121215] overflow-hidden">
          {activeTab === 'media' && (
            <MediaTab
              scenes={scenes}
              selectedSceneIndex={selectedSceneIndex}
              onSelectScene={onSelectScene}
              onUpdateScene={onUpdateScene}
              onAddScene={onAddScene}
              onDeleteScene={onDeleteScene}
              onMoveScene={onMoveScene}
              onOpenImageGenModal={onOpenImageGenModal}
            />
          )}

          {activeTab === 'captions' && (
            <CaptionsTab
              captions={captions}
              scenes={scenes}
              voiceClips={voiceClips}
              selectedCaptionIndex={selectedCaptionIndex}
              onSelectCaption={onSelectCaption}
              onUpdateCaption={onUpdateCaption}
              onAddCaption={onAddCaption}
              onDeleteCaption={onDeleteCaption}
              onBatchUpdateCaptions={onBatchUpdateCaptions}
              onAutoSyncCaptionsToScenes={onAutoSyncCaptionsToScenes}
              onSeekToTime={onSeekToTime}
              onOpenAIGeneratorModal={onOpenAIGeneratorModal}
            />
          )}

          {activeTab === 'style' && (
            <StyleTab
              style={subtitleStyle}
              onChangeStyle={onChangeStyle}
              onApplyPreset={onApplyPreset}
            />
          )}

          {activeTab === 'audio' && (
            <AudioTab
              bgm={bgm}
              onChangeBgm={onChangeBgm}
              voiceClips={voiceClips}
              scenes={scenes}
              captions={captions}
              onOpenVoiceRecorder={onOpenVoiceRecorder}
              onUploadFullVoiceover={onUploadFullVoiceover}
              isProcessingVoiceover={isProcessingVoiceover}
            />
          )}

          {activeTab === 'effects' && (
            <EffectsTab
              selectedScene={selectedSceneIndex !== null ? scenes[selectedSceneIndex] : null}
              selectedSceneIndex={selectedSceneIndex}
              onUpdateScene={onUpdateScene}
              onApplyFilterToAll={onApplyFilterToAll}
              onApplyMotionToAll={onApplyMotionToAll}
            />
          )}

          {activeTab === 'overlays' && (
            <OverlaysTab
              overlays={overlays}
              onChangeOverlays={onChangeOverlays}
            />
          )}

          {activeTab === 'ai' && (
            <AIToolsTab
              scenes={scenes}
              captions={captions}
              onApplyAIScript={onApplyAIScript}
              onOpenImageGenModal={onOpenImageGenModal}
              onAlignAudioWithGemini={onAlignAudioWithGemini}
              isAligning={isAligning}
            />
          )}
        </div>
      )}
    </aside>
  );
};
