/**
 * 效果目录（闭集）。内容表只引用这些 `do`，引擎每种实现一次。
 */

export type EnterDo =
  | { do: 'buffAdjacentAllies'; amount: number }
  | { do: 'drawIfCovered'; count: number }

export type RemovedDo = { do: 'buffAvatar'; amount: number }

export type AuraDo =
  | { do: 'reduceAvatarIncoming'; amount: number }
  | { do: 'avatarFloor'; floor: number }
  | { do: 'buffRowEnemies'; row: 0 | 1 | 2; amount: number }

export type SpellDo =
  | { do: 'damageEnemy'; amount: number }
  | { do: 'buffAvatar'; amount: number }
  | { do: 'sealEnemy' }
  | { do: 'removeEnemiesAtMost'; atMost: number }
  | { do: 'sealEnemiesAdjacentToAvatar' }

export type PressureDo =
  | { do: 'damageAdjacentPlayers'; amount: number }
  | { do: 'banishAvatarIfAdjacentAndAtMost'; atMost: number }
  | { do: 'damageLowestAlly'; amount: number }
  | { do: 'damageAvatarOrBanish'; amount: number; banishAtMost: number }

export type EffectDo = EnterDo | RemovedDo | AuraDo | SpellDo | PressureDo

export function needsSpellTarget(spell: SpellDo): boolean {
  return spell.do === 'damageEnemy' || spell.do === 'sealEnemy'
}
