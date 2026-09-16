/**
 * 短采样合成：一拍一音。不要编曲。快进时缩短或跳过。
 */
import { tw } from '../pixel/tween'
import type { EncounterId } from '../domain/types'

export type Sfx =
  | 'click' | 'play' | 'cover' | 'draw' | 'mana' | 'pressure'
  | 'hurt' | 'banish' | 'lead' | 'win' | 'lose' | 'reward' | 'seal'

const FREQ: Record<Sfx, number[]> = {
  click: [880],
  play: [420, 560],
  cover: [140, 90],
  draw: [320, 480],
  mana: [660, 880],
  pressure: [80, 60],
  hurt: [220, 180, 140],
  banish: [160, 120, 80],
  lead: [520, 660, 780],
  win: [440, 554, 659],
  lose: [330, 247, 196],
  reward: [523, 659, 784],
  seal: [300, 240],
}

class AudioBus {
  muted = false
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private drone: OscillatorNode | null = null
  private droneGain: GainNode | null = null

  constructor() {
    try {
      this.muted = localStorage.getItem('called.mute') === '1'
    } catch { /* ignore */ }
  }

  setMuted(v: boolean): void {
    this.muted = v
    try { localStorage.setItem('called.mute', v ? '1' : '0') } catch { /* ignore */ }
    if (this.droneGain) this.droneGain.gain.value = v ? 0 : 0.03
  }

  toggle(): void { this.setMuted(!this.muted) }

  private ensure(): AudioContext | null {
    if (typeof AudioContext === 'undefined') return null
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.22
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  sfx(name: Sfx): void {
    if (this.muted) return
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const fast = tw.speed > 1.5
    if (fast && name !== 'win' && name !== 'lose') {
      this.tone(ctx, 720, 0.03, 'square', 0.08)
      return
    }
    const notes = FREQ[name]
    const noise = name === 'cover' || name === 'pressure' || name === 'banish'
    notes.forEach((f, i) => {
      const t = i * (fast ? 0.03 : 0.07)
      const dur = fast ? 0.05 : name === 'win' || name === 'lose' ? 0.22 : 0.1
      const type: OscillatorType = name === 'pressure' || name === 'cover' ? 'sawtooth' : 'triangle'
      this.tone(ctx, f, dur, type, 0.16, t)
    })
    if (noise) this.burst(ctx, fast ? 0.04 : 0.08)
  }

  atmosphere(id: EncounterId | null): void {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    this.stopDrone()
    if (!id) return
    const freq = id === 'yuZhuang' ? 92 : id === 'boShou' ? 73 : 55
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    g.gain.value = this.muted ? 0 : 0.03
    osc.connect(g)
    g.connect(this.master)
    osc.start()
    this.drone = osc
    this.droneGain = g
  }

  stopDrone(): void {
    try { this.drone?.stop() } catch { /* ignore */ }
    this.drone?.disconnect()
    this.droneGain?.disconnect()
    this.drone = null
    this.droneGain = null
  }

  private tone(ctx: AudioContext, freq: number, dur: number, type: OscillatorType, vol: number, when = 0): void {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    const t0 = ctx.currentTime + when
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(this.master!)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  private burst(ctx: AudioContext, dur: number): void {
    const n = Math.floor(ctx.sampleRate * dur)
    const buf = ctx.createBuffer(1, n, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n)
    const src = ctx.createBufferSource()
    const g = ctx.createGain()
    src.buffer = buf
    g.gain.value = 0.12
    src.connect(g)
    g.connect(this.master!)
    src.start()
  }
}

export const audio = new AudioBus()
