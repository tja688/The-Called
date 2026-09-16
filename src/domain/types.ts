/** 本原型用到的领域枚举。旧体系（信仰、卡背、三层）不在这里。 */

export type Side = 'player' | 'enemy'
export type CardKind = 'occupy' | 'spell'
export type Zone = 'hand' | 'board' | 'deck' | 'discard' | 'exile'
export type NodeId = 'yuZhuang' | 'drawer' | 'boShou' | 'shouMen'
export type EncounterId = 'yuZhuang' | 'boShou' | 'shouMen'
export type CardStatus = 'sealed'
export type Screen = 'map' | 'battle' | 'event' | 'reward' | 'over'
export type BattlePhase = 'play' | 'pressure' | 'over'
export type BattleOutcome = 'win' | 'lose'
export type SettleReason = 'lead' | 'avatarGone' | 'noPlay'
export type RemoveReason = 'cover' | 'effect' | 'banish'
export type RemoveTo = 'discard' | 'exile'
export type RunResult = 'victory' | 'defeat'

export const NODES: NodeId[] = ['yuZhuang', 'drawer', 'boShou', 'shouMen']

export const NODE_ENCOUNTER: Partial<Record<NodeId, EncounterId>> = {
  yuZhuang: 'yuZhuang',
  boShou: 'boShou',
  shouMen: 'shouMen',
}

export const NODE_LABEL: Record<NodeId, string> = {
  yuZhuang: '余桩',
  drawer: '裂开的抽屉',
  boShou: '剥手',
  shouMen: '守门',
}
