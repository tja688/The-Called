# 代理须知

## 项目介绍

本项目是游戏：project_thecall 这款九宫格堆叠放置拼点卡牌冒险游戏的web端前置测试demo，仅用于验证玩法

## Agent skills

### Issue tracker

本仓库用 **GitHub Issues** 跟踪工单（`gh` CLI）。见 [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md)。

### Triage labels

默认五标签（`needs-triage` 等），与 Matt Pocock skills 一致。见 [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md)。

### Domain docs

**单上下文**：根目录 [`CONTEXT.md`](CONTEXT.md) + 按需 [`docs/adr/`](docs/adr/)。设计案在 [`docs/game-design/`](docs/game-design/)（飞书同步）。引擎交接在 [`docs/6-开发交接/`](docs/6-开发交接/)。见 [`docs/agents/domain.md`](docs/agents/domain.md)。

## Git 与工作区

- **严禁**自行创建分支（含 feature / fix 等）；在**当前检出分支**上工作，除非用户明确要求建分支。
- **严禁**使用 `git worktree` 或任何等价的多工作区检出。

## 关键文档，根据任务需求选读

1. [`CONTEXT.md`](CONTEXT.md) — 术语表（与实现、测试用语对齐）
2. [`docs/game-design/0-核心设计/玩法.md`](docs/game-design/0-核心设计/玩法.md) — 一句话玩法
3. [`docs/game-design/0-核心设计/循环.md`](docs/game-design/0-核心设计/循环.md) — 局内 / 局外循环
4. 与任务相关的 `docs/game-design/` 小节（`1-概念名词/`、`2-系统机制/`、`3-循环流程/`、`4-数据汇总/` 等；各目录顶层的 `docs/game-design/N-*.md` 仅为分组占位）
5. [`docs/6-开发交接/表现层接缝.md`](docs/6-开发交接/表现层接缝.md) — 命令 / 查询 / 事件 / 视图（改表现或接缝时必读）
6. [`.cursor/skills/pixel-layer/SKILL.md`](.cursor/skills/pixel-layer/SKILL.md) — 画像素时
7. [`docs/game-design/Playtest虚构设计总纲.md`](docs/game-design/Playtest虚构设计总纲.md) — 此项目专属虚构设计案，需要结合 [`docs/game-design/4-数据汇总/虚构配置表.md`](docs/game-design/4-数据汇总/虚构配置表.md) 使用。

**裁定**：旧版 `docs/索引.md`、`第四版裁定.md` 等已随飞书结构更替；设计冲突以**飞书现行文档 + CONTEXT.md** 为准；已实现行为以代码与 `npm run sim -- --compare` 基线为准。

## 代码规则

规则只通过 `GameService` 的 `dispatch` / `ask` / `on`。`present` 和 `pixel` 只消费事件，不改判定。

改接缝先改 `src/application/commands.ts`、`queries.ts`、事件联合和 [`docs/6-开发交接/表现层接缝.md`](docs/6-开发交接/表现层接缝.md)，四处一起动。`npm run sim -- --compare` 必须和第 1 层新基线逐位一致。残响不进默认测试门。
