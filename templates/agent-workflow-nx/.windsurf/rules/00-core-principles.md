---
trigger: always_on
description: How to work in this repo. Feature-Sliced libraries, the gate, and git.
---

# Core principles

Follow the feature-sliced-nx skill before creating or moving a slice: `.agents/skills/feature-sliced-nx/SKILL.md` (global: `~/.agents/skills/feature-sliced-nx/SKILL.md`).

## Layout

- Domain-first: one slice is one library at `libs/<domain>/<layer>/<slice>`, generated with `fsd-slice` (library only; apps use `@nx/react:application`).
- Pages-first. Extract only when reuse is real, the boundary has its own reason to change, and the responsibility is focused. `widgets` is discouraged.
- Layers, top to bottom: `app`, `pages`, `widgets`, `features`, `entities`, `shared`. Imports go downward only, through each library's public package path.
- The app is `apps/<app>` tagged `fsd:layer:app`. It imports libraries. It does not grow `src/features` or `src/pages`.
- Segments are only `ui`, `model`, `api`, `lib`, `config`. `ui` is markup plus wiring; types/hooks in `model`, consts in `config`, helpers in `lib`.
- Name slices after the route or capability, not a UI variant. Segment files are unprefixed (`types.ts`, not `task-list.types.ts`).
- A screen is a page. A reused action is a feature. A reused domain model is an entity. Infrastructure with no product rule is shared. Cross-domain DTOs: `libs/shared/shared/kernel`.
- Kebab-case file and folder names. One component per file, named after the file.
- Migrating: tag untouched libs `legacy-code`; new work uses `fsd-slice`.

## Gate

- Pass `node .agents/skills/feature-sliced-nx/scripts/gate.mjs` before calling the work done. Name that command in the reply.
- Do not raise `maxFileLines` in `fsd.nx.json`, widen `ignore`, retag a library, or skip git hooks. Those are the user's call. The one-time adoption `validate-segments.mjs --baseline` runs only on their go-ahead.
- Migrate the file you touch. Do not rewrite ignored libraries. Finish one slice before the next.
- When a path changes, update every doc that names it in the same change.
- Do not commit or push unless the user asks.
