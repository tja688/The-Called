import { describe, expect, it } from 'vitest'
import { COPY_LIMIT_MESSAGE, HUGE_CARD_BACK_NOTICE, beginBattle, createCampaign } from '../../meta'
import {
  createSession,
  generateMap,
  monsterName,
  moveTo,
  neighborsOf,
} from '../../map'
import { ARRIVAL_COPY, toMapView } from '../map/viewModel'
import { rewardView } from '../campaign'
import { settleBattleExit } from './outcome'

function copies(cards: readonly string[], name: string): number {
  return cards.filter((card) => card === name).length
}

function atRunaway() {
  const session = createSession(generateMap())
  const node = session.graph.nodes.find((item) => item.monsterId === 'runaway-machine')
  if (!node) throw new Error('地图上没有失控机械')
  return { session: moveTo(session, node.id), nodeId: node.id }
}

function atPatrol() {
  const session = createSession(generateMap())
  const runaway = session.graph.nodes.find((item) => item.monsterId === 'runaway-machine')
  const patrol = session.graph.nodes.find((item) => item.monsterId === 'patrol-swarm')
  if (!runaway || !patrol) throw new Error('地图上没有巡检蜂群')
  return { session: moveTo(moveTo(session, runaway.id), patrol.id), nodeId: patrol.id }
}

function atMirror() {
  const session = createSession(generateMap())
  const runaway = session.graph.nodes.find((item) => item.monsterId === 'runaway-machine')
  const mirror = session.graph.nodes.find((item) => item.monsterId === 'mirror-person')
  if (!runaway || !mirror) throw new Error('地图上没有镜中人')
  return { session: moveTo(moveTo(session, runaway.id), mirror.id), nodeId: mirror.id }
}

function atPreaching() {
  const session = createSession(generateMap())
  const runaway = session.graph.nodes.find((item) => item.monsterId === 'runaway-machine')
  const preaching = session.graph.nodes.find((item) => item.monsterId === 'preaching-band')
  if (!runaway || !preaching) throw new Error('地图上没有布道团')
  return { session: moveTo(moveTo(session, runaway.id), preaching.id), nodeId: preaching.id }
}

function atRust() {
  const session = createSession(generateMap())
  const runaway = session.graph.nodes.find((item) => item.monsterId === 'runaway-machine')
  if (!runaway) throw new Error('地图上没有锈蚀巨像')
  for (const parentId of ['patrol-swarm', 'preaching-band'] as const) {
    for (const parent of session.graph.nodes.filter((item) => item.monsterId === parentId)) {
      const rust = neighborsOf(session.graph, parent.id)
        .map((id) => session.graph.nodes.find((node) => node.id === id))
        .find((node) => node?.monsterId === 'rust-colossus')
      if (!rust) continue
      return {
        session: moveTo(moveTo(moveTo(session, runaway.id), parent.id), rust.id),
        nodeId: rust.id,
      }
    }
  }
  throw new Error('地图上没有锈蚀巨像')
}

function atCarrion() {
  const session = createSession(generateMap())
  const runaway = session.graph.nodes.find((item) => item.monsterId === 'runaway-machine')
  if (!runaway) throw new Error('地图上没有食腐鸦群')
  for (const mirror of session.graph.nodes.filter((item) => item.monsterId === 'mirror-person')) {
    const carrion = neighborsOf(session.graph, mirror.id)
      .map((id) => session.graph.nodes.find((node) => node.id === id))
      .find((node) => node?.monsterId === 'carrion-crows')
    if (!carrion) continue
    return {
      session: moveTo(moveTo(moveTo(session, runaway.id), mirror.id), carrion.id),
      nodeId: carrion.id,
    }
  }
  throw new Error('地图上没有食腐鸦群')
}

function atAnatomist() {
  const session = createSession(generateMap())
  const runaway = session.graph.nodes.find((item) => item.monsterId === 'runaway-machine')
  if (!runaway) throw new Error('地图上没有解剖学家')
  for (const parentId of ['patrol-swarm', 'preaching-band'] as const) {
    for (const parent of session.graph.nodes.filter((item) => item.monsterId === parentId)) {
      for (const rustId of neighborsOf(session.graph, parent.id)) {
        const rust = session.graph.nodes.find((node) => node.id === rustId)
        if (rust?.monsterId !== 'rust-colossus') continue
        const anatomist = neighborsOf(session.graph, rust.id)
          .map((id) => session.graph.nodes.find((node) => node.id === id))
          .find((node) => node?.monsterId === 'anatomist')
        if (!anatomist) continue
        return {
          session: moveTo(moveTo(moveTo(moveTo(session, runaway.id), parent.id), rust.id), anatomist.id),
          nodeId: anatomist.id,
        }
      }
    }
  }
  throw new Error('地图上没有解剖学家')
}

function atSilent() {
  const session = createSession(generateMap())
  const runaway = session.graph.nodes.find((item) => item.monsterId === 'runaway-machine')
  if (!runaway) throw new Error('地图上没有缄默修会')
  for (const parentId of ['patrol-swarm', 'preaching-band'] as const) {
    for (const parent of session.graph.nodes.filter((item) => item.monsterId === parentId)) {
      for (const rustId of neighborsOf(session.graph, parent.id)) {
        const rust = session.graph.nodes.find((node) => node.id === rustId)
        if (rust?.monsterId !== 'rust-colossus') continue
        const silent = neighborsOf(session.graph, rust.id)
          .map((id) => session.graph.nodes.find((node) => node.id === id))
          .find((node) => node?.monsterId === 'silent-order')
        if (!silent) continue
        return {
          session: moveTo(moveTo(moveTo(moveTo(session, runaway.id), parent.id), rust.id), silent.id),
          nodeId: silent.id,
        }
      }
    }
  }
  throw new Error('地图上没有缄默修会')
}

function atWitch() {
  const session = createSession(generateMap())
  const runaway = session.graph.nodes.find((item) => item.monsterId === 'runaway-machine')
  if (!runaway) throw new Error('地图上没有镜渊魔女')
  for (const mirror of session.graph.nodes.filter((item) => item.monsterId === 'mirror-person')) {
    for (const carrionId of neighborsOf(session.graph, mirror.id)) {
      const carrion = session.graph.nodes.find((node) => node.id === carrionId)
      if (carrion?.monsterId !== 'carrion-crows') continue
      const witch = neighborsOf(session.graph, carrion.id)
        .map((id) => session.graph.nodes.find((node) => node.id === id))
        .find((node) => node?.monsterId === 'mirror-witch')
      if (!witch) continue
      return {
        session: moveTo(moveTo(moveTo(moveTo(session, runaway.id), mirror.id), carrion.id), witch.id),
        nodeId: witch.id,
      }
    }
  }
  throw new Error('地图上没有镜渊魔女')
}

function atBell() {
  const here = atAnatomist()
  const bell = neighborsOf(here.session.graph, here.nodeId)
    .map((id) => here.session.graph.nodes.find((node) => node.id === id))
    .find((node) => node?.monsterId === 'bell-warden')
  if (!bell) throw new Error('地图上没有钟楼守望者')
  return { session: moveTo(here.session, bell.id), nodeId: bell.id }
}

function atCaller() {
  const here = atBell()
  const caller = neighborsOf(here.session.graph, here.nodeId)
    .map((id) => here.session.graph.nodes.find((node) => node.id === id))
    .find((node) => node?.monsterId === 'the-caller')
  if (!caller) throw new Error('地图上没有呼唤者')
  return { session: moveTo(here.session, caller.id), nodeId: caller.id }
}

describe('战斗结束接到奖励', () => {
  it('胜利发放 50 金、显微镜和攻击炮台，说明弱点采样机拒收，并仍站在失控机械节点', () => {
    const started = createCampaign()
    const here = atRunaway()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'runaway-machine',
      nodeId: here.nodeId,
      winner: 'player',
    })

    expect(exit.phase).toBe('reward')
    expect(exit.reward).not.toBeNull()
    if (!exit.reward) return
    expect(exit.campaign.gold).toBe(50)
    expect(copies(exit.campaign.box, '显微镜')).toBe(copies(started.box, '显微镜') + 1)
    expect(copies(exit.campaign.box, '攻击炮台')).toBe(copies(started.box, '攻击炮台') + 1)
    expect(copies(exit.campaign.box, '弱点采样机')).toBe(3)
    expect(exit.campaign.box).toContain('显微镜')
    expect(exit.campaign.box).toContain('攻击炮台')

    const view = rewardView(exit.reward.result, exit.reward.monsterId, exit.reward.goldBefore)
    expect(view.goldGained).toBe(50)
    expect(view.goldText).toBe('获得 50 金币')
    expect(view.includable).toEqual(['显微镜', '攻击炮台'])
    expect(view.rejected).toEqual([
      {
        name: '弱点采样机',
        reason: COPY_LIMIT_MESSAGE,
        text: `弱点采样机：${COPY_LIMIT_MESSAGE}`,
      },
    ])

    expect(monsterName('runaway-machine')).toBe('失控机械')
    expect(exit.session.defeatedMonsterIds).toEqual(['runaway-machine'])
    expect(exit.session.currentNodeId).toBe(here.nodeId)
    expect(exit.nodeId).toBe(here.nodeId)
    expect(exit.phase).toBe('reward')
  })

  it('巡检蜂群胜利入盒巡检探头、测绘员、收容钳、定点清除，不发教学战的牌', () => {
    const started = createCampaign()
    const here = atPatrol()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'patrol-swarm',
      nodeId: here.nodeId,
      winner: 'player',
    })

    expect(exit.phase).toBe('reward')
    expect(exit.reward).not.toBeNull()
    if (!exit.reward) return
    expect(exit.campaign.gold).toBe(50)
    expect(exit.reward.result.addedCardNames).toEqual(['巡检探头', '测绘员', '收容钳', '定点清除'])
    for (const name of ['巡检探头', '测绘员', '收容钳', '定点清除']) {
      expect(copies(exit.campaign.box, name)).toBe(copies(started.box, name) + 1)
    }
    expect(copies(exit.campaign.box, '显微镜')).toBe(copies(started.box, '显微镜'))
    expect(copies(exit.campaign.box, '攻击炮台')).toBe(copies(started.box, '攻击炮台'))
    expect(copies(exit.campaign.box, '弱点采样机')).toBe(copies(started.box, '弱点采样机'))

    const view = rewardView(exit.reward.result, exit.reward.monsterId, exit.reward.goldBefore)
    expect(view.goldGained).toBe(50)
    expect(view.includable).toEqual(['巡检探头', '测绘员', '收容钳', '定点清除'])
    expect(exit.session.defeatedMonsterIds).toEqual(['patrol-swarm'])
    expect(exit.session.currentNodeId).toBe(here.nodeId)
    expect(exit.nodeId).toBe(here.nodeId)
  })

  it('镜中人胜利入盒镜匠、银镜、双生子、镜面翻转，不发教学战或蜂群的牌', () => {
    const started = createCampaign()
    const here = atMirror()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'mirror-person',
      nodeId: here.nodeId,
      winner: 'player',
    })

    expect(exit.phase).toBe('reward')
    expect(exit.reward).not.toBeNull()
    if (!exit.reward) return
    expect(exit.campaign.gold).toBe(50)
    expect(exit.reward.result.addedCardNames).toEqual(['镜匠', '银镜', '双生子', '镜面翻转'])
    for (const name of ['镜匠', '银镜', '双生子', '镜面翻转']) {
      expect(copies(exit.campaign.box, name)).toBe(copies(started.box, name) + 1)
    }
    for (const name of ['显微镜', '攻击炮台', '弱点采样机', '巡检探头', '测绘员', '收容钳', '定点清除']) {
      expect(copies(exit.campaign.box, name)).toBe(copies(started.box, name))
    }

    const view = rewardView(exit.reward.result, exit.reward.monsterId, exit.reward.goldBefore)
    expect(view.goldGained).toBe(50)
    expect(view.goldText).toBe('获得 50 金币')
    expect(view.includable).toEqual(['镜匠', '银镜', '双生子', '镜面翻转'])
    expect(view.rejected).toEqual([])
    expect(monsterName('mirror-person')).toBe('镜中人')
    expect(exit.session.defeatedMonsterIds).toEqual(['mirror-person'])
    expect(exit.session.currentNodeId).toBe(here.nodeId)
    expect(exit.nodeId).toBe(here.nodeId)
  })

  it('布道团胜利入盒辅祭、神圣骑士、审判官、祷告灯，不发教学战、蜂群或镜中人的牌', () => {
    const started = createCampaign()
    const here = atPreaching()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'preaching-band',
      nodeId: here.nodeId,
      winner: 'player',
    })

    expect(exit.phase).toBe('reward')
    expect(exit.reward).not.toBeNull()
    if (!exit.reward) return
    expect(exit.campaign.gold).toBe(50)
    expect(exit.reward.result.addedCardNames).toEqual(['辅祭', '神圣骑士', '审判官', '祷告灯'])
    for (const name of ['辅祭', '神圣骑士', '审判官', '祷告灯']) {
      expect(copies(exit.campaign.box, name)).toBe(copies(started.box, name) + 1)
    }
    for (const name of [
      '显微镜',
      '攻击炮台',
      '弱点采样机',
      '巡检探头',
      '测绘员',
      '收容钳',
      '定点清除',
      '镜匠',
      '银镜',
      '双生子',
      '镜面翻转',
    ]) {
      expect(copies(exit.campaign.box, name)).toBe(copies(started.box, name))
    }

    const view = rewardView(exit.reward.result, exit.reward.monsterId, exit.reward.goldBefore)
    expect(view.goldGained).toBe(50)
    expect(view.goldText).toBe('获得 50 金币')
    expect(view.includable).toEqual(['辅祭', '神圣骑士', '审判官', '祷告灯'])
    expect(view.rejected).toEqual([])
    expect(monsterName('preaching-band')).toBe('布道团')
    expect(exit.session.defeatedMonsterIds).toEqual(['preaching-band'])
    expect(exit.session.currentNodeId).toBe(here.nodeId)
    expect(exit.nodeId).toBe(here.nodeId)
  })

  it('食腐鸦群胜利入盒提灯人、托孤者、守墓人、引魂铃、骨匠，不发教学战、蜂群、镜中人或布道团的牌', () => {
    const started = createCampaign()
    const here = atCarrion()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'carrion-crows',
      nodeId: here.nodeId,
      winner: 'player',
    })

    expect(exit.phase).toBe('reward')
    expect(exit.reward).not.toBeNull()
    if (!exit.reward) return
    expect(exit.campaign.gold).toBe(50)
    expect(exit.reward.result.addedCardNames).toEqual(['提灯人', '托孤者', '守墓人', '引魂铃', '骨匠'])
    for (const name of ['提灯人', '托孤者', '守墓人', '引魂铃', '骨匠']) {
      expect(copies(exit.campaign.box, name)).toBe(copies(started.box, name) + 1)
    }
    for (const name of [
      '显微镜',
      '攻击炮台',
      '弱点采样机',
      '巡检探头',
      '测绘员',
      '收容钳',
      '定点清除',
      '镜匠',
      '银镜',
      '双生子',
      '镜面翻转',
      '辅祭',
      '神圣骑士',
      '审判官',
      '祷告灯',
    ]) {
      expect(copies(exit.campaign.box, name)).toBe(copies(started.box, name))
    }

    const view = rewardView(exit.reward.result, exit.reward.monsterId, exit.reward.goldBefore)
    expect(view.goldGained).toBe(50)
    expect(view.goldText).toBe('获得 50 金币')
    expect(view.includable).toEqual(['提灯人', '托孤者', '守墓人', '引魂铃', '骨匠'])
    expect(view.rejected).toEqual([])
    expect(monsterName('carrion-crows')).toBe('食腐鸦群')
    expect(exit.session.defeatedMonsterIds).toEqual(['carrion-crows'])
    expect(exit.session.currentNodeId).toBe(here.nodeId)
    expect(exit.nodeId).toBe(here.nodeId)
  })

  it('锈蚀巨像胜利入盒钻心器、霸占者、过载电池、调取图纸，并发放 60 金币', () => {
    const started = createCampaign()
    const here = atRust()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'rust-colossus',
      nodeId: here.nodeId,
      winner: 'player',
    })

    expect(exit.phase).toBe('reward')
    expect(exit.reward).not.toBeNull()
    if (!exit.reward) return
    expect(exit.campaign.gold).toBe(60)
    expect(exit.reward.result.addedCardNames).toEqual(['钻心器', '霸占者', '过载电池', '调取图纸'])
    for (const name of ['钻心器', '霸占者', '过载电池', '调取图纸']) {
      expect(copies(exit.campaign.box, name)).toBe(copies(started.box, name) + 1)
    }
    for (const name of [
      '显微镜',
      '攻击炮台',
      '弱点采样机',
      '巡检探头',
      '测绘员',
      '收容钳',
      '定点清除',
      '镜匠',
      '银镜',
      '双生子',
      '镜面翻转',
      '辅祭',
      '神圣骑士',
      '审判官',
      '祷告灯',
      '提灯人',
      '托孤者',
      '守墓人',
      '引魂铃',
      '骨匠',
    ]) {
      expect(copies(exit.campaign.box, name)).toBe(copies(started.box, name))
    }

    const view = rewardView(exit.reward.result, exit.reward.monsterId, exit.reward.goldBefore)
    expect(view.goldGained).toBe(60)
    expect(view.goldText).toBe('获得 60 金币')
    expect(view.includable).toEqual(['钻心器', '霸占者', '过载电池', '调取图纸'])
    expect(view.rejected).toEqual([])
    expect(monsterName('rust-colossus')).toBe('锈蚀巨像')
    expect(exit.session.defeatedMonsterIds).toEqual(['rust-colossus'])
    expect(exit.session.currentNodeId).toBe(here.nodeId)
    expect(exit.nodeId).toBe(here.nodeId)
  })

  it('解剖学家胜利入盒收容钳、攻击炮台、标本柜、激光扫描仪、逆向解析，并发放 100 金币', () => {
    const started = createCampaign()
    const here = atAnatomist()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'anatomist',
      nodeId: here.nodeId,
      winner: 'player',
    })

    expect(exit.phase).toBe('reward')
    expect(exit.reward).not.toBeNull()
    if (!exit.reward) return
    expect(exit.campaign.gold).toBe(100)
    expect(exit.reward.result.addedCardNames).toEqual(['收容钳', '攻击炮台', '标本柜', '激光扫描仪', '逆向解析'])
    for (const name of ['收容钳', '攻击炮台', '标本柜', '激光扫描仪', '逆向解析']) {
      expect(copies(exit.campaign.box, name)).toBe(copies(started.box, name) + 1)
    }
    for (const name of [
      '显微镜',
      '弱点采样机',
      '巡检探头',
      '测绘员',
      '定点清除',
      '镜匠',
      '银镜',
      '双生子',
      '镜面翻转',
      '辅祭',
      '神圣骑士',
      '审判官',
      '祷告灯',
      '提灯人',
      '托孤者',
      '守墓人',
      '引魂铃',
      '骨匠',
      '钻心器',
      '霸占者',
      '过载电池',
      '调取图纸',
    ]) {
      expect(copies(exit.campaign.box, name)).toBe(copies(started.box, name))
    }

    const view = rewardView(exit.reward.result, exit.reward.monsterId, exit.reward.goldBefore)
    expect(view.goldGained).toBe(100)
    expect(view.goldText).toBe('获得 100 金币')
    expect(view.includable).toEqual(['收容钳', '攻击炮台', '标本柜', '激光扫描仪', '逆向解析'])
    expect(view.rejected).toEqual([])
    expect(monsterName('anatomist')).toBe('解剖学家')
    expect(exit.session.defeatedMonsterIds).toEqual(['anatomist'])
    expect(exit.session.currentNodeId).toBe(here.nodeId)
    expect(exit.nodeId).toBe(here.nodeId)
  })

  it('缄默修会胜利入盒告解神父、驱魔人、大审判长、庇佑祷词，并发放 100 金币', () => {
    const started = createCampaign()
    const here = atSilent()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'silent-order',
      nodeId: here.nodeId,
      winner: 'player',
    })

    expect(exit.phase).toBe('reward')
    expect(exit.reward).not.toBeNull()
    if (!exit.reward) return
    expect(exit.campaign.gold).toBe(100)
    expect(exit.reward.result.addedCardNames).toEqual(['告解神父', '驱魔人', '大审判长', '庇佑祷词'])
    for (const name of ['告解神父', '驱魔人', '大审判长', '庇佑祷词']) {
      expect(copies(exit.campaign.box, name)).toBe(copies(started.box, name) + 1)
    }
    for (const name of [
      '显微镜',
      '攻击炮台',
      '弱点采样机',
      '巡检探头',
      '测绘员',
      '收容钳',
      '定点清除',
      '镜匠',
      '银镜',
      '双生子',
      '镜面翻转',
      '辅祭',
      '神圣骑士',
      '审判官',
      '祷告灯',
      '提灯人',
      '托孤者',
      '守墓人',
      '引魂铃',
      '骨匠',
      '钻心器',
      '霸占者',
      '过载电池',
      '调取图纸',
      '标本柜',
      '激光扫描仪',
      '逆向解析',
    ]) {
      expect(copies(exit.campaign.box, name)).toBe(copies(started.box, name))
    }

    const view = rewardView(exit.reward.result, exit.reward.monsterId, exit.reward.goldBefore)
    expect(view.goldGained).toBe(100)
    expect(view.goldText).toBe('获得 100 金币')
    expect(view.includable).toEqual(['告解神父', '驱魔人', '大审判长', '庇佑祷词'])
    expect(view.rejected).toEqual([])
    expect(monsterName('silent-order')).toBe('缄默修会')
    expect(exit.session.defeatedMonsterIds).toEqual(['silent-order'])
    expect(exit.session.currentNodeId).toBe(here.nodeId)
    expect(exit.nodeId).toBe(here.nodeId)
  })

  it('镜渊魔女胜利入盒黑镜、夺舍者、星盘、亡者低语、冥河摆渡人，并发放 100 金币', () => {
    const started = createCampaign()
    const here = atWitch()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'mirror-witch',
      nodeId: here.nodeId,
      winner: 'player',
    })

    expect(exit.phase).toBe('reward')
    expect(exit.reward).not.toBeNull()
    if (!exit.reward) return
    expect(exit.campaign.gold).toBe(100)
    expect(exit.reward.result.addedCardNames).toEqual(['黑镜', '夺舍者', '星盘', '亡者低语', '冥河摆渡人'])
    for (const name of ['黑镜', '夺舍者', '星盘', '亡者低语', '冥河摆渡人']) {
      expect(copies(exit.campaign.box, name)).toBe(copies(started.box, name) + 1)
    }
    for (const name of [
      '显微镜',
      '攻击炮台',
      '弱点采样机',
      '巡检探头',
      '测绘员',
      '收容钳',
      '定点清除',
      '镜匠',
      '银镜',
      '双生子',
      '镜面翻转',
      '辅祭',
      '神圣骑士',
      '审判官',
      '祷告灯',
      '提灯人',
      '托孤者',
      '守墓人',
      '引魂铃',
      '骨匠',
      '钻心器',
      '霸占者',
      '过载电池',
      '调取图纸',
      '标本柜',
      '激光扫描仪',
      '逆向解析',
      '告解神父',
      '驱魔人',
      '大审判长',
      '庇佑祷词',
    ]) {
      expect(copies(exit.campaign.box, name)).toBe(copies(started.box, name))
    }

    const view = rewardView(exit.reward.result, exit.reward.monsterId, exit.reward.goldBefore)
    expect(view.goldGained).toBe(100)
    expect(view.goldText).toBe('获得 100 金币')
    expect(view.includable).toEqual(['黑镜', '夺舍者', '星盘', '亡者低语', '冥河摆渡人'])
    expect(view.rejected).toEqual([])
    expect(monsterName('mirror-witch')).toBe('镜渊魔女')
    expect(exit.session.defeatedMonsterIds).toEqual(['mirror-witch'])
    expect(exit.session.currentNodeId).toBe(here.nodeId)
    expect(exit.nodeId).toBe(here.nodeId)
  })

  it('钟楼守望者胜利入盒圣殿守卫、计时器、穿甲钻头、圣杯，发放 150 金币，并提示巨大卡背', () => {
    const started = createCampaign()
    const here = atBell()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'bell-warden',
      nodeId: here.nodeId,
      winner: 'player',
    })

    expect(exit.phase).toBe('reward')
    expect(exit.reward).not.toBeNull()
    if (!exit.reward) return
    expect(exit.campaign.gold).toBe(150)
    expect(exit.reward.result.addedCardNames).toEqual(['圣殿守卫', '计时器', '穿甲钻头', '圣杯'])
    for (const name of ['圣殿守卫', '计时器', '穿甲钻头', '圣杯']) {
      expect(copies(exit.campaign.box, name)).toBe(copies(started.box, name) + 1)
    }
    for (const name of [
      '显微镜',
      '攻击炮台',
      '弱点采样机',
      '巡检探头',
      '测绘员',
      '收容钳',
      '定点清除',
      '镜匠',
      '银镜',
      '双生子',
      '镜面翻转',
      '辅祭',
      '神圣骑士',
      '审判官',
      '祷告灯',
      '提灯人',
      '托孤者',
      '守墓人',
      '引魂铃',
      '骨匠',
      '钻心器',
      '霸占者',
      '过载电池',
      '调取图纸',
      '标本柜',
      '激光扫描仪',
      '逆向解析',
      '告解神父',
      '驱魔人',
      '大审判长',
      '庇佑祷词',
      '黑镜',
      '夺舍者',
      '星盘',
      '亡者低语',
      '冥河摆渡人',
    ]) {
      expect(copies(exit.campaign.box, name)).toBe(copies(started.box, name))
    }

    const view = rewardView(exit.reward.result, exit.reward.monsterId, exit.reward.goldBefore)
    expect(view.goldGained).toBe(150)
    expect(view.goldText).toBe('获得 150 金币')
    expect(view.includable).toEqual(['圣殿守卫', '计时器', '穿甲钻头', '圣杯'])
    expect(view.rejected).toEqual([])
    expect(view.hugeCardBackNotice).toBe(HUGE_CARD_BACK_NOTICE)
    expect(view.hugeCardBackNotice).toBe('获得巨大卡背。装配尚未开放')
    expect(monsterName('bell-warden')).toBe('钟楼守望者')
    expect(exit.session.defeatedMonsterIds).toEqual(['bell-warden'])
    expect(exit.session.currentNodeId).toBe(here.nodeId)
    expect(exit.nodeId).toBe(here.nodeId)
  })

  it('呼唤者胜利入盒测绘员、数据核心、彼岸花、圣女，发放 200 金币，提示巨大卡背，回到地图仍显示已抵达终点', () => {
    const started = createCampaign()
    const here = atCaller()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'the-caller',
      nodeId: here.nodeId,
      winner: 'player',
    })

    expect(exit.phase).toBe('reward')
    expect(exit.reward).not.toBeNull()
    if (!exit.reward) return
    expect(exit.campaign.gold).toBe(200)
    expect(exit.reward.result.addedCardNames).toEqual(['测绘员', '数据核心', '彼岸花', '圣女'])
    for (const name of ['测绘员', '数据核心', '彼岸花', '圣女']) {
      expect(copies(exit.campaign.box, name)).toBe(copies(started.box, name) + 1)
    }
    for (const name of [
      '显微镜',
      '攻击炮台',
      '弱点采样机',
      '巡检探头',
      '收容钳',
      '定点清除',
      '镜匠',
      '银镜',
      '双生子',
      '镜面翻转',
      '辅祭',
      '神圣骑士',
      '审判官',
      '祷告灯',
      '提灯人',
      '托孤者',
      '守墓人',
      '引魂铃',
      '骨匠',
      '钻心器',
      '霸占者',
      '过载电池',
      '调取图纸',
      '标本柜',
      '激光扫描仪',
      '逆向解析',
      '告解神父',
      '驱魔人',
      '大审判长',
      '庇佑祷词',
      '黑镜',
      '夺舍者',
      '星盘',
      '亡者低语',
      '冥河摆渡人',
      '圣殿守卫',
      '计时器',
      '穿甲钻头',
      '圣杯',
    ]) {
      expect(copies(exit.campaign.box, name)).toBe(copies(started.box, name))
    }

    const view = rewardView(exit.reward.result, exit.reward.monsterId, exit.reward.goldBefore)
    expect(view.goldGained).toBe(200)
    expect(view.goldText).toBe('获得 200 金币')
    expect(view.includable).toEqual(['测绘员', '数据核心', '彼岸花', '圣女'])
    expect(view.rejected).toEqual([])
    expect(view.hugeCardBackNotice).toBe(HUGE_CARD_BACK_NOTICE)
    expect(view.hugeCardBackNotice).toBe('获得巨大卡背。装配尚未开放')
    expect(monsterName('the-caller')).toBe('呼唤者')
    expect(exit.session.defeatedMonsterIds).toEqual(['the-caller'])
    expect(exit.session.currentNodeId).toBe(here.nodeId)
    expect(exit.nodeId).toBe(here.nodeId)
    expect(toMapView(exit.session).arrival).toBe(ARRIVAL_COPY)
    expect(toMapView(exit.session).arrival).toBe('已抵达终点')
  })

  it('呼唤者失败不发奖，回到地图也不显示已抵达终点', () => {
    const started = createCampaign()
    const here = atCaller()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'the-caller',
      nodeId: here.nodeId,
      winner: 'enemy',
    })

    expect(exit.phase).toBe('map')
    expect(exit.reward).toBeNull()
    expect(exit.campaign.gold).toBe(started.gold)
    expect(exit.campaign.box).toEqual(started.box)
    expect(exit.campaign.notices).toEqual([])
    expect(exit.session.defeatedMonsterIds).toEqual([])
    expect(exit.session.currentNodeId).toBe(here.nodeId)
    expect(exit.nodeId).toBe(here.nodeId)
    expect(toMapView(exit.session).arrival).toBeNull()
  })

  it('钟楼守望者失败不发奖', () => {
    const started = createCampaign()
    const here = atBell()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'bell-warden',
      nodeId: here.nodeId,
      winner: 'enemy',
    })

    expect(exit.phase).toBe('map')
    expect(exit.reward).toBeNull()
    expect(exit.campaign.gold).toBe(started.gold)
    expect(exit.campaign.box).toEqual(started.box)
    expect(exit.campaign.notices).toEqual([])
    expect(exit.session.defeatedMonsterIds).toEqual([])
    expect(exit.session.currentNodeId).toBe(here.nodeId)
    expect(exit.nodeId).toBe(here.nodeId)
  })

  it('镜渊魔女失败不发奖', () => {
    const started = createCampaign()
    const here = atWitch()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'mirror-witch',
      nodeId: here.nodeId,
      winner: 'enemy',
    })

    expect(exit.phase).toBe('map')
    expect(exit.reward).toBeNull()
    expect(exit.campaign.gold).toBe(started.gold)
    expect(exit.campaign.box).toEqual(started.box)
    expect(exit.session.defeatedMonsterIds).toEqual([])
    expect(exit.session.currentNodeId).toBe(here.nodeId)
    expect(exit.nodeId).toBe(here.nodeId)
  })

  it('缄默修会失败不发奖', () => {
    const started = createCampaign()
    const here = atSilent()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'silent-order',
      nodeId: here.nodeId,
      winner: 'enemy',
    })

    expect(exit.phase).toBe('map')
    expect(exit.reward).toBeNull()
    expect(exit.campaign.gold).toBe(started.gold)
    expect(exit.campaign.box).toEqual(started.box)
    expect(exit.session.defeatedMonsterIds).toEqual([])
    expect(exit.session.currentNodeId).toBe(here.nodeId)
    expect(exit.nodeId).toBe(here.nodeId)
  })

  it('锈蚀巨像失败不发奖', () => {
    const started = createCampaign()
    const here = atRust()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'rust-colossus',
      nodeId: here.nodeId,
      winner: 'enemy',
    })

    expect(exit.phase).toBe('map')
    expect(exit.reward).toBeNull()
    expect(exit.campaign.gold).toBe(started.gold)
    expect(exit.campaign.box).toEqual(started.box)
    expect(exit.session.defeatedMonsterIds).toEqual([])
    expect(exit.session.currentNodeId).toBe(here.nodeId)
    expect(exit.nodeId).toBe(here.nodeId)
  })

  it('解剖学家失败不发奖', () => {
    const started = createCampaign()
    const here = atAnatomist()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'anatomist',
      nodeId: here.nodeId,
      winner: 'enemy',
    })

    expect(exit.phase).toBe('map')
    expect(exit.reward).toBeNull()
    expect(exit.campaign.gold).toBe(started.gold)
    expect(exit.campaign.box).toEqual(started.box)
    expect(exit.session.defeatedMonsterIds).toEqual([])
    expect(exit.session.currentNodeId).toBe(here.nodeId)
    expect(exit.nodeId).toBe(here.nodeId)
  })

  it('食腐鸦群失败不发奖', () => {
    const started = createCampaign()
    const here = atCarrion()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'carrion-crows',
      nodeId: here.nodeId,
      winner: 'enemy',
    })

    expect(exit.phase).toBe('map')
    expect(exit.reward).toBeNull()
    expect(exit.campaign.gold).toBe(started.gold)
    expect(exit.campaign.box).toEqual(started.box)
    expect(exit.session.defeatedMonsterIds).toEqual([])
    expect(exit.session.currentNodeId).toBe(here.nodeId)
    expect(exit.nodeId).toBe(here.nodeId)
  })

  it('布道团失败不发奖', () => {
    const started = createCampaign()
    const here = atPreaching()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'preaching-band',
      nodeId: here.nodeId,
      winner: 'enemy',
    })

    expect(exit.phase).toBe('map')
    expect(exit.reward).toBeNull()
    expect(exit.campaign.gold).toBe(started.gold)
    expect(exit.campaign.box).toEqual(started.box)
    expect(exit.session.defeatedMonsterIds).toEqual([])
    expect(exit.session.currentNodeId).toBe(here.nodeId)
    expect(exit.nodeId).toBe(here.nodeId)
  })

  it('镜中人失败不发奖', () => {
    const started = createCampaign()
    const here = atMirror()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'mirror-person',
      nodeId: here.nodeId,
      winner: 'enemy',
    })

    expect(exit.phase).toBe('map')
    expect(exit.reward).toBeNull()
    expect(exit.campaign.gold).toBe(started.gold)
    expect(exit.campaign.box).toEqual(started.box)
    expect(exit.session.defeatedMonsterIds).toEqual([])
    expect(exit.session.currentNodeId).toBe(here.nodeId)
    expect(exit.nodeId).toBe(here.nodeId)
  })

  it('巡检蜂群失败不发奖', () => {
    const started = createCampaign()
    const here = atPatrol()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'patrol-swarm',
      nodeId: here.nodeId,
      winner: 'enemy',
    })

    expect(exit.phase).toBe('map')
    expect(exit.reward).toBeNull()
    expect(exit.campaign.gold).toBe(started.gold)
    expect(exit.campaign.box).toEqual(started.box)
    expect(exit.session.defeatedMonsterIds).toEqual([])
  })

  it('失败不改金币和卡盒，不登记击破，仍回到原节点', () => {
    const started = createCampaign()
    const here = atRunaway()
    const exit = settleBattleExit({
      campaign: beginBattle(started),
      session: here.session,
      monsterId: 'runaway-machine',
      nodeId: here.nodeId,
      winner: 'enemy',
    })

    expect(exit.phase).toBe('map')
    expect(exit.reward).toBeNull()
    expect(exit.campaign.gold).toBe(0)
    expect(exit.campaign.gold).toBe(started.gold)
    expect(exit.campaign.box).toEqual(started.box)
    expect(exit.session.defeatedMonsterIds).toEqual([])
    expect(exit.session.currentNodeId).toBe(here.nodeId)
    expect(exit.nodeId).toBe(here.nodeId)
  })
})
