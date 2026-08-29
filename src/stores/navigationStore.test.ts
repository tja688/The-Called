import { beforeEach, describe, expect, it } from 'vitest'
import { useNavigationStore } from './navigationStore'

describe('navigation state machine', () => {
  beforeEach(() => {
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
})
