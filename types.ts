
export interface GeneratedImage {
  id: string;
  url: string;
  name: string;
  prompt: string;
  timestamp: number;
  characterId: string;
}

export interface GeneratedVideo {
  id: string;
  url: string;
  name: string;
  prompt: string;
  timestamp: number;
  characterId: string;
}

export interface Character {
  id: string;
  name: string;
  images: string[];
  createdAt: number;
}

export interface AppState {
  characters: Character[];
  activeCharacterId: string | null;
  styleReferenceImage: string | null;
  videoReferenceImage: string | null;
  photoPrompt: string;
  videoPrompt: string;
  history: GeneratedImage[];
  videoHistory: GeneratedVideo[];
  archivedImages: GeneratedImage[];
  archivedVideos: GeneratedVideo[];
  isProcessing: boolean;
  processingType: 'photo' | 'video' | null;
  activeTab: 'photo' | 'video' | 'album';
  activeSeason: 'summer' | 'autumn' | 'winter' | 'spring' | 'default';
  
  // Camera Settings
  aspectRatio: string;
  cameraAngle: string | null;
  shotScale: string | null;
  lensType: string | null;
  showCameraConfig: boolean;
  
  error: string | null;
}
