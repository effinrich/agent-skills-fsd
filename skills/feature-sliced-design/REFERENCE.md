# Feature-Sliced Design — Reference

Edges and decisions behind the skill. The gate implements the checks named here. Official methodology: [feature-sliced.design](https://feature-sliced.design/docs).

## What the gate enforces

| Check | Failure |
| --- | --- |
| Top-level folder under `src/` is not a layer | Unknown folder. `processes` has its own message. |
| Slice missing `index.ts` | No public API. |
| `pages/index.ts` or the same barrel on `widgets`, `features`, `entities` | Layer barrel. Import the slice. |
| Segment outside `ui`, `model`, `api`, `lib`, `config` | Unknown segment. `hooks/` and `components/` fail here. |
| Segment folder sitting directly on a sliced layer | Put it inside a slice. |
| Import of a layer above, or of a sibling slice | Downward imports only. |
| Import of `features/auth/ui/...` or `shared/ui/button/button` from outside | Public API sidestep. |
| `@x` used outside entities, or imported by the wrong slice | Cross-import is `entities/<owner>/@x/<importer>`. |
| PascalCase file, second component, unnamed default export | Kebab-case, one named component per file. |
| `useEffect` / `useQuery` in `ui`, `api`, `lib`, or `config` | Belongs in `model` (or in `app` wiring). |
| `fetch` / `axios` outside an `api` segment | Belongs in `api`. `app` may call the network outside `ui`. |
| React import in `api`, `lib`, or `config` | Hooks belong in `model`. |
| File over `maxFileLines` | Split. Tests, stories, and specs are exempt. |
| Tree over `maxFiles` or `maxLines` | Cut scope. The limit change is the user's. |

`ignore` entries in `fsd.gate.json` are path prefixes, relative to the project root (`src/legacy`). Ignored trees are not walked and imports into them are allowed. Use that for code not migrated yet. Do not ignore a path to hide a new violation.

## What the gate does not decide

- Whether `auth` should be a feature or a widget. The layer tables in the skill are the guide. Steiger's `insignificant-slice` and `excessive-slicing` rules comment on granularity; they are off by default so the first use of an entity does not fail the gate.
- Whether a business rule is correct.
- Lint, types, and tests, until those commands are listed in `extra`.

## `@x`

`song` needs `User`, and `User` must not depend on `song` through the normal public API in a cycle of entities.

```
entities/user/@x/song.ts    re-exports the types song is allowed to see
entities/song/model/song.ts imports "entities/user/@x/song"
```

The file name is the importing slice. `playlist` cannot import `@x/song`. A feature cannot import `@x` at all; it imports `entities/user`.

## App layer and framework routers

Allowed folders in `app`: `ui`, `model`, `api`, `lib`, `config`, `providers`, `styles`, `routes`, `store`, plus entry files `index.tsx`, `app.tsx`, `main.tsx`, and CSS.

`page.tsx`, `layout.tsx`, and `route.ts` in `app` fail. Those names belong to the framework. Feature-Sliced `app` is wiring.

Next.js App Router wants a folder named `app`. Keep that folder at the repo root (or another path listed in `ignore`) and make each route file re-export a page slice. Do not put Feature-Sliced slices inside the Next route tree, and do not put Next route files in `src/app`.

Vite and other bundlers can keep `src/main.tsx` next to the layers. That file is an allowed `src` root file. `src/main.tsx` rendering `app` is the entry. It is not a layer.

## Groups

`src/pages/(marketing)/about/` is the `about` slice. The `(marketing)` folder is a group because it has no `index.ts` and no segment of its own. Another page still cannot import `about`: same layer. Importing `pages/(marketing)/about` from a widget is an upward import and fails.

A folder named `[id]` that contains `index.ts` is a slice, not a group.

## From the feature-folder skill

`feature-based-architecture` colocates `types.ts`, `consts.ts`, `hooks.ts`, `utils.ts`, and `api.ts` beside a component. Here those roles are segments, and screens are not automatically features.

A component folder that was `src/features/tasks/task-list/` becomes one of:

- `src/pages/task-list/` when it is a route
- `src/widgets/task-list/` when several pages embed it
- `src/features/filter-tasks/` when the behaviour is the action and the list view is a page or widget that calls it

Move the file you are changing. Leave the rest on `ignore` until it is that file's turn.

## Hooks

Cursor stop output is `{ "followup_message" }` and exit 0. The hook skips the gate when `status` is `aborted` or `error`, and when `git status` is clean. A dirty tree that fails the gate is sent back. `loop_count` of 3, or three recorded failures in the same conversation, stops the loop and writes the last output to stderr.

Cursor shell output is `{ "permission": "deny" | "allow" }` with no extra fields. Claude Code shell output uses `hookSpecificOutput.permissionDecision`. Claude Code stop output uses `{ "decision": "block", "reason" }`. The scripts pick the shape from the stdin payload.

`failClosed` on the shell hook means a crash blocks the command. The script is the check that hook bypasses do not slip through while the hook is broken.

The stop hook prefers `package.json` `"gate"` (bun, pnpm, yarn, then npm, based on the lockfile) and otherwise runs the bundled `gate.mjs`.

## Steiger

[Steiger](https://github.com/feature-sliced/steiger) is the official checker. Turn it on after it is installed:

```json
{ "steiger": true }
```

The gate runs `npx --no-install steiger src`. A missing binary fails the gate with an install note. It does not run `npm install`.

## Budget

`size-budget.mjs` counts `.ts`, `.tsx`, `.js`, `.jsx`, `.css`, and `.scss` files, and their non-blank lines, under `src` (or `--src`). On an existing app, set `maxFiles` and `maxLines` to the current counts so the gate is green, then lower them when a cleanup is the task. The validator's per-file cap is `maxFileLines`.

Print the counts with `node <skill>/scripts/size-budget.mjs` before choosing numbers.

## Self-check

`node skills/feature-sliced-design/scripts/self-check.mjs` from this repo builds temporary trees and checks validate, scaffold, the gate, the size budget, the shell guard, and the stop hook. Run it after editing the scripts.
