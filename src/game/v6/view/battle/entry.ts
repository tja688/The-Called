import { startPatrolEncounter, startRunawayEncounter, type Encounter } from '../../encounter'
import { startAnatomistEncounter } from '../../encounter/anatomist'
import { startCarrionEncounter } from '../../encounter/carrion'
import { startMirrorEncounter } from '../../encounter/mirror'
import { startPreachingEncounter } from '../../encounter/preaching'
import { startRustEncounter } from '../../encounter/rust'
import { startSilentEncounter } from '../../encounter/silent'
import { startWitchEncounter } from '../../encounter/witch'
import { startBellEncounter } from '../../encounter/bell'
import { startCallerEncounter } from '../../encounter/caller'

/**
 * 已接上的怪物才开局。
 * 失控机械继续用教学战开局，巡检蜂群用巡检对局，镜中人用镜中人对局，布道团用布道对局，食腐鸦群用食腐对局，锈蚀巨像用锈蚀对局，解剖学家用解剖对局，缄默修会用缄默对局，镜渊魔女用魔女对局，钟楼守望者用钟楼对局，呼唤者用呼唤对局。
 * 其他怪物返回 null，界面仍提示还没接上。
 */
export function startWiredEncounter(monsterId: string): Encounter | null {
  if (monsterId === 'runaway-machine') return startRunawayEncounter(1)
  if (monsterId === 'patrol-swarm') return startPatrolEncounter(1)
  if (monsterId === 'mirror-person') return startMirrorEncounter(1)
  if (monsterId === 'preaching-band') return startPreachingEncounter(1)
  if (monsterId === 'carrion-crows') return startCarrionEncounter(1)
  if (monsterId === 'rust-colossus') return startRustEncounter(1)
  if (monsterId === 'anatomist') return startAnatomistEncounter(1)
  if (monsterId === 'silent-order') return startSilentEncounter(1)
  if (monsterId === 'mirror-witch') return startWitchEncounter(1)
  if (monsterId === 'bell-warden') return startBellEncounter(1)
  if (monsterId === 'the-caller') return startCallerEncounter(1)
  return null
}
