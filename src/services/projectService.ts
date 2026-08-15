import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp,
  type User 
} from '../lib/firebase';
import type { VideoProjectData } from '../types';

const PROJECTS_COLLECTION = 'projects';
const LOCAL_STORAGE_KEY = 'livescriptsync_project_draft';

export async function saveProjectToFirestore(
  projectData: VideoProjectData,
  user: User | null
): Promise<string> {
  const now = Date.now();
  const projectId = projectData.id || `proj_${now}_${Math.random().toString(36).substring(2, 7)}`;

  // Clean data for Firestore (remove File/Blob instances which cannot be serialized)
  const cleanProject: VideoProjectData = {
    ...projectData,
    id: projectId,
    scenes: projectData.scenes.map((s) => ({
      ...s,
      imageFile: undefined
    })),
    captions: projectData.captions,
    voiceClips: Object.fromEntries(
      Object.entries(projectData.voiceClips).map(([k, v]) => [
        k,
        { ...v, file: undefined }
      ])
    ),
    updatedAt: now
  };

  if (user) {
    try {
      const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
      await setDoc(projectRef, {
        ...cleanProject,
        userId: user.uid,
        serverUpdatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.warn('Firestore cloud save notice:', err);
    }
  }

  // Backup to localStorage
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleanProject));
  } catch (e) {
    console.warn('Could not save to localStorage:', e);
  }

  return projectId;
}

export async function fetchUserProjects(userId: string): Promise<VideoProjectData[]> {
  try {
    const q = query(
      collection(db, PROJECTS_COLLECTION),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    const list: VideoProjectData[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as VideoProjectData;
      list.push(data);
    });
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return list;
  } catch (error) {
    console.error('Error fetching projects from Firestore:', error);
    return [];
  }
}

export async function deleteProjectFromFirestore(projectId: string): Promise<void> {
  try {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    await deleteDoc(projectRef);
  } catch (error) {
    console.error('Error deleting project:', error);
    throw error;
  }
}

export function getLocalProjectDraft(): VideoProjectData | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
