const AUDIO_ROOT = '/Audio'

const AUDIO_PATHS = {
  bgm: `${AUDIO_ROOT}/BGM/BGM.mp3`,
  ambience: `${AUDIO_ROOT}/环境声/环境声.mp3`,
  cameraUp: `${AUDIO_ROOT}/卡牌/Card_摄影机向上.mp3`,
  cameraDown: `${AUDIO_ROOT}/卡牌/Card_摄影机向下.mp3`,
  cardFlip: `${AUDIO_ROOT}/卡牌/Card_手牌区域_反转卡牌.mp3`,
  cardSelect: `${AUDIO_ROOT}/卡牌/Card_手牌区域_选择卡牌.mp3`,
  pauseEnter: `${AUDIO_ROOT}/UI/UI_进入暂停界面.mp3`,
  pauseConfirm: `${AUDIO_ROOT}/UI/UI_暂停界面选项确认.mp3`,
  gameStart: `${AUDIO_ROOT}/UI/UI_游戏开始.mp3`,
  brainClick: `${AUDIO_ROOT}/大脑地图/Brain_Click.mp3`,
} as const

type SoundEffect = 'cameraUp' | 'cameraDown' | 'cardFlip' | 'cardSelect' | 'pauseEnter' | 'pauseConfirm' | 'gameStart' | 'brainClick'

let bgm: HTMLAudioElement | undefined
let ambience: HTMLAudioElement | undefined
const soundEffects: Partial<Record<SoundEffect, HTMLAudioElement>> = {}
let bgmPausedForPauseScreen = false
const pendingLoopPlayback = new WeakSet<HTMLAudioElement>()

const AUDIO_LEVELS_KEY = 'the-called-audio-levels'
const MUSIC_BASE = { bgm: 0.35, ambience: 0.32 }
const EFFECT_BASE = 0.8

export type AudioLevels = { music: number; effects: number }

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.min(1, Math.max(0, value))
}

function readLevels(): AudioLevels {
  try {
    const raw = localStorage.getItem(AUDIO_LEVELS_KEY)
    if (!raw) return { music: 1, effects: 1 }
    const parsed = JSON.parse(raw) as Partial<AudioLevels>
    return { music: clamp01(parsed.music ?? 1), effects: clamp01(parsed.effects ?? 1) }
  } catch {
    return { music: 1, effects: 1 }
  }
}

let levels = readLevels()

function applyLevels() {
  if (bgm) bgm.volume = MUSIC_BASE.bgm * levels.music
  if (ambience) ambience.volume = MUSIC_BASE.ambience * levels.music
  for (const audio of Object.values(soundEffects)) {
    if (audio) audio.volume = EFFECT_BASE * levels.effects
  }
}

function persistLevels() {
  try {
    localStorage.setItem(AUDIO_LEVELS_KEY, JSON.stringify(levels))
  } catch {
    // Private mode and tests can refuse storage. Playback still follows the in-memory levels.
  }
}

export function getAudioLevels(): AudioLevels {
  return { ...levels }
}

export function setMusicLevel(music: number) {
  levels = { ...levels, music: clamp01(music) }
  applyLevels()
  persistLevels()
}

export function setEffectsLevel(effects: number) {
  levels = { ...levels, effects: clamp01(effects) }
  applyLevels()
  persistLevels()
}

function createAudio(path: string, volume: number, loop = false) {
  const audio = new Audio(path)
  audio.preload = 'auto'
  audio.volume = volume
  audio.loop = loop
  return audio
}

function getBgm() {
  bgm ??= createAudio(AUDIO_PATHS.bgm, MUSIC_BASE.bgm * levels.music, true)
  return bgm
}

function getAmbience() {
  ambience ??= createAudio(AUDIO_PATHS.ambience, MUSIC_BASE.ambience * levels.music, true)
  return ambience
}

function getSoundEffect(sound: SoundEffect) {
  soundEffects[sound] ??= createAudio(AUDIO_PATHS[sound], EFFECT_BASE * levels.effects)
  return soundEffects[sound]
}

function play(audio: HTMLAudioElement, label: string) {
  void audio.play().catch((error: unknown) => {
    // Browsers reject autoplay until the player interacts with the page.
    if (error instanceof DOMException && error.name === 'NotAllowedError') return
    console.warn(`[audio] Unable to play ${label}`, error)
  })
}

function playLoop(audio: HTMLAudioElement, label: string) {
  if (!audio.paused || pendingLoopPlayback.has(audio)) return
  pendingLoopPlayback.add(audio)
  void audio.play().catch((error: unknown) => {
    if (error instanceof DOMException && error.name === 'NotAllowedError') return
    console.warn(`[audio] Unable to play ${label}`, error)
  }).finally(() => pendingLoopPlayback.delete(audio))
}

function playFromStart(audio: HTMLAudioElement, label: string) {
  audio.pause()
  if (audio.readyState > HTMLMediaElement.HAVE_NOTHING) audio.currentTime = 0
  play(audio, label)
}

export function startGlobalAudio() {
  playLoop(getAmbience(), 'ambience')
  if (!bgmPausedForPauseScreen) playLoop(getBgm(), 'BGM')
}

export function pauseBgmForPauseScreen() {
  bgmPausedForPauseScreen = true
  bgm?.pause()
  playLoop(getAmbience(), 'ambience')
}

export function resumeBgmAfterPause() {
  bgmPausedForPauseScreen = false
  playLoop(getBgm(), 'BGM')
}

export function stopGlobalAudio() {
  bgm?.pause()
  ambience?.pause()
}

export function preloadGameAudio() {
  getBgm().load()
  getAmbience().load()
  ;(['cameraUp', 'cameraDown', 'cardFlip', 'cardSelect', 'pauseEnter', 'pauseConfirm', 'gameStart', 'brainClick'] as const).forEach((sound) => {
    getSoundEffect(sound).load()
  })
}

export function playCameraTransition(direction: 'up' | 'down') {
  playFromStart(getSoundEffect(direction === 'up' ? 'cameraUp' : 'cameraDown'), `camera-${direction}`)
}

export function playCardFlip() {
  playFromStart(getSoundEffect('cardFlip'), 'card-flip')
}

export function playCardSelect() {
  playFromStart(getSoundEffect('cardSelect'), 'card-select')
}

export function playPauseEnter() {
  playFromStart(getSoundEffect('pauseEnter'), 'pause-enter')
}

export function playPauseConfirm() {
  playFromStart(getSoundEffect('pauseConfirm'), 'pause-confirm')
}

export function playGameStart() {
  playFromStart(getSoundEffect('gameStart'), 'game-start')
}

export function playBrainClick() {
  playFromStart(getSoundEffect('brainClick'), 'brain-click')
}
