
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

export interface AlbumFolder {
  id: string;
  name: string;
  createdAt: number;
  imageIds: string[];
  videoIds: string[];
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
  activeTab: 'photo' | 'video' | 'album' | 'quick';
  activeSeason: 'summer' | 'autumn' | 'winter' | 'spring' | 'default';
  
  // Quick Generate
  quickPrompt: string;
  quickReferenceImage: string | null;
  quickHistory: GeneratedImage[];
  
  // Camera Settings
  aspectRatio: string;
  cameraAngle: string | null;
  shotScale: string | null;
  lensType: string | null;
  showCameraConfig: boolean;
  
  // Album Folders & Selection
  albumFolders: AlbumFolder[];
  selectedFolderId: string | null; // Currently opened folder ID (character ID or 'quick')
  selectedItems: string[]; // Selected item IDs (images/videos)
  isSelectionMode: boolean;
  
  
  error: string | null;
}
