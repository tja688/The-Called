# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, or
- **`CONTEXT-MAP.md`** at the repo root if it exists: it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## Game design docs (`docs/game-design/`)

Narrative and systems design live under **`docs/game-design/`**, mirrored with the Feishu wiki **the call 游戏设计案**. That tree includes the playtest fiction lookbook and [`4-数据汇总/虚构配置表.md`](../game-design/4-数据汇总/虚构配置表.md).

Engine handoff stays outside that folder: [`docs/6-开发交接/表现层接缝.md`](../6-开发交接/表现层接缝.md) is maintained in-repo only (not synced to Feishu). It is the handoff for commands, queries, events, and presentation.

## File structure

Single-context repo (this repo):

```
/
├── CONTEXT.md
├── docs/
│   ├── agents/          ← agent / triage / tracker config (repo-local, not on Feishu)
│   ├── adr/             ← ADRs (repo-local, not on Feishu)
│   ├── 6-开发交接/       ← engine handoff (repo-local, not on Feishu)
│   └── game-design/     ← Feishu-synced design docs, including playtest fiction
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
