import type { DomainEvent } from './messages'

export type EventListener<E extends DomainEvent = DomainEvent> = (event: E) => void

/**
 * 事件总线：发布/订阅。演出层在这里按序消费。
 * 支持按类型订阅与通配订阅（'*'）。
 */
export class EventBus {
  private listeners = new Map<string, Set<EventListener>>()

  on<E extends DomainEvent>(type: E['type'] | '*', listener: EventListener<E>): () => void {
    let set = this.listeners.get(type)
    if (!set) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(listener as EventListener)
    return () => set!.delete(listener as EventListener)
  }

  publish(event: DomainEvent): void {
    this.listeners.get(event.type)?.forEach((l) => l(event))
    this.listeners.get('*')?.forEach((l) => l(event))
  }

  publishAll(events: DomainEvent[]): void {
    for (const e of events) this.publish(e)
  }
}
