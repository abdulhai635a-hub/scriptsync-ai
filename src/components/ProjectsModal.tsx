import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  FolderOpen, 
  Calendar, 
  Film, 
  Loader2, 
  CloudOff, 
  LogIn
} from 'lucide-react';
import { fetchUserProjects, deleteProjectFromFirestore } from '../services/projectService';
import { signInWithGoogle, type User } from '../lib/firebase';
import type { VideoProjectData } from '../types';

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  currentProjectId?: string;
  onSelectProject: (project: VideoProjectData) => void;
  onNewProject: () => void;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  isOpen,
  onClose,
  user,
  currentProjectId,
  onSelectProject,
  onNewProject
}) => {
  const [projects, setProjects] = useState<VideoProjectData[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProjects = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchUserProjects(user.uid);
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      loadProjects();
    }
  }, [isOpen, user]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    setDeletingId(id);
    try {
      await deleteProjectFromFirestore(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div className="bg-[#121215] border border-[#27272a] rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-[#e4e4e7]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#27272a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#18181b] flex items-center justify-center border border-[#27272a]">
              <FolderOpen size={16} className="text-[#ffd400]" />
            </div>
            <div>
              <h2 className="font-['Space_Grotesk'] font-bold text-sm text-[#f4f4f5]">
                My Cloud Projects
              </h2>
              <p className="text-[11px] text-[#a1a1aa]">
                {user ? `Stored securely in Firestore for ${user.email}` : 'Sign in to access Cloud Sync'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {!user ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CloudOff size={36} className="text-[#a1a1aa] mb-3" />
              <h3 className="font-bold text-sm text-[#f4f4f5] mb-1">
                Sign in to save & load projects
              </h3>
              <p className="text-xs text-[#a1a1aa] max-w-xs mb-5">
                Connect with Google to sync your video timeline, scripts, and edits across devices.
              </p>
              <button
                onClick={signInWithGoogle}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-[#ffd400] text-[#09090b] hover:bg-[#ffe14d] transition-all cursor-pointer"
              >
                <LogIn size={15} />
                <span>Sign In with Google</span>
              </button>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={28} className="animate-spin text-[#ffd400] mb-2" />
              <span className="text-xs text-[#a1a1aa] font-mono">Loading from Firestore...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* New Project Action Card */}
              <button
                onClick={() => {
                  onNewProject();
                  onClose();
                }}
                className="flex items-center justify-between p-3.5 rounded-xl border border-dashed border-[#ffd400]/40 hover:border-[#ffd400] bg-[#ffd400]/5 hover:bg-[#ffd400]/10 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#ffd400]/15 flex items-center justify-center text-[#ffd400]">
                    <Plus size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#f4f4f5] group-hover:text-[#ffd400] transition-colors">
                      Start New Project
                    </h4>
                    <p className="text-[11px] text-[#a1a1aa]">Create a fresh blank timeline</p>
                  </div>
                </div>
              </button>

              {/* Projects List */}
              {projects.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#a1a1aa] bg-[#18181b] rounded-xl border border-[#27272a] p-6">
                  No saved cloud projects yet. When you edit and save your video, it will appear here.
                </div>
              ) : (
                projects.map((proj) => {
                  const isCurrent = proj.id === currentProjectId;
                  const dateStr = proj.updatedAt
                    ? new Date(proj.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'Recently';

                  return (
                    <div
                      key={proj.id}
                      onClick={() => {
                        onSelectProject(proj);
                        onClose();
                      }}
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-[#18181b] border-[#ffd400] ring-1 ring-[#ffd400]/40'
                          : 'bg-[#18181b] border-[#27272a] hover:border-[#3f3f46]'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-[#121215] border border-[#27272a] flex items-center justify-center text-[#ffd400] shrink-0 mt-0.5">
                          <Film size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-[#f4f4f5] truncate">
                              {proj.title || 'Untitled Video'}
                            </h4>
                            {isCurrent && (
                              <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-[#ffd400]/20 text-[#ffd400] font-bold">
                                Current
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#a1a1aa] font-mono">
                            <span className="flex items-center gap-1">
                              <Calendar size={10} />
                              {dateStr}
                            </span>
                            <span>{proj.scenes?.length || 0} Clips</span>
                            <span>{proj.aspectRatio || '9:16'}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDelete(e, proj.id!)}
                        disabled={deletingId === proj.id}
                        className="p-2 text-[#a1a1aa] hover:text-[#ef4444] hover:bg-[#27272a] rounded-lg transition-colors"
                        title="Delete project"
                      >
                        {deletingId === proj.id ? (
                          <Loader2 size={14} className="animate-spin text-[#ef4444]" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#27272a] bg-[#0d0d10] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-[#f4f4f5] bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
