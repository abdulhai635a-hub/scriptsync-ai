import React, { useState } from 'react';
import { 
  Clapperboard, 
  RotateCcw, 
  FolderOpen, 
  Sparkles, 
  LogIn, 
  LogOut, 
  Cloud, 
  Edit2, 
  Check, 
  Loader2,
  Download,
  Smartphone,
  Monitor,
  Square,
  Maximize2,
  Grid,
  Shield,
  Undo2,
  Redo2,
  Save,
  Film,
  FileText,
  Layers
} from 'lucide-react';
import { signInWithGoogle, signOutUser, type User } from '../lib/firebase';
import type { AspectRatioType } from '../types';

interface HeaderProps {
  user: User | null;
  authLoading: boolean;
  currentStep: 1 | 2 | 3 | 4;
  onSelectStep: (step: 1 | 2 | 3 | 4) => void;
  projectTitle: string;
  onUpdateTitle: (title: string) => void;
  aspectRatio: AspectRatioType;
  onChangeAspectRatio: (ratio: AspectRatioType) => void;
  safeZoneOverlay: boolean;
  onToggleSafeZone: () => void;
  gridOverlay: boolean;
  onToggleGrid: () => void;
  onOpenProjects: () => void;
  onOpenTemplates: () => void;
  onExportClick: () => void;
  onManualSave: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isSaving: boolean;
  hasUnsaved: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  authLoading,
  currentStep,
  onSelectStep,
  projectTitle,
  onUpdateTitle,
  aspectRatio,
  onChangeAspectRatio,
  safeZoneOverlay,
  onToggleSafeZone,
  gridOverlay,
  onToggleGrid,
  onOpenProjects,
  onOpenTemplates,
  onExportClick,
  onManualSave,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  isSaving,
  hasUnsaved
}) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(projectTitle);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSaveTitle = () => {
    if (tempTitle.trim()) {
      onUpdateTitle(tempTitle.trim());
    }
    setEditingTitle(false);
  };

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign in failed:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      setShowUserMenu(false);
      await signOutUser();
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  return (
    <header className="flex items-center justify-between px-4 py-2.5 border-b border-[#27272a] bg-[#121215] text-[#f4f4f5] select-none z-30">
      {/* Left: Brand, Project Title & Undo/Redo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#ffd400] to-[#f59e0b] shadow-sm text-[#09090b]">
          <Film size={18} strokeWidth={2.5} />
        </div>

        <div className="flex items-center gap-2 border-r border-[#27272a] pr-3">
          <span className="font-['Space_Grotesk'] font-bold text-sm text-[#ffffff] tracking-tight hidden sm:inline">
            Studio Pro
          </span>
          <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#ffd400]/15 text-[#ffd400] border border-[#ffd400]/30 font-bold">
            Live NLE
          </span>
        </div>

        {/* Project Title */}
        <div className="flex items-center gap-2">
          {editingTitle ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                onBlur={handleSaveTitle}
                autoFocus
                className="bg-[#1e1e24] border border-[#ffd400] text-xs text-[#ffffff] px-2 py-1 rounded outline-none w-44 font-medium"
              />
              <button
                onClick={handleSaveTitle}
                className="p-1 hover:bg-[#27272a] text-[#ffd400] rounded"
                title="Save title"
              >
                <Check size={13} />
              </button>
            </div>
          ) : (
            <div 
              className="flex items-center gap-1.5 group cursor-pointer px-2 py-1 rounded hover:bg-[#1f1f23] transition-colors" 
              onClick={() => { setTempTitle(projectTitle); setEditingTitle(true); }}
            >
              <span className="text-xs text-[#e4e4e7] font-semibold max-w-[160px] truncate">
                {projectTitle}
              </span>
              <Edit2 size={10} className="text-[#a1a1aa] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}

          {/* Cloud Auto-Save Pill */}
          <button 
            onClick={onManualSave}
            className="flex items-center gap-1 text-[10px] text-[#a1a1aa] font-mono hover:text-[#ffd400] px-1.5 py-0.5 rounded hover:bg-[#1f1f23] transition-colors"
            title="Click to save project now"
          >
            {isSaving ? (
              <>
                <Loader2 size={10} className="animate-spin text-[#ffd400]" />
                <span className="text-[#ffd400]">Saving...</span>
              </>
            ) : user ? (
              <>
                <Cloud size={11} className="text-[#10b981]" />
                <span className="text-[#10b981]">Saved</span>
              </>
            ) : (
              <>
                <Save size={10} className="text-[#a1a1aa]" />
                <span>Local</span>
              </>
            )}
          </button>
        </div>

        {/* Undo / Redo */}
        <div className="hidden md:flex items-center gap-0.5 border-l border-[#27272a] pl-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#1f1f23] disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={13} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#1f1f23] disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={13} />
          </button>
        </div>
      </div>

      {/* Center: 4-Step Workflow Navigation & Studio Viewport Tools */}
      <div className="flex items-center gap-3">
        {/* Step Navigation Bar */}
        <nav className="flex items-center gap-1 bg-[#18181b] p-1 rounded-xl border border-[#27272a]">
          <button
            onClick={() => onSelectStep(1)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentStep === 1
                ? 'bg-[#ffd400] text-[#09090b] shadow-sm font-bold'
                : 'text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]'
            }`}
            title="Step 1: Script Editor"
          >
            <FileText size={12} />
            <span className="hidden sm:inline">01.</span>
            <span>Script</span>
          </button>

          <button
            onClick={() => onSelectStep(2)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentStep === 2
                ? 'bg-[#ffd400] text-[#09090b] shadow-sm font-bold'
                : 'text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]'
            }`}
            title="Step 2: Media Assets & Audio Auto-Slice"
          >
            <Layers size={12} />
            <span className="hidden sm:inline">02.</span>
            <span>Media</span>
          </button>

          <button
            onClick={() => onSelectStep(3)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentStep === 3
                ? 'bg-[#ffd400] text-[#09090b] shadow-sm font-bold'
                : 'text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]'
            }`}
            title="Step 3: Live Editing Studio & Visual Matching"
          >
            <Sparkles size={12} />
            <span className="hidden sm:inline">03.</span>
            <span>Live Studio</span>
          </button>

          <button
            onClick={() => onSelectStep(4)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentStep === 4
                ? 'bg-[#ffd400] text-[#09090b] shadow-sm font-bold'
                : 'text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]'
            }`}
            title="Step 4: Render & Export"
          >
            <Download size={12} />
            <span className="hidden sm:inline">04.</span>
            <span>Export</span>
          </button>
        </nav>

        {/* Aspect Ratio & Canvas Overlays when in Step 3 */}
        {currentStep === 3 && (
          <div className="hidden xl:flex items-center gap-2 bg-[#18181b] p-1 rounded-lg border border-[#27272a]">
            {/* Aspect Ratio Buttons */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onChangeAspectRatio('9:16')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                  aspectRatio === '9:16'
                    ? 'bg-[#ffd400] text-[#09090b] shadow-sm'
                    : 'text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]'
                }`}
                title="9:16 Vertical (TikTok / Shorts / Reels)"
              >
                <Smartphone size={11} />
                <span>9:16</span>
              </button>

              <button
                onClick={() => onChangeAspectRatio('16:9')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                  aspectRatio === '16:9'
                    ? 'bg-[#ffd400] text-[#09090b] shadow-sm'
                    : 'text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]'
                }`}
                title="16:9 Landscape (YouTube / Desktop)"
              >
                <Monitor size={11} />
                <span>16:9</span>
              </button>

              <button
                onClick={() => onChangeAspectRatio('1:1')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                  aspectRatio === '1:1'
                    ? 'bg-[#ffd400] text-[#09090b] shadow-sm'
                    : 'text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]'
                }`}
                title="1:1 Square (Instagram Feed / Post)"
              >
                <Square size={11} />
                <span>1:1</span>
              </button>
            </div>

            <div className="w-[1px] h-4 bg-[#27272a]" />

            {/* Safe Zone & Grid Guides */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={onToggleSafeZone}
                className={`p-1.5 rounded text-[11px] transition-colors ${
                  safeZoneOverlay
                    ? 'bg-[#ffd400]/20 text-[#ffd400]'
                    : 'text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]'
                }`}
                title="Toggle Safe Zone Guides"
              >
                <Shield size={12} />
              </button>

              <button
                onClick={onToggleGrid}
                className={`p-1.5 rounded text-[11px] transition-colors ${
                  gridOverlay
                    ? 'bg-[#ffd400]/20 text-[#ffd400]'
                    : 'text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]'
                }`}
                title="Toggle Rule-of-Thirds Grid Overlay"
              >
                <Grid size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: Templates, Projects, Export & Auth */}
      <div className="flex items-center gap-2">
        {/* Templates */}
        <button
          onClick={onOpenTemplates}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#ffd400] bg-[#ffd400]/10 border border-[#ffd400]/25 hover:bg-[#ffd400]/20 transition-colors"
          title="Explore ready-made demo templates"
        >
          <Sparkles size={12} />
          <span>Templates</span>
        </button>

        {/* Projects */}
        <button
          onClick={onOpenProjects}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#e4e4e7] bg-[#18181b] border border-[#27272a] hover:border-[#ffd400]/50 transition-colors"
          title="Open projects in Firestore"
        >
          <FolderOpen size={12} className="text-[#a1a1aa]" />
          <span className="hidden sm:inline">Projects</span>
        </button>

        {/* Export Video (High priority Action) */}
        <button
          onClick={onExportClick}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-[#09090b] bg-[#ffd400] hover:bg-[#ffe14d] transition-all shadow-md shadow-[#ffd400]/15 active:scale-95 cursor-pointer"
          title="Render and download full video with audio"
        >
          <Download size={13} strokeWidth={2.5} />
          <span>Export Video</span>
        </button>

        {/* Google Authentication */}
        {authLoading ? (
          <div className="w-7 h-7 rounded-full bg-[#18181b] flex items-center justify-center border border-[#27272a]">
            <Loader2 size={12} className="animate-spin text-[#ffd400]" />
          </div>
        ) : user ? (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1.5 pl-1.5 pr-1 py-1 rounded-full bg-[#18181b] border border-[#27272a] hover:border-[#ffd400]/50 transition-all"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="avatar"
                  className="w-5 h-5 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-[#ffd400] text-[#09090b] font-bold text-[10px] flex items-center justify-center">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 py-1.5 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl z-50 animate-in fade-in">
                <div className="px-3 py-2 border-b border-[#27272a]">
                  <p className="text-xs font-semibold text-[#f4f4f5] truncate">
                    {user.displayName || 'Google Creator'}
                  </p>
                  <p className="text-[10px] text-[#a1a1aa] truncate">{user.email}</p>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => { setShowUserMenu(false); onOpenProjects(); }}
                    className="w-full px-3 py-1.5 text-left text-xs text-[#e4e4e7] hover:bg-[#27272a] flex items-center gap-2"
                  >
                    <FolderOpen size={12} className="text-[#ffd400]" />
                    <span>Cloud Projects</span>
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="w-full px-3 py-1.5 text-left text-xs text-[#ef4444] hover:bg-[#27272a] flex items-center gap-2"
                  >
                    <LogOut size={12} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={handleSignIn}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#ffd400] bg-[#ffd400]/10 border border-[#ffd400]/30 hover:bg-[#ffd400]/20 transition-all"
            title="Sign in with Google to sync projects to cloud"
          >
            <LogIn size={12} />
            <span className="hidden md:inline">Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};
