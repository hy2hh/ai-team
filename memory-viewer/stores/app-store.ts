import { create } from 'zustand';

interface AppState {
  selectedFile: string | null;
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  rightPanelTab: 'backlinks' | 'outline';
  searchQuery: string;
  expandedFolders: Set<string>;
  editingFile: string | null;
  isEditing: boolean;

  selectFile: (path: string | null) => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setRightPanelTab: (tab: 'backlinks' | 'outline') => void;
  setSearchQuery: (query: string) => void;
  toggleFolder: (path: string) => void;
  expandFolder: (path: string) => void;
  setEditingFile: (path: string | null) => void;
  setIsEditing: (editing: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedFile: null,
  sidebarOpen: true,
  rightPanelOpen: true,
  rightPanelTab: 'backlinks',
  searchQuery: '',
  expandedFolders: new Set<string>(),
  editingFile: null,
  isEditing: false,

  selectFile: (path) => set({ selectedFile: path, isEditing: false, editingFile: null }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleFolder: (path) =>
    set((s) => {
      const next = new Set(s.expandedFolders);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return { expandedFolders: next };
    }),
  expandFolder: (path) =>
    set((s) => {
      const next = new Set(s.expandedFolders);
      next.add(path);
      return { expandedFolders: next };
    }),
  setEditingFile: (path) => set({ editingFile: path }),
  setIsEditing: (editing) => set({ isEditing: editing }),
}));
