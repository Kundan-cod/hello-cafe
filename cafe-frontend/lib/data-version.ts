import { create } from 'zustand'

type DataVersionState = {
  version: number
  bump: () => void
}

export const useDataVersion = create<DataVersionState>((set) => ({
  version: 0,
  bump: () => set((state) => ({ version: state.version + 1 })),
}))

