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

function createAudio(path: string, volume: number, loop = false) {
  const audio = new Audio(path)
  audio.preload = 'auto'
  audio.volume = volume
  audio.loop = loop
  return audio
}

function getBgm() {
  bgm ??= createAudio(AUDIO_PATHS.bgm, 0.35, true)
  return bgm
}

function getAmbience() {
  ambience ??= createAudio(AUDIO_PATHS.ambience, 0.32, true)
  return ambience
}

function getSoundEffect(sound: SoundEffect) {
  soundEffects[sound] ??= createAudio(AUDIO_PATHS[sound], 0.8)
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
