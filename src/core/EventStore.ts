import type { DomainEvent } from './messages'

/**
 * 追加式事件存储。写模型产生的每个事件都在此落库并编号。
 */
export class EventStore {
  private events: DomainEvent[] = []
  private seq = 0

  append(events: DomainEvent[], stream: string): DomainEvent[] {
    const stamped = events.map((e) => ({ ...e, seq: ++this.seq, stream }))
    this.events.push(...stamped)
    if (this.events.length > 5000) this.events.splice(0, this.events.length - 5000)
    return stamped
  }

  all(): readonly DomainEvent[] {
    return this.events
  }

  since(seq: number): DomainEvent[] {
    return this.events.filter((e) => (e.seq ?? 0) > seq)
  }

  clear(): void {
    this.events = []
    this.seq = 0
  }
}
