# Agent instructions

Canonical instructions for any agent.

> **Architecture skill, required:** follow the feature-sliced-nx skill when creating, moving, or splitting UI. Global copy: `~/.agents/skills/feature-sliced-nx/SKILL.md`. Vendored copy, which the gate runs: `.agents/skills/feature-sliced-nx/SKILL.md`.

`.cursor/rules/*.mdc` and `.windsurf/rules/*.md` carry the same rules for tools that do not load this file. Change a rule here and in both rule folders in the same edit. A rule that belongs in the skill changes in the skill's source repo too.

## Stay on the slice

- One slice is one library at `libs/<domain>/<layer>/<slice>`. Generate it with `fsd-slice` (wraps `@nx/react:library`). Do not hand-roll `project.json`. This skill does not generate apps; create the app with `@nx/react:application` (or the workspace equivalent) and tag it `fsd:layer:app`.
- Pages-first: keep code in the page library until the extraction rule holds. Prefer app + pages + shared before opening features or entities.
- `widgets` is discouraged. App shell in the app, one-page blocks in that page library, reused actions in features, kit UI in shared. Open a widget library only for a true shared composition.
- Layers, top to bottom: `app`, `pages`, `widgets`, `features`, `entities`, `shared`. A library imports only layers below it, and only through each library's public `src/index.ts` (`@<scope>/<project>`).
- The app lives in `apps/` and is tagged `fsd:layer:app`. It does not grow `src/features` or `src/pages`.
- Segments inside a library are only `ui`, `model`, `api`, `lib`, `config`. Effects and server state go in `model`. `fetch` goes in `api`. `api`, `lib`, and `config` do not import React.
- A route screen is a page. A reused action is a feature. A reused domain model is an entity. Code with no business rules is `libs/shared/shared/<slice>`. Auth tokens default to shared auth/api.
- Layout is domain-first: `libs/<domain>/<layer>/<slice>`. Shared primitives stay under `libs/shared/`. Cross-domain DTOs with no behavior go in `libs/shared/shared/kernel`.
- `ui` is markup plus wiring: one component per file, kebab-case, named after the component. Types and hooks go in `model`, consts in `config`, helpers in `lib`, network in `api`.
- Segment files are role- or concept-named (`types.ts`, `hooks.ts`), never `<slice>.types.ts`.
- Name a page or slice after the route or capability (`pages/focus` + `ui/focus.tsx`), not a UI variant (`focus-radar-modal`).
- Keep files at or under `maxFileLines` in `fsd.nx.json` (starter value 200).

## Gate

- The check is `node .agents/skills/feature-sliced-nx/scripts/gate.mjs` (or `bun run gate` / `npm run gate` once that script exists). Done means this command passed and the reply names it.
- Do not raise `maxFileLines`, widen `ignore`, retag a library, or set the boundary rule to `warn` to make the gate pass. That is the user's call. The one-time adoption `validate-segments.mjs --baseline` runs only on their go-ahead.
- Do not skip git hooks (`--no-verify`, `git commit -n`, `LEFTHOOK=0`, `HUSKY=0`). The shell hook blocks those commands.
- On an existing app, migrate the file you touch. Tag untouched libraries `legacy-code` (see the skill). Leave ignored libraries alone and say so. Finish one slice before starting the next. New work uses `fsd-slice`, not `legacy-code`.
- When a file moves or is renamed, update every doc that names the old path in the same change.
- Do not commit or push unless asked. Do not install packages, skills, or MCP servers unless asked.

## Learned User Preferences

- Prioritize small, readable files: `ui` is markup plus wiring; types, hooks, consts, and helpers go in their segments (`model`, `config`, `lib`), not in the component file.
- Segment files are unprefixed role or concept names (`types.ts`, `hooks.ts`), never `task-list.types.ts`.
- Name a page or slice after the route or capability (`pages/focus` + `ui/focus.tsx`), not a descriptive variant like `focus-radar-modal`.

## Learned Workspace Facts

- `AGENTS.md` is the canonical agent instruction file. `CLAUDE.md` only imports it with `@AGENTS.md`.
- Gate config: `fsd.nx.json`. Skill scripts: `.agents/skills/feature-sliced-nx/scripts/`.
- Generator: `nx g @<scope>/<plugin>:fsd-slice <slice> --domain=<domain> --layer=<layer>`.
- Domain-first layout; tag legacy projects `legacy-code`; shared kernel at `libs/shared/shared/kernel`.
- <Data layer, and any data layers to ignore guidance for.>
- <Reference slice, e.g. "`libs/<domain>/pages/<slice>/` is the worked example.">
