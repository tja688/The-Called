import { describe, expect, it } from 'vitest'
import { snapshotEncounter, startPatrolEncounter, startRunawayEncounter } from '../../encounter'
import { startAnatomistEncounter } from '../../encounter/anatomist'
import { startCarrionEncounter } from '../../encounter/carrion'
import { startMirrorEncounter } from '../../encounter/mirror'
import { startPreachingEncounter } from '../../encounter/preaching'
import { startRustEncounter } from '../../encounter/rust'
import { startSilentEncounter } from '../../encounter/silent'
import { startWitchEncounter } from '../../encounter/witch'
import { startBellEncounter } from '../../encounter/bell'
import { startCallerEncounter } from '../../encounter/caller'
import { startWiredEncounter } from './entry'

describe('战斗入口按怪物分支', () => {
  it('巡检蜂群走 startPatrolEncounter，失控机械仍走 startRunawayEncounter，镜中人走 startMirrorEncounter，布道团走 startPreachingEncounter，食腐鸦群走 startCarrionEncounter，锈蚀巨像走 startRustEncounter，解剖学家走 startAnatomistEncounter，缄默修会走 startSilentEncounter，镜渊魔女走 startWitchEncounter，钟楼守望者走 startBellEncounter，呼唤者走 startCallerEncounter', () => {
    const patrol = startWiredEncounter('patrol-swarm')
    const runaway = startWiredEncounter('runaway-machine')
    const mirror = startWiredEncounter('mirror-person')
    const preaching = startWiredEncounter('preaching-band')
    const carrion = startWiredEncounter('carrion-crows')
    const rust = startWiredEncounter('rust-colossus')
    const anatomist = startWiredEncounter('anatomist')
    const silent = startWiredEncounter('silent-order')
    const witch = startWiredEncounter('mirror-witch')
    const bell = startWiredEncounter('bell-warden')
    const caller = startWiredEncounter('the-caller')
    expect(patrol).toEqual(startPatrolEncounter(1))
    expect(runaway).toEqual(startRunawayEncounter(1))
    expect(mirror).toEqual(startMirrorEncounter(1))
    expect(preaching).toEqual(startPreachingEncounter(1))
    expect(carrion).toEqual(startCarrionEncounter(1))
    expect(rust).toEqual(startRustEncounter(1))
    expect(anatomist).toEqual(startAnatomistEncounter(1))
    expect(silent).toEqual(startSilentEncounter(1))
    expect(witch).toEqual(startWitchEncounter(1))
    expect(bell).toEqual(startBellEncounter(1))
    expect(caller).toEqual(startCallerEncounter(1))
    expect(snapshotEncounter(patrol!).cells.find((cell) => cell.cell === 5)?.name).toBe('蜂巢')
    expect(snapshotEncounter(patrol!).intent?.name).toBe('巡检探头')
    expect(snapshotEncounter(runaway!).cells.find((cell) => cell.cell === 5)?.name).toBe('失控机械')
    expect(snapshotEncounter(runaway!).intent?.name).toBe('弱点采样机')
    expect(snapshotEncounter(mirror!).cells.find((cell) => cell.cell === 5)?.name).toBe('古镜')
    expect(snapshotEncounter(mirror!).intent?.name).toBe('镜匠')
    expect(snapshotEncounter(preaching!).cells.find((cell) => cell.cell === 2)?.name).toBe('讲经台')
    expect(snapshotEncounter(preaching!).intent?.name).toBe('辅祭')
    expect(snapshotEncounter(carrion!).cells.find((cell) => cell.cell === 1)?.name).toBe('鸦巢')
    expect(snapshotEncounter(carrion!).intent?.name).toBe('提灯人')
    expect(snapshotEncounter(rust!).cells.every((cell) => cell.instanceId === null)).toBe(true)
    expect(snapshotEncounter(rust!).intent?.name).toBe('钻心器')
    expect(snapshotEncounter(anatomist!).cells.find((cell) => cell.cell === 5)?.name).toBe('解剖台')
    expect(snapshotEncounter(anatomist!).intent?.name).toBe('收容钳')
    expect(snapshotEncounter(silent!).cells.find((cell) => cell.cell === 5)?.name).toBe('缄默刑柱')
    expect(snapshotEncounter(silent!).intent?.name).toBe('告解神父')
    expect(snapshotEncounter(witch!).cells.find((cell) => cell.cell === 2)?.name).toBe('双生镜')
    expect(snapshotEncounter(witch!).cells.find((cell) => cell.cell === 8)?.name).toBe('双生镜')
    expect(snapshotEncounter(witch!).intent?.name).toBe('黑镜')
    expect(snapshotEncounter(bell!).cells.find((cell) => cell.cell === 2)?.name).toBe('大钟')
    expect(snapshotEncounter(bell!).cells.find((cell) => cell.cell === 8)?.name).toBe('发条卫兵')
    expect(snapshotEncounter(bell!).intent?.name).toBe('圣殿守卫')
    expect(snapshotEncounter(caller!).cells.find((cell) => cell.cell === 5)?.name).toBe('应召之核')
    expect(snapshotEncounter(caller!).intent?.name).toBe('测绘员')
  })

  it('没接上的怪物仍返回 null', () => {
    expect(startWiredEncounter('unknown-monster')).toBeNull()
  })
})
