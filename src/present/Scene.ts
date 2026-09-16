import type { DomainEvent } from '../core/messages'
import type { TextLayer } from '../pixel/text'
import type { PresentApp } from './PresentApp'

export type SceneName = 'title' | 'map' | 'event' | 'reward' | 'battle' | 'ending'

/** 场景接口：进入 / 离开 / 每帧 / 事件编排（可 await）/ 键盘 */
export abstract class Scene {
  abstract readonly name: SceneName
  constructor(protected app: PresentApp) {}
  enter(): void {}
  exit(): void {}
  update(_dt: number): void {}
  abstract render(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void
  handle(_e: DomainEvent): Promise<void> | void {}
  onCancel(): void {}
  onConfirm(): void {}
  onAnyClick(_x: number, _y: number, _hit: string | null): void {}
}
