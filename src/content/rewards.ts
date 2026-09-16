import type { EncounterId } from '../domain/types'

export const YU_ZHUANG_POOL = ['R01', 'R02', 'R03', 'R06'] as const
export const BO_SHOU_POOL = ['R04', 'R05', 'R07', 'R08'] as const

export function rewardPool(encounterId: EncounterId): readonly string[] {
  if (encounterId === 'yuZhuang') return YU_ZHUANG_POOL
  if (encounterId === 'boShou') return BO_SHOU_POOL
  return []
}
