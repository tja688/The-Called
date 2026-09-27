import { useState } from 'react'
import type { Encounter } from '../../encounter'
import {
  createSession,
  DEFAULT_MAP_SEED,
  generateMap,
  isMonsterId,
  monsterName,
  type MapSession,
} from '../../map'
import {
  beginBattle,
  createCampaign,
  type CampaignState,
} from '../../meta'
import { DeckScreen, RewardScreen } from '../campaign'
import { ARRIVAL_COPY, MapView } from '../map'
import { BattleScreen } from './BattleScreen'
import { startWiredEncounter } from './entry'
import { settleBattleExit, type BattleRewardOffer } from './outcome'
import './battle.css'

const UNWIRED = '这一位的战斗还没接上'

interface Fight {
  encounter: Encounter
  monsterId: string
  nodeId: string
}

type Phase = 'map' | 'deck' | 'battle' | 'reward'

export function RunView({ onExit }: { onExit: () => void }) {
  const [campaign, setCampaign] = useState<CampaignState>(() => createCampaign())
  const [session, setSession] = useState<MapSession>(() => createSession(generateMap(DEFAULT_MAP_SEED)))
  const [phase, setPhase] = useState<Phase>('map')
  const [notice, setNotice] = useState<string | null>(null)
  const [fight, setFight] = useState<Fight | null>(null)
  const [reward, setReward] = useState<BattleRewardOffer | null>(null)

  const enterBattle = (monsterId: string, nodeId: string) => {
    const encounter = startWiredEncounter(monsterId)
    if (!encounter) {
      setNotice(UNWIRED)
      return
    }
    setNotice(null)
    setCampaign((current) => beginBattle(current))
    setFight({
      encounter,
      monsterId,
      nodeId,
    })
    setPhase('battle')
  }

  const leaveBattle = (winner: 'player' | 'enemy') => {
    if (!fight || phase !== 'battle') return
    const exit = settleBattleExit({
      campaign,
      session,
      monsterId: fight.monsterId,
      nodeId: fight.nodeId,
      winner,
    })
    setCampaign(exit.campaign)
    setSession(exit.session)
    setReward(exit.reward)
    setPhase(exit.phase)
    setFight(null)
  }

  const title = fight && isMonsterId(fight.monsterId) ? monsterName(fight.monsterId) : '战斗'

  return (
    <div className={phase === 'map' ? 'v6-run v6-run--map' : phase === 'deck' || phase === 'reward' ? 'v6-run v6-run--board' : 'v6-run'}>
      {phase === 'map' ? (
        <>
          <div className="v6-run__bar">
            <button type="button" onClick={onExit}>返回主菜单</button>
            <p className="v6-run__gold">金币 {campaign.gold}</p>
            <button type="button" onClick={() => { setNotice(null); setPhase('deck') }}>构筑</button>
          </div>
          <MapView
            session={session}
            onSessionChange={(next) => {
              setSession(next)
              setNotice(null)
            }}
            onEnterBattle={enterBattle}
          />
          {notice ? <p className="v6-run__notice" role="status">{notice}</p> : null}
        </>
      ) : null}

      {phase === 'deck' ? (
        <DeckScreen
          campaign={campaign}
          onCampaign={setCampaign}
          onBack={() => setPhase('map')}
        />
      ) : null}

      {phase === 'battle' && fight ? (
        <BattleScreen
          encounter={fight.encounter}
          monsterId={fight.monsterId}
          title={title}
          announceArrival={fight.monsterId === 'the-caller'}
          onEncounter={(encounter) => setFight({ ...fight, encounter })}
          onLeave={leaveBattle}
        />
      ) : null}

      {phase === 'reward' && reward ? (
        <RewardScreen
          result={reward.result}
          monsterId={reward.monsterId}
          goldBefore={reward.goldBefore}
          campaign={campaign}
          onCampaign={setCampaign}
          arrival={reward.monsterId === 'the-caller' ? ARRIVAL_COPY : null}
          onDone={() => setPhase('map')}
        />
      ) : null}
    </div>
  )
}
