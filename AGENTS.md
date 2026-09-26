# Agent instructions

Rules for agents working in this repository.

## Repository workflow

1. **Do not create branches on your own.** Stay on the branch the user is already on unless they explicitly ask you to create or switch branches.
2. **Do not use git worktrees.** If a skill, script, or workflow expects a worktree, implement the same outcome on the current branch in this clone instead.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (use the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context layout: root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
