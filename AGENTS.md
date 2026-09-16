# 代理须知

做任何改动前按这个顺序读：

1. [docs/索引.md](docs/索引.md) — 文档地图
2. [docs/0-核心设计/第四版裁定.md](docs/0-核心设计/第四版裁定.md) — 和旧文档冲突时以哪条为准
3. [docs/6-开发交接/表现层接缝.md](docs/6-开发交接/表现层接缝.md) — 命令 / 查询 / 事件 / 视图
4. [.cursor/skills/pixel-layer/SKILL.md](.cursor/skills/pixel-layer/SKILL.md) — 画像素时

规则只通过 `GameService` 的 `dispatch` / `ask` / `on`。`present` 和 `pixel` 只消费事件，不改判定。

改接缝先改 `src/application/commands.ts`、`queries.ts`、事件联合和接缝文档，四处一起动。`npm run sim -- --compare` 必须和第一轮基线逐位一致。
