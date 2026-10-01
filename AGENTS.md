# Agent instructions

一款非对称单机 CCG。本仓库同时放规则内核、内容目录和网页试玩。极简矢量几何的画面风格。

## 三块

- **内核** `src/Pcd.Kernel`：规则只写在这里。Unity 用 `https://github.com/tja688/The-Called.git?path=/src/Pcd.Kernel#<标签>` 引用这一包。
- **数据** `content/`：卡牌、卡背、怪物、牌组的 YAML。Unity 用 `https://github.com/tja688/The-Called.git?path=/content#<标签>` 引用。宿主读出文本再交给内核，不要嵌进 `Pcd.Kernel`。
- **网页表现层** `src/` 里除 `Pcd.*` 以外的 TypeScript：三维场景、地图、构筑和启动页。合法操作只来自内核给出的选项。局外地图和牌组留在网页，进对局时只提交对局配置。

分界和取舍见 `docs/adr/0012-one-repo-kernel-content-web.md`。术语以 `CONTEXT.md` 为准。规则文档在 `docs/game design`。其余架构决定在 `docs/adr/`。

## 内核约束

改 `src/Pcd.Kernel` 时保持这些限制：C# 9 / .NET Standard 2.1；不引用 UnityEngine；规则数值只用整数；随机数只用内核自带、状态可序列化的实现，不用 `System.Random`；不依赖字典遍历顺序、系统时钟与运行环境；不允许可变静态状态；不用运行时代码生成。内核只生产事件，表现层不自行判断合法性。

## Repository workflow

1. **Do not create branches on your own.** Stay on the branch the user is already on unless they explicitly ask you to create or switch branches.
2. **Do not use git worktrees.** If a skill, script, or workflow expects a worktree, implement the same outcome on the current branch in this clone instead.

## 测试

- 内核：`dotnet test Pcd.slnx`
- 网页：`npm test`
- 网页与内核一起玩：`start-game.bat`

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (use the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context layout: root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
