---
trigger: always_on
description: How to work in this repo. Feature-Sliced layers, the gate, and git.
---

# Core principles

Follow the feature-sliced-design skill before creating or moving a slice: `.agents/skills/feature-sliced-design/SKILL.md` (global: `~/.agents/skills/feature-sliced-design/SKILL.md`).

## Layout

- Layers, top to bottom: `app`, `pages`, `widgets`, `features`, `entities`, `shared`. Imports go downward only.
- Slices live on `pages`, `widgets`, `features`, and `entities`. Each slice has `index.ts` as its public API. Import that index, not a file inside the slice.
- Segments are only `ui`, `model`, `api`, `lib`, `config`. `app` and `shared` are not sliced. Entities may add `@x/<other-slice>.ts` for one cross-import.
- A screen is a page, a reusable block is a widget, a user action is a feature, a business noun is an entity.
- Kebab-case file and folder names. One component per file, named after the file.

## Gate

- Pass `node .agents/skills/feature-sliced-design/scripts/gate.mjs` before calling the work done. Name that command in the reply.
- Do not raise limits in `fsd.gate.json`, widen `ignore`, or skip git hooks. Those are the user's call.
- Do not add layers or folders the skill does not name (`processes`, `components`, `hooks`).
- Migrate the file you touch. Do not rewrite ignored legacy folders.
- When a path changes, update every doc that names it in the same change.
- Do not commit or push unless the user asks.
