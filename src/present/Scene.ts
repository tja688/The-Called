import type { DomainEvent } from '../core/messages'
import type { TextLayer } from '../pixel/text'
import type { PresentApp } from './PresentApp'

export type SceneName = 'title' | 'map' | 'event' | 'reward' | 'battle' | 'ending' | 'shop' | 'rest' | 'forge' | 'chest'

/** 场景接口：进入 / 离开 / 每帧 / 事件编排（可 await）/ 键盘 */
export abstract class Scene {
  abstract readonly name: SceneName
  constructor(protected app: PresentApp) {}
  enter(): void {}
  exit(): void {}
  update(_dt: number): void {}
  abstract render(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void
  handle(_e: DomainEvent): Promise<void> | void {}
  /** 演出中锁指针。空格快进仍走键盘。 */
  blocksInput(): boolean { return false }
  /** 为真时不画右上角菜单，留给全屏压黑转场。 */
  coversChrome(): boolean { return false }
  /** @returns 是否已经消化这次取消（选中的牌、打开的卡盒等） */
  onCancel(): boolean { return false }
  onConfirm(): void {}
  onKey(_k: string): void {}
  onAnyClick(_x: number, _y: number, _hit: string | null): void {}
}
