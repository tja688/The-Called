# 代理须知

## Agent skills

### Issue tracker

本仓库用 **GitHub Issues** 跟踪工单（`gh` CLI）。见 [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md)。

### Triage labels

默认五标签（`needs-triage` 等），与 Matt Pocock skills 一致。见 [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md)。

### Domain docs

**单上下文**：根目录 [`CONTEXT.md`](CONTEXT.md) + 按需 [`docs/adr/`](docs/adr/)。设计案在 [`docs/`](docs/)（飞书同步）。见 [`docs/agents/domain.md`](docs/agents/domain.md)。

## Git 与工作区

- **严禁**自行创建分支（含 feature / fix 等）；在**当前检出分支**上工作，除非用户明确要求建分支。
- **严禁**使用 `git worktree` 或任何等价的多工作区检出。

## 设计文档（飞书 → `docs/`）

- **唯一真源**：飞书知识库 **the call 游戏设计案**。
- **全量同步**：在仓库根目录执行 `npm run sync:feishu-docs`（或 `node scripts/sync-feishu-wiki.mjs`）。说明见 [`scripts/sync-feishu-wiki.md`](scripts/sync-feishu-wiki.md)。
- **差异记录**：每次同步追加 [`docs/飞书同步差异记录.md`](docs/飞书同步差异记录.md)（该文件与 [`sync-feishu-wiki.config.json`](scripts/sync-feishu-wiki.config.json) 中的 `preserveRelPaths` 不会被同步删除）。
- 改设计：**先改飞书**，再跑同步；不要只在本地 `docs/` 改飞书已有页面（除非用户明确说「仅本地草稿」）。
- **不同步、仓库自管**：[`docs/6-开发交接/表现层接缝.md`](docs/6-开发交接/表现层接缝.md)（已在 `preserveRelPaths` 中）。

## 做任何改动前，按此顺序读

1. [`CONTEXT.md`](CONTEXT.md) — 术语表（与实现、测试用语对齐）
2. [`docs/0-核心设计/玩法.md`](docs/0-核心设计/玩法.md) — 一句话玩法
3. [`docs/0-核心设计/循环.md`](docs/0-核心设计/循环.md) — 局内 / 局外循环
4. 与任务相关的 `docs/` 小节（`1-概念名词/`、`2-系统机制/`、`3-循环流程/`、`4-数据汇总/` 等；各目录顶层的 `docs/N-*.md` 仅为分组占位）
5. [`docs/6-开发交接/表现层接缝.md`](docs/6-开发交接/表现层接缝.md) — 命令 / 查询 / 事件 / 视图（改表现或接缝时必读）
6. [`.cursor/skills/pixel-layer/SKILL.md`](.cursor/skills/pixel-layer/SKILL.md) — 画像素时

**裁定**：旧版 `docs/索引.md`、`第四版裁定.md` 等已随飞书结构更替；设计冲突以**飞书现行文档 + CONTEXT.md** 为准；已实现行为以代码与 `npm run sim -- --compare` 基线为准。

## 代码规则

规则只通过 `GameService` 的 `dispatch` / `ask` / `on`。`present` 和 `pixel` 只消费事件，不改判定。

改接缝先改 `src/application/commands.ts`、`queries.ts`、事件联合和 [`docs/6-开发交接/表现层接缝.md`](docs/6-开发交接/表现层接缝.md)，四处一起动。`npm run sim -- --compare` 必须和第一轮基线逐位一致。
