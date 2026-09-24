import { create } from 'zustand'
import type { CameraMode, CellId } from '../game/types'

type InteractionStore = {
  cameraMode: CameraMode
  selectedCardInstanceId?: string
  hoveredCellId?: CellId
  selectedCellId?: CellId
  placementNotice?: string
  setCameraMode: (mode: CameraMode) => void
  resetBattleView: () => void
  beginCardPlacement: (cardInstanceId: string) => void
  finishCardPlacement: () => void
  setHoveredCell: (id?: CellId) => void
  selectCell: (id?: CellId) => void
  showPlacementNotice: (message?: string) => void
}

export const useInteractionStore = create<InteractionStore>((set) => ({
  cameraMode: 'board',
  setCameraMode: (cameraMode) => set({ cameraMode }),
  resetBattleView: () => set({ cameraMode: 'board', selectedCardInstanceId: undefined, selectedCellId: undefined, placementNotice: undefined }),
  beginCardPlacement: (selectedCardInstanceId) => set({ selectedCardInstanceId, cameraMode: 'overview', selectedCellId: undefined, placementNotice: undefined }),
  finishCardPlacement: () => set({ selectedCardInstanceId: undefined, selectedCellId: undefined, placementNotice: undefined }),
  setHoveredCell: (hoveredCellId) => set({ hoveredCellId }),
  selectCell: (selectedCellId) => set({ selectedCellId }),
  showPlacementNotice: (placementNotice) => set({ placementNotice }),
}))
