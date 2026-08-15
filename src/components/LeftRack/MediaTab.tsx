import React, { useRef } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Sparkles, 
  Plus, 
  Trash2, 
  MoveUp, 
  MoveDown,
  Layers,
  Wand2
} from 'lucide-react';
import type { SceneClip } from '../../types';
import { createStyledCanvasImage } from '../../utils/audio';

interface MediaTabProps {
  scenes: SceneClip[];
  selectedSceneIndex: number | null;
  onSelectScene: (index: number) => void;
  onUpdateScene: (index: number, partial: Partial<SceneClip>) => void;
  onAddScene: () => void;
  onDeleteScene: (index: number) => void;
  onMoveScene: (fromIndex: number, toIndex: number) => void;
  onOpenImageGenModal: (sceneIndex: number) => void;
}

export const MediaTab: React.FC<MediaTabProps> = ({
  scenes,
  selectedSceneIndex,
  onSelectScene,
  onUpdateScene,
  onAddScene,
  onDeleteScene,
  onMoveScene,
  onOpenImageGenModal
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceIndexRef = useRef<number | null>(null);

  // Handle uploading multiple visual images as new scenes
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      if (!file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      const newNum = scenes.length + 1;
      const totalOffset = scenes.reduce((acc, s) => acc + s.duration, 0);

      const newScene: SceneClip = {
        id: `scene_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        num: newNum,
        title: file.name.replace(/\.[^/.]+$/, ''),
        imageUrl: url,
        imageName: file.name,
        imageFile: file,
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

      // append
      onAddScene();
    });

    e.target.value = '';
  };

  // Replace image for specific scene
  const handleReplaceImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || replaceIndexRef.current === null) return;
    const file: File = files[0];
    const url = URL.createObjectURL(file);
    onUpdateScene(replaceIndexRef.current, {
      imageUrl: url,
      imageName: file.name,
      imageFile: file
    });
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 text-[#e4e4e7] space-y-4">
      {/* Upload Drop Area */}
      <div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          multiple
          accept="image/*"
          className="hidden"
        />
        <input
          type="file"
          ref={replaceInputRef}
          onChange={handleReplaceImage}
          accept="image/*"
          className="hidden"
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border border-dashed border-[#3f3f46] hover:border-[#ffd400] bg-[#18181b] hover:bg-[#202025] rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
        >
          <div className="w-10 h-10 rounded-full bg-[#27272a] group-hover:bg-[#ffd400]/15 flex items-center justify-center text-[#ffd400] transition-colors">
            <Upload size={18} />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#f4f4f5]">Upload Visual Images</p>
            <p className="text-[10px] text-[#a1a1aa] mt-0.5">Drag & drop or click to add JPG/PNG/WebP</p>
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#f4f4f5]">
          <Layers size={14} className="text-[#ffd400]" />
          <span>Visual Clips ({scenes.length})</span>
        </div>

        <button
          onClick={onAddScene}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#27272a] hover:bg-[#3f3f46] text-[#ffd400] transition-colors cursor-pointer"
        >
          <Plus size={12} />
          <span>Add Scene</span>
        </button>
      </div>

      {/* Scene Clips List */}
      <div className="space-y-2">
        {scenes.map((scene, index) => {
          const isSelected = selectedSceneIndex === index;
          return (
            <div
              key={scene.id || index}
              onClick={() => onSelectScene(index)}
              className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'border-[#ffd400] bg-[#27272a]/90 shadow-md ring-1 ring-[#ffd400]/40'
                  : 'border-[#27272a] bg-[#18181b] hover:border-[#3f3f46]'
              }`}
            >
              {/* Thumbnail */}
              <div className="relative w-14 h-20 rounded-lg overflow-hidden bg-[#09090b] flex-shrink-0 border border-[#3f3f46]/50">
                <img
                  src={scene.imageUrl}
                  alt={scene.title}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-1 left-1 text-[9px] font-mono font-bold px-1 rounded bg-[#000000]/80 text-[#ffd400]">
                  #{index + 1}
                </span>
                <span className="absolute bottom-1 right-1 text-[9px] font-mono px-1 rounded bg-[#000000]/80 text-[#a1a1aa]">
                  {scene.duration.toFixed(1)}s
                </span>
              </div>

              {/* Clip Info & Actions */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#f4f4f5] truncate">
                    {scene.title || `Scene ${index + 1}`}
                  </p>
                  <span className="text-[10px] font-mono text-[#ffd400] bg-[#ffd400]/10 px-1.5 py-0.5 rounded">
                    {scene.motion}
                  </span>
                </div>

                <p className="text-[10px] text-[#a1a1aa] mt-0.5 truncate">
                  {scene.imageName || 'Canvas Media'} • Filter: {scene.filter}
                </p>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-1.5 mt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      replaceIndexRef.current = index;
                      replaceInputRef.current?.click();
                    }}
                    className="text-[10px] px-2 py-0.5 rounded bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] hover:text-[#ffd400] transition-colors"
                  >
                    Replace
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenImageGenModal(index);
                    }}
                    className="text-[10px] px-2 py-0.5 rounded bg-[#ffd400]/10 hover:bg-[#ffd400]/20 text-[#ffd400] flex items-center gap-1 transition-colors"
                    title="Generate visual with AI prompt"
                  >
                    <Wand2 size={9} />
                    <span>AI Gen</span>
                  </button>

                  <div className="flex-1" />

                  {/* Move Up / Down */}
                  {index > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onMoveScene(index, index - 1); }}
                      className="p-1 rounded text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#3f3f46]"
                      title="Move up"
                    >
                      <MoveUp size={11} />
                    </button>
                  )}
                  {index < scenes.length - 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onMoveScene(index, index + 1); }}
                      className="p-1 rounded text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#3f3f46]"
                      title="Move down"
                    >
                      <MoveDown size={11} />
                    </button>
                  )}

                  {scenes.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteScene(index); }}
                      className="p-1 rounded text-[#a1a1aa] hover:text-[#ef4444] hover:bg-[#ef4444]/10"
                      title="Delete scene"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
