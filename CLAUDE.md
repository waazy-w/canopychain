# CLAUDE.md

Shared instructions for every Claude Code session on this project. Two teammates work on this repo at the same time, each with their own Claude Code. Keep this file accurate. If you change the stack, commands or ownership, update it in the same PR.

## Project

**IEEE ClimateChain Global Hackathon** submission.

- **Idea:** TODO: one or two sentences on the problem and the solution
- **MVP / demo flow:** TODO: the 3–5 steps the demo shows, start to finish
- **Out of scope:** TODO: what we are deliberately not building

## Tech stack

TODO: fill in once decided, e.g.
- Frontend: …
- Backend: …
- Data / ML: …
- Hosting / deploy: …

## Commands

TODO: fill in after scaffolding
```
# install
# run dev
# test
# lint / format
```

## Ownership: who works where

Stay inside your own area. If you need to change something in your teammate's area, or a shared file, say so first (in chat or on the issue).

| Area | Owner | Paths |
|------|-------|-------|
| TODO (e.g. Frontend) | Teammate A | `frontend/` |
| TODO (e.g. Backend / data) | Teammate B | `backend/` |
| Shared: coordinate before editing | both | `docs/api.md`, `CLAUDE.md`, root config, dependency manifests, DB schema |

## Contract between parts

`docs/api.md` is the source of truth for every endpoint and data shape shared between the two parts.
- Build against the contract. Use mock data until the real implementation exists.
- If you change the contract, update `docs/api.md` in the **same PR** and tell your teammate.

## Git workflow

- `main` must always run. Never commit directly to `main`.
- Use one branch per task: `feat/<short-name>`, `fix/<short-name>`.
- Run `git pull --rebase origin main` before starting work and before opening a PR.
- Keep PRs small and merge them often. Reference the issue or task (`Closes #4`).
- Keep commits small, with clear messages in the imperative mood ("Add emissions endpoint").
- Do not add Claude co-author or attribution lines to commits or PRs.

## Rules

- Never commit secrets. Real values go in `.env` (gitignored). Add every new variable name to `.env.example`.
- Never commit build output, `node_modules/`, virtualenvs, or large datasets. Put data download steps in the README.
- Run the tests and linter before committing, once they exist.
- When you finish a task, tick it off in `TASKS.md`.
