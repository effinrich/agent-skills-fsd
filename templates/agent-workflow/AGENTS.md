# Agent instructions

Canonical instructions for any agent.

> **Architecture skill, required:** follow the feature-sliced-design skill when creating, moving, or splitting UI. Global copy: `~/.agents/skills/feature-sliced-design/SKILL.md`. Vendored copy, which the gate runs: `.agents/skills/feature-sliced-design/SKILL.md`.

`.cursor/rules/*.mdc` and `.windsurf/rules/*.md` carry the same rules for tools that do not load this file. Change a rule here and in both rule folders in the same edit. A rule that belongs in the skill changes in the skill's source repo too.

## Stay on the slice

- Layers, top to bottom: `app`, `pages`, `widgets`, `features`, `entities`, `shared`. A slice imports only layers below it, and only through each slice's `index.ts`.
- Pages-first: keep code in the page until the extraction rule holds (real reuse, independent reason to change, focused boundary). Prefer `app` + `pages` + `shared` before opening features or entities.
- `widgets` is discouraged. App shell in `app`, one-page blocks in that page, reused actions in `features`, kit UI in `shared`. Open a widget only for a true shared composition.
- `pages`, `widgets`, `features`, and `entities` are slices. `app` and `shared` are segments, not slices. Segments are `ui`, `model`, `api`, `lib`, `config`.
- A route screen is a page. A user action is a feature when shared. A business noun is an entity when shared. Code with no business rules is shared. Auth tokens default to `shared/auth` or `shared/api`.
- Do not add a layer, a `processes` folder, a `components` folder, or a `hooks` segment. Do not import a sibling slice. Entities cross-import only through `@x/<slice>`.
- `ui` is markup plus wiring: one component per file, kebab-case, named after the component. Types and hooks go in `model`, consts in `config`, helpers in `lib`, network in `api`.
- Segment files are role- or concept-named (`types.ts`, `hooks.ts`, `auth.ts`), never `<slice>.types.ts`.
- Name a page or slice after the route or capability (`pages/focus` + `ui/focus.tsx`), not a UI variant (`focus-radar-modal`).
- Keep files at or under `maxFileLines` in `fsd.gate.json` (starter value 200).

## Gate

- The check is `node .agents/skills/feature-sliced-design/scripts/gate.mjs` (or `bun run gate` / `npm run gate` once that script exists). Done means this command passed and the reply names it.
- Do not raise `maxFiles`, `maxLines`, or `maxFileLines`, and do not add `ignore` entries, to make the gate pass. That is the user's call. The one-time adoption `validate.mjs --baseline` runs only on their go-ahead.
- Do not skip git hooks (`--no-verify`, `git commit -n`, `LEFTHOOK=0`, `HUSKY=0`). The shell hook blocks those commands.
- On an existing app, migrate the file you touch. Leave ignored legacy folders alone and say so.
- When a file moves or is renamed, update every doc that names the old path in the same change.
- Do not commit or push unless asked. Do not install packages, skills, or MCP servers unless asked.

## Learned User Preferences

- Prioritize small, readable files: `ui` is markup plus wiring; types, hooks, consts, and helpers go in their segments (`model`, `config`, `lib`), not in the component file.
- Segment files are unprefixed role or concept names (`types.ts`, `hooks.ts`, `auth.ts`), never `task-list.types.ts`.
- Name a page or slice after the route or capability (`pages/focus` + `ui/focus.tsx`), not a descriptive variant like `focus-radar-modal`.

## Learned Workspace Facts

- `AGENTS.md` is the canonical agent instruction file. `CLAUDE.md` only imports it with `@AGENTS.md`.
- Gate config: `fsd.gate.json`. Skill scripts: `.agents/skills/feature-sliced-design/scripts/`.
- <Data layer, and any data layers to ignore guidance for.>
- <Backend entry and routing, or delete this line.>
- <Reference slice, e.g. "`src/pages/<slice>/` is the worked example.">
