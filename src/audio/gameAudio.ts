// Small procedural instruments keep the archive self-contained, including offline.
export type AudioLevels = { music: number; effects: number }
const STORAGE_KEY = 'the-called-audio-levels'

function clamp(value: number) {
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1
}
function readLevels(): AudioLevels {
    try {
        const parsed: unknown = JSON.parse(
            localStorage.getItem(STORAGE_KEY) ?? 'null',
        )
        if (
            parsed &&
            typeof parsed === 'object' &&
            'music' in parsed &&
            'effects' in parsed
        ) {
            return {
                music:
                    typeof parsed.music === 'number' ? clamp(parsed.music) : 1,
                effects:
                    typeof parsed.effects === 'number'
                        ? clamp(parsed.effects)
                        : 1,
            }
        }
    } catch {
        /* Storage may be unavailable. */
    }
    return { music: 1, effects: 1 }
}

let levels = readLevels()
let context: AudioContext | null = null
let drone: { gain: GainNode; oscillators: OscillatorNode[] } | null = null
let musicPaused = false
let ambienceWanted = false

function audio() {
    if (typeof window === 'undefined' || !('AudioContext' in window))
        return null
    if (!context) context = new AudioContext()
    if (
        context.state === 'suspended' &&
        navigator.userActivation?.hasBeenActive
    )
        void context.resume().catch(() => undefined)
    return context
}

function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(levels))
    } catch {
        /* Current levels still apply. */
    }
}

function updateMusic() {
    if (!context || !drone) return
    drone.gain.gain.setTargetAtTime(
        musicPaused || !ambienceWanted ? 0 : levels.music * 0.026,
        context.currentTime,
        0.3,
    )
}

export function getAudioLevels(): AudioLevels {
    return { ...levels }
}
export function setMusicLevel(music: number) {
    levels = { ...levels, music: clamp(music) }
    persist()
    updateMusic()
}
export function setEffectsLevel(effects: number) {
    levels = { ...levels, effects: clamp(effects) }
    persist()
}

function tone(
    frequency: number,
    duration: number,
    type: OscillatorType = 'triangle',
    volume = 0.08,
    end = frequency,
    delay = 0,
) {
    const ctx = audio()
    if (!ctx || ctx.state !== 'running' || levels.effects === 0) return
    const start = ctx.currentTime + delay
    const oscillator = ctx.createOscillator(),
        envelope = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, end),
        start + duration,
    )
    envelope.gain.setValueAtTime(0, start)
    envelope.gain.linearRampToValueAtTime(
        volume * levels.effects,
        start + 0.004,
    )
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(envelope)
    envelope.connect(ctx.destination)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.015)
    oscillator.onended = () => {
        oscillator.disconnect()
        envelope.disconnect()
    }
}

export function startGlobalAudio() {
    ambienceWanted = true
    // Creating audio before the first gesture causes autoplay warnings in Chromium.
    if (!navigator.userActivation?.hasBeenActive) return
    const ctx = audio()
    if (!ctx) return
    if (!drone) {
        const gain = ctx.createGain(),
            filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 340
        gain.gain.value = 0
        gain.connect(filter)
        filter.connect(ctx.destination)
        const oscillators = [55, 82.41, 110.13].map((frequency) => {
            const oscillator = ctx.createOscillator()
            oscillator.type = 'sine'
            oscillator.frequency.value = frequency
            oscillator.connect(gain)
            oscillator.start()
            return oscillator
        })
        drone = { gain, oscillators }
    }
    updateMusic()
}

export function stopGlobalAudio() {
    ambienceWanted = false
    updateMusic()
}
export function pauseBgmForPauseScreen() {
    musicPaused = true
    updateMusic()
}
export function resumeBgmAfterPause() {
    musicPaused = false
    startGlobalAudio()
}
export function preloadGameAudio() {
    /* Synthesized instruments require no asset downloads. */
}
export function playCardSelect() {
    tone(330, 0.08, 'square', 0.026, 660)
}
export function playCardFlip() {
    tone(180, 0.17, 'triangle', 0.09, 48)
    tone(900, 0.035, 'square', 0.023)
}
export function playBrainClick() {
    tone(440, 0.1, 'triangle', 0.065, 220)
}
export function playCameraTransition(direction: 'up' | 'down') {
    tone(
        direction === 'up' ? 220 : 440,
        0.2,
        'sine',
        0.06,
        direction === 'up' ? 440 : 110,
    )
}
export function playPauseEnter() {
    tone(220, 0.15, 'triangle', 0.035, 110)
}
export function playPauseConfirm() {
    tone(660, 0.1, 'triangle', 0.04, 440)
}
export function playGameStart() {
    tone(110, 0.55, 'sine', 0.08, 55)
    tone(330, 0.25, 'triangle', 0.045, 440, 0.1)
    tone(660, 0.28, 'triangle', 0.035, 330, 0.2)
}
