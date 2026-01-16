import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SelectionStore {
  selectedIds: Set<number>;
  pstId: string | null;
  toggleSelection: (id: number) => void;
  clearSelection: () => void;
  setPstId: (id: string) => void;
  isSelected: (id: number) => boolean;
}

export const useSelectionStore = create<SelectionStore>()(
  persist(
    (set, get) => ({
      selectedIds: new Set<number>(),
      pstId: null,
      toggleSelection: (id: number) =>
        set((state) => {
          const newSet = new Set(state.selectedIds);
          if (newSet.has(id)) {
            newSet.delete(id);
          } else {
            newSet.add(id);
          }
          return { selectedIds: newSet };
        }),
      clearSelection: () => set({ selectedIds: new Set<number>() }),
      setPstId: (id: string) => set({ pstId: id }),
      isSelected: (id: number) => get().selectedIds.has(id),
    }),
    {
      name: 'pst-vault-selection',
      partialize: (state) => ({
        selectedIds: Array.from(state.selectedIds),
        pstId: state.pstId,
      }),
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        selectedIds: new Set(persistedState?.selectedIds || []),
        pstId: persistedState?.pstId || null,
      }),
    }
  )
);

interface ThemeStore {
  isDark: boolean;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      isDark: false,
      toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
    }),
    {
      name: 'pst-vault-theme',
    }
  )
);
