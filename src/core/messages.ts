/**
 * CQRS 基元：命令（写意图）、查询（读意图）、事件（已发生的事实）。
 */
export interface Command<TType extends string = string> {
  readonly type: TType
}

export interface Query<TType extends string = string, _TResult = unknown> {
  readonly type: TType
}

export interface DomainEvent<TType extends string = string> {
  readonly type: TType
  /** 单调递增序号，由 EventStore 在追加时赋予 */
  seq?: number
  /** 逻辑聚合流：'run' | 'battle' */
  stream?: string
}

export type QueryResult<Q> = Q extends Query<string, infer R> ? R : never
