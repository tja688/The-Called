import type { Command, DomainEvent } from './messages'

export type CommandHandler<C extends Command = Command> = (command: C) => DomainEvent[] | Promise<DomainEvent[]>

/**
 * 命令总线：每种命令类型恰有一个处理器；处理器返回本次命令产生的事件序列。
 */
export class CommandBus {
  private handlers = new Map<string, CommandHandler>()
  private middlewares: Array<(command: Command, next: () => Promise<DomainEvent[]>) => Promise<DomainEvent[]>> = []

  register<C extends Command>(type: C['type'], handler: CommandHandler<C>): void {
    if (this.handlers.has(type)) throw new Error(`Command handler already registered: ${type}`)
    this.handlers.set(type, handler as CommandHandler)
  }

  use(mw: (command: Command, next: () => Promise<DomainEvent[]>) => Promise<DomainEvent[]>): void {
    this.middlewares.push(mw)
  }

  async dispatch<C extends Command>(command: C): Promise<DomainEvent[]> {
    const handler = this.handlers.get(command.type)
    if (!handler) throw new Error(`No command handler for ${command.type}`)
    const run = async (i: number): Promise<DomainEvent[]> => {
      if (i >= this.middlewares.length) return await handler(command)
      return this.middlewares[i](command, () => run(i + 1))
    }
    return run(0)
  }
}
