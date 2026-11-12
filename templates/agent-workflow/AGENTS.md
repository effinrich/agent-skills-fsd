# Agent instructions

Canonical instructions for any agent.

> **Architecture skill, required:** follow the feature-sliced-design skill when creating, moving, or splitting UI. Global copy: `~/.agents/skills/feature-sliced-design/SKILL.md`. Vendored copy, which the gate runs: `.agents/skills/feature-sliced-design/SKILL.md`.

`.cursor/rules/*.mdc` and `.windsurf/rules/*.md` carry the same rules for tools that do not load this file. Change a rule here and in both rule folders in the same edit. A rule that belongs in the skill changes in the skill's source repo too.

## Stay on the slice

- Layers, top to bottom: `app`, `pages`, `widgets`, `features`, `entities`, `shared`. A slice imports only layers below it, and only through each slice's `index.ts`.
- `pages`, `widgets`, `features`, and `entities` are slices. `app` and `shared` are segments, not slices. Segments are `ui`, `model`, `api`, `lib`, `config`.
- A route screen is a page. A reusable block is a widget. A user action is a feature. A business noun is an entity. Code with no business meaning is shared.
- Do not add a layer, a `processes` folder, a `components` folder, or a `hooks` segment. Do not import a sibling slice. Entities cross-import only through `@x/<slice>`.
- `ui` is markup and wiring: one component per file, kebab-case, named after the component. Effects, server state, and `fetch` go in `model` or `api`.
- Keep files at or under `maxFileLines` in `fsd.gate.json` (starter value 200).

## Gate

- The check is `node .agents/skills/feature-sliced-design/scripts/gate.mjs` (or `bun run gate` / `npm run gate` once that script exists). Done means this command passed and the reply names it.
- Do not raise `maxFiles`, `maxLines`, or `maxFileLines`, and do not add `ignore` entries, to make the gate pass. That is the user's call.
- Do not skip git hooks (`--no-verify`, `git commit -n`, `LEFTHOOK=0`, `HUSKY=0`). The shell hook blocks those commands.
- On an existing app, migrate the file you touch. Leave ignored legacy folders alone and say so.
- When a file moves or is renamed, update every doc that names the old path in the same change.
- Do not commit or push unless asked. Do not install packages, skills, or MCP servers unless asked.

## Learned User Preferences

- <Add durable preferences here. Do not paste task-specific notes.>

## Learned Workspace Facts

- `AGENTS.md` is the canonical agent instruction file. `CLAUDE.md` only imports it with `@AGENTS.md`.
- Gate config: `fsd.gate.json`. Skill scripts: `.agents/skills/feature-sliced-design/scripts/`.
- <Data layer, and any data layers to ignore guidance for.>
- <Backend entry and routing, or delete this line.>
- <Reference slice, e.g. "`src/features/<slice>/` is the worked example.">
