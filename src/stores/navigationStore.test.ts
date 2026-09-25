import { beforeEach, describe, expect, it } from 'vitest'
import { useCampaignStore } from './campaignStore'
import { useDeckStore } from './deckStore'
import { useGameStore } from './gameStore'
import { useInteractionStore } from './interactionStore'
import { useNavigationStore } from './navigationStore'

describe('navigation state machine', () => {
  beforeEach(() => {
    useCampaignStore.setState({ cleared: 0 })
    useDeckStore.getState().reset()
    useNavigationStore.setState({
      screen: 'home',
      levelId: null,
      sessionStatus: 'idle',
    })
  })

  it('starts a level from the map', () => {
    const navigation = useNavigationStore.getState()
    navigation.openMap()
    navigation.startLevel('level-01')

    expect(useNavigationStore.getState()).toMatchObject({
      screen: 'level',
      levelId: 'level-01',
      sessionStatus: 'playing',
    })
  })

  it('suspends and resumes the active level', () => {
    useNavigationStore.getState().startLevel('level-01')
    useNavigationStore.getState().pauseLevel()

    expect(useNavigationStore.getState()).toMatchObject({
      screen: 'pause',
      levelId: 'level-01',
      sessionStatus: 'suspended',
    })

    useNavigationStore.getState().resumeLevel()
    expect(useNavigationStore.getState()).toMatchObject({
      screen: 'level',
      levelId: 'level-01',
      sessionStatus: 'playing',
    })
  })

  it('clears the session when leaving for the map or home', () => {
    useNavigationStore.getState().startLevel('level-01')
    useNavigationStore.getState().exitToMap()
    expect(useNavigationStore.getState()).toMatchObject({
      screen: 'map',
      levelId: null,
      sessionStatus: 'idle',
    })

    useNavigationStore.getState().startLevel('level-01')
    useNavigationStore.getState().exitToHome()
    expect(useNavigationStore.getState()).toMatchObject({
      screen: 'home',
      levelId: null,
      sessionStatus: 'idle',
    })
  })

  it('refuses to start a level while the battle deck is short', () => {
    useDeckStore.getState().removeSlot(0)
    useNavigationStore.getState().openMap()
    useNavigationStore.getState().startLevel('level-01')
    expect(useNavigationStore.getState()).toMatchObject({
      screen: 'map',
      levelId: null,
      sessionStatus: 'idle',
    })
  })

  it('only starts the encounter that is currently open', () => {
    useNavigationStore.getState().startLevel('level-02')
    expect(useNavigationStore.getState().screen).toBe('home')

    useCampaignStore.getState().complete('level-01')
    useNavigationStore.getState().startLevel('level-01')
    expect(useNavigationStore.getState().screen).toBe('home')
    useNavigationStore.getState().startLevel('level-02')
    expect(useNavigationStore.getState()).toMatchObject({ screen: 'level', levelId: 'level-02' })
  })

  it('drops the previous battle when leaving', () => {
    useGameStore.getState().initialize('level-01', 'svarbhanu')
    useInteractionStore.getState().beginCardPlacement('stuck-card')
    useNavigationStore.getState().startLevel('level-01')
    useNavigationStore.getState().exitToHome()
    expect(useGameStore.getState().match).toBeNull()
    expect(useInteractionStore.getState().cameraMode).toBe('board')
    expect(useInteractionStore.getState().selectedCardInstanceId).toBeUndefined()
  })
})
