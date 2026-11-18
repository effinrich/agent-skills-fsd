---
name: feature-sliced-nx
description: Feature-Sliced Design for an Nx workspace. Each slice is a React library under libs/<domain>/<layer>/<slice>, generated with fsd-slice (wraps @nx/react:library), tagged fsd:layer and fsd:domain, with pages-first placement and widgets discouraged. Use when the repo has nx.json and the task creates, moves, splits, or imports a slice, decides where code belongs, refactors an existing app onto these libraries, adds Storybook, or wires the harness. Do not use the agnostic feature-sliced-design src/ layout in an Nx workspace.
---

# Feature-Sliced Design on Nx

One slice is one Nx library. The app is an Nx application, not a slice. This skill ships one generator: `fsd-slice`, which wraps `@nx/react:library` and optional `@nx/react:storybook-configuration`. It does not generate apps. Create or keep the app with the workspace's normal `@nx/react:application` (or equivalent), then tag it `fsd:layer:app`. Tags and `@nx/enforce-module-boundaries` keep imports on the layer rule. A segment gate checks what tags cannot see inside one library: `ui` stays markup, `fetch` stays in `api`. The agnostic `feature-sliced-design` skill is the other path. If `nx.json` exists, this skill is the one to follow. Do not run that skill's `validate.mjs` on `libs/`.

Methodology: [Feature-Sliced Design](https://feature-sliced.design/). Generator options match current `@nx/react:library` and `@nx/react:storybook-configuration` (`directory` is the project root; `projectNameAndRootFormat` is gone). Confirm with `nx g @nx/react:library --help` in the workspace before changing flags.

## Scope

This skill owns the Feature-Sliced pattern, the slice generator, and the harness that enforces them. It does not own workspace tooling.

- It does not create an Nx workspace. Use `create-nx-workspace` first, or `nx init` for a repo that already has one, then install this skill.
- It does not convert a non-Nx app into an Nx workspace. That is a one-time migration done with Nx's own commands. This skill governs the result.
- It does not generate the application. `nx g @nx/react:application` does that; tag the result `fsd:layer:app`.

Migrating an existing app onto the FSD libraries is in scope, one slice at a time. See [Refactoring an existing app](#refactoring-an-existing-app).

Use Nx's public CLI and generator APIs only. Do not read Nx's file layout or its internal types. Resolve the CLI through the installed package's `bin` field rather than a hardcoded path, so the gate keeps working when Nx moves it.

Last verified against Nx 24.0.6 on 2026-11-18, in an Nx workspace using this skill.

## Layout
```
apps/<app>/                         Tag fsd:layer:app. Routes re-export page libraries.
libs/<domain>/<layer>/<slice>/
  project.json                      Tags fsd:layer:<layer>, fsd:domain:<domain>.
  src/index.ts                      The only import path other projects may use.
  src/lib/ui/<slice>.tsx            Component. Stories sit beside it and are not exported.
  src/lib/model/                    State, schemas, hooks.
  src/lib/api/                      Requests. No React.
  src/lib/lib/                      Pure helpers. No React.
  src/lib/config/                   Flags and fixed values. No React.
```

Layers, top to bottom: `app`, `pages`, `widgets`, `features`, `entities`, `shared`. A project may depend on a layer strictly below its own. Two pages do not import each other. Two features do not import each other. A domain may depend on itself and on `fsd:domain:shared`. Shared code is `libs/shared/shared/<slice>`, because the layer folder is always present.

Not every layer is required. Start with the app plus page libraries and shared libraries. Add features or entities only when the [extraction rule](#extraction-rule) holds. `widgets` is discouraged: prefer app shell in the app, page-local composition, features for reused actions, and `shared` for kit UI. Open a widget library only for a true shared composition that is none of those.

| Place | Nx home |
| --- | --- |
| Route screen | `libs/<domain>/pages/<slice>` |
| Reused user action | `libs/<domain>/features/<slice>` |
| Business noun | `libs/<domain>/entities/<slice>` |
| No business rules | `libs/shared/shared/<slice>` |
| Providers, router, app shell | the app in `apps/` |
| True shared UI composition (rare) | `libs/<domain>/widgets/<slice>` |

## Where code goes

| Code | Segment |
| --- | --- |
| Component, markup, local UI state | `ui` |
| `useEffect`, `useQuery`, stores, schemas, types | `model` |
| `fetch`, `axios`, request functions | `api` |
| Pure helpers | `lib` |
| Constants and flags | `config` |

`ui` is markup plus wiring: one component per file, kebab-case, named after the component. A component with partials uses `ui/<component>/<component>.tsx` and `partials/`. A single component with no partials may be `ui/<component>.tsx`. Types and hooks go in `model`, consts in `config`, helpers in `lib`, network in `api`. Segment files are role- or concept-named (`types.ts`, `hooks.ts`), never prefixed with the slice (`product-card.types.ts`). Name a page or slice after the route or capability (`pages/focus` + `ui/focus.tsx`), not a UI variant (`focus-radar-modal`). Effects and server-state hooks (`useEffect`, `useQuery`, `useMutation`) live only in `model`. `fetch` and `axios` live only in `api`. `api`, `lib`, and `config` do not import React. Files stay at or under `maxFileLines` in `fsd.nx.json` (starter 200). Tests and stories sit next to the file they cover and are exempt from the line cap.

Other projects import `@<scope>/catalog-features-product-card`. They do not import `libs/.../src/lib/ui/product-card`.

## Extraction rule

Place code in the page library first. Duplication across pages is allowed. Extract (or generate a new library) only when all three hold:

1. The same code is used in multiple places right now, not hypothetically.
2. It has a reason to change that is independent of any one consumer.
3. The boundary has a focused responsibility.

When in doubt, keep it in the page library.

## Choosing a layer

1. Used by only one page → stay in that page library (UI, request, and state).
2. Used in several pages but the copies may drift → separate page-local copies are valid.
3. Reusable infrastructure with no product rule → `libs/shared/shared/<slice>` (UI kit, util, API client, auth tokens, plain shared CRUD).
4. A complete user action several consumers share, with its own reason to change → `features`.
5. A business domain model several consumers share, with its own reason to change → `entities`.
6. App-wide providers, router, theme, or shell → the app project.
7. A true shared UI composition that is none of the above → `widgets` (rare; ask before generating).

| Scenario | Single use | Extraction rule holds |
| --- | --- | --- |
| Profile form | page library `ui/` | `features` library |
| API request | page library `api/` | `shared` when plain and shared; entity `api/` only when that entity owns the domain |
| Auth token / session | `libs/shared/shared/auth` (or api) | Same. Do not invent a user entity for the token |
| App header | — | Compose in the app, not a widget library by default |

Same-layer need between feature libraries: merge, move shared responsibility down, compose from a page/app, or last-resort public-API import. `@x` is entities-only.

## Generate a slice

The local generator calculates the nested directory, scaffolds `ui` / `model` / `api`, and appends `fsd:layer:*` and `fsd:domain:*` on the new library. Setup once:

```
nx g @nx/plugin:plugin internal-plugin --directory=tools/internal-plugin
nx g @nx/plugin:generator fsd-slice --project=internal-plugin
```

Overwrite `tools/internal-plugin/src/generators/fsd-slice/generator.ts` and `schema.json` with this skill's `generators/fsd-slice/` copies (not older `@nx/js` drafts). Then:

```
nx g @<scope>/internal-plugin:fsd-slice product-card --domain=catalog --layer=features
nx g @<scope>/internal-plugin:fsd-slice product-card --domain=catalog --layer=features --storybook=true
```

The generator calls `@nx/react:library` with `directory`, `name`, `tags`, `bundler: 'none'`, `component: false`, and the workspace unit-test runner (`--unitTestRunner=jest` when the repo already uses Jest; otherwise Vitest). It does not pass a linter, so an Oxlint workspace stays on Oxlint. `bundler: 'none'` keeps the slice as source. A Vite or Rollup build is a separate choice for a library that is published, not the default for an in-repo slice.

It writes a starter `ui` component plus empty `model` and `api`, then overwrites `src/index.ts` so the public API is the component and its props type. Delete a segment that stays empty. Full registration notes and the Storybook vs Playwright split: [REFERENCE.md](REFERENCE.md).

## Storybook

`--storybook=true` adds a Storybook target on that slice only: `.storybook/` inside the library, a CSF3 story next to the component, interaction tests, and static serve. Stories are not exported from `index.ts`, so they stay out of the app bundle.

That is the default. Per-slice targets are what `nx affected -t build-storybook,test-storybook` can cache. A workspace host that aggregates every slice is a separate library, created only when someone asks for one URL to browse them all. Use Storybook composition for that host. Do not generate the host from `fsd-slice`, and do not replace the per-slice targets with it.

Prerequisite, once per workspace, before the first `--storybook=true` run: `nx add @nx/storybook`. `@nx/react` is already required for the library generator.

```
nx storybook catalog-features-product-card
nx test-storybook catalog-features-product-card
```

## Splitting a large component

Move code as-is. Renames and logic rewrites belong in a separate change.

1. The component is not a library yet? Generate the slice, then move the file into `src/lib/ui/`. Update importers to the package name. Do not create `src/features/` or `src/pages/` in the app, and do not hand-roll `project.json`.
2. Types a hook or a second file needs -> `src/lib/model/`.
3. Constants -> `src/lib/config/`.
4. Pure helpers -> `src/lib/lib/`.
5. State, effects, and server state -> `src/lib/model/`.
6. `fetch` / `axios` -> `src/lib/api/`.
7. Each commented JSX section -> `src/lib/ui/<component>/partials/<part>.tsx`. The partial is named after its component.
8. `src/index.ts` exports the component and the types other projects may use. Stories stay unexported.
9. A second component in the same library: `nx g @nx/react:component libs/<domain>/<layer>/<slice>/src/lib/ui/<name>/<name>`. Add `--export` only when other projects import it.
10. Update every doc that names a moved path (README, agent files, rule folders) in the same change.
11. Run the gate. Name the command and the result.

## Refactoring an existing app

Migrate the file you touch. Everything else stays. Prefer domain-first `libs/<domain>/<layer>/<slice>` (see [REFERENCE.md](REFERENCE.md)).

1. Wire `@nx/enforce-module-boundaries` from `boundaries/dep-constraints.mjs`. Tag existing libraries `legacy-code` and add the legacy escape hatch so old code can keep talking to itself while FSD layers stay clean.
2. Touching a file that breaks these rules? Generate the slice with `fsd-slice`, move the code in, update importers to the package name. Do not grow new work under `legacy-code`.
3. Untouched files keep their place. Report them. Do not fix them in this change.
4. Finish one slice before starting the next. Moves across many slices need the user's go-ahead.
5. Run the gate for the slices you migrated. A violation in a library you did not touch is a report, not a drive-by fix.
6. Libraries that are not moved yet sit in `fsd.nx.json` `ignore` for the segment gate. At adoption, with the user's go-ahead, `validate-segments.mjs --baseline` adds every failing library once; show the user the list. Remove an entry when its library becomes a slice. Do not ignore code you just wrote, and do not re-run `--baseline` to hide a new failure. Do not raise `maxFileLines`, retag a library upward, or set the boundary rule to `warn` to clear a failure. Ask the user.

From a feature-folder app (`src/features/<feature>/<component>/{types,consts,hooks,utils,api}.ts`): a screen becomes a page library and stays page-local until the extraction rule holds; a shared user action becomes a feature library; app shell stays in the app; `types.ts` and `hooks.ts` go to `model`, `consts.ts` to `config`, `utils.ts` to `lib`, `api.ts` to that consumer's `api/` (or `shared` when plain and shared); `partials/` stays under `ui/<component>/partials/`. Cross-domain DTOs with no behavior go in `libs/shared/shared/kernel`.

## New project

1. Create the app with the workspace React application generator (`nx g @nx/react:application` or the workspace equivalent). Tag it `fsd:layer:app`. It imports libraries. It does not grow a second Feature-Sliced tree.
2. Generate each earned slice with `fsd-slice` (library only). Prefer pages, features, entities, and shared over widgets. Delete stub segments the slice does not use.
3. Copy `templates/agent-workflow-nx/` from this skill's repo into the project and fill in the placeholders. Vendor this skill at `.agents/skills/feature-sliced-nx` so the gate and the hooks resolve.
4. Add `"gate": "node .agents/skills/feature-sliced-nx/scripts/gate.mjs"` to `package.json`.
5. Paste `boundaries/dep-constraints.mjs` into the existing module-boundary rule, and add one domain constraint per domain.

## The gate

`node .agents/skills/feature-sliced-nx/scripts/gate.mjs` runs, in order:

1. `validate-segments.mjs` — path `libs/<domain>/<layer>/<slice>`, tags, public `src/index.ts`, segment names, kebab-case, one component per file, component folders named after their file, effects only in `model`, network only in `api`, inline `any` without a lint-disable comment, per-file line cap.
2. `nx affected -t lint` when `nx.json` exists and a base exists (`NX_BASE`, otherwise `origin/main`). That is the layer rule. This skills repo has no `nx.json`, so the segment check is the whole gate there.

| Checkpoint | Mechanism |
| --- | --- |
| Agent turn ends | `.cursor/hooks.json` stop hook runs `scripts/stop-gate.mjs`. A dirty tree that fails the gate is sent back, up to 3 times. A clean tree skips the gate. |
| Every shell call | `scripts/shell-guard.mjs` denies `--no-verify`, `git commit -n`, `LEFTHOOK=0`, `HUSKY=0`, and `core.hooksPath`. |
| Commit and push | `lefthook.yml` runs the gate. |
| Pull request | `.github/workflows/gate.yml` runs the gate with `NX_BASE` set. Branch protection should require it. |

Done for a slice change means this gate passed, and the reply names the command. When the change touched Storybook, `nx affected -t build-storybook,test-storybook` passed too. Prefer `nx affected` over `nx run-many` when a base exists.

## Exposing the rules to agents

The project states these rules once per tool, with the same meaning everywhere. The files are `templates/agent-workflow-nx/`:

```
AGENTS.md                  Canonical short file: points at this skill.
CLAUDE.md                  One line: @AGENTS.md
.cursor/rules/             .mdc with frontmatter
  00-core-principles.mdc   10-project-context.mdc   20-frontend.mdc   30-testing.mdc
.windsurf/rules/           Same four topics, Windsurf trigger frontmatter
```

Edit a rule in every copy in the same change. This skill stays the long form.

## What not to do

- Do not create `src/features/` or `src/pages/` in an app that should be importing libraries.
- Do not hand-roll a library folder. Use the generator, or `nx g @nx/react:library` with the same directory, name, and tags, then move the existing files in.
- Do not add `projectNameAndRootFormat`.
- Do not install packages the task did not ask for. `--storybook=true` is the ask for the Storybook dependency.
- Do not point `feature-sliced-design` `validate.mjs` at `libs/`.

## Scripts

Run from the workspace root. Hooks and CI use the vendored path `.agents/skills/feature-sliced-nx`.

- `validate-segments.mjs` — exits 0 when slice libraries match this skill, 1 on violations, 2 when `libs/` is missing. `--baseline` writes failing libraries into `fsd.nx.json` `ignore` (adoption only, on the user's go-ahead).
- `gate.mjs` — segment check, then `nx affected -t lint` when `nx.json` is present.
- `stop-gate.mjs` — Cursor and Claude Code stop hook.
- `shell-guard.mjs` — Cursor and Claude Code shell hook.
- `self-check.mjs` — runs the segment checks against a temporary tree. Use it when changing these scripts. It does not run Nx.

Boundaries, generator flags, and Storybook composition: [REFERENCE.md](REFERENCE.md).
