import type { Query, QueryResult } from './messages'

export type QueryHandler<Q extends Query = Query> = (query: Q) => QueryResult<Q>

/** 查询总线：只读，同步返回读模型数据。 */
export class QueryBus {
  private handlers = new Map<string, QueryHandler>()

  register<Q extends Query>(type: Q['type'], handler: QueryHandler<Q>): void {
    if (this.handlers.has(type)) throw new Error(`Query handler already registered: ${type}`)
    this.handlers.set(type, handler as QueryHandler)
  }

  ask<Q extends Query>(query: Q): QueryResult<Q> {
    const handler = this.handlers.get(query.type)
    if (!handler) throw new Error(`No query handler for ${query.type}`)
    return handler(query) as QueryResult<Q>
  }
}
