---
name: feature-sliced-nx
description: Feature-Sliced Design for an Nx workspace. Each slice is a React library under libs/<domain>/<layer>/<slice>, tagged fsd:layer and fsd:domain, with the public API in src/index.ts and module-boundary lint as the gate. Use when the repo has nx.json and the task creates, moves, or imports a slice, adds Storybook to a slice, or wires @nx/enforce-module-boundaries. Do not use the agnostic feature-sliced-design src/ layout in an Nx workspace.
---

# Feature-Sliced Design on Nx

One slice is one Nx library. The app is an Nx application, not a slice. Tags and `@nx/enforce-module-boundaries` are the gate. The agnostic `feature-sliced-design` skill, with its single `src/` tree and `validate.mjs`, is the other path. If `nx.json` exists, this skill is the one to follow.

Methodology: [Feature-Sliced Design](https://feature-sliced.design/). Generator options match current `@nx/react:library` and `@nx/react:storybook-configuration` (directory is the project root; `projectNameAndRootFormat` is gone). Confirm with `nx g @nx/react:library --help` in the workspace before changing flags.

## Layout

```
apps/<app>/                         Tag fsd:layer:app. Routes re-export page libraries.
libs/<domain>/<layer>/<slice>/
  src/index.ts                      The only import path other projects may use.
  src/lib/ui/<slice>.tsx            Component. Stories sit beside it and are not exported.
  src/lib/model/                    State, schemas, hooks.
  src/lib/api/                      Requests. No React.
```

Layers, top to bottom: `app`, `pages`, `widgets`, `features`, `entities`, `shared`. A project may depend on a layer strictly below its own. Two pages do not import each other. Two features do not import each other. A domain may depend on itself and on `fsd:domain:shared`.

| Place | Nx home |
| --- | --- |
| Route screen | `libs/<domain>/pages/<slice>` |
| Block reused by several pages | `libs/<domain>/widgets/<slice>` |
| One user action | `libs/<domain>/features/<slice>` |
| Business noun | `libs/<domain>/entities/<slice>` |
| No business meaning | `libs/shared/<segment-or-slice>` with layer `shared` |
| Providers, router, shell | the app in `apps/` |

## Generate a slice

Copy `generators/fsd-slice/` into the workspace plugin (`tools/<plugin>/src/generators/fsd-slice/`) and point `generators.json` at it. Then:

```
nx g @<scope>/<plugin>:fsd-slice product-card --domain=catalog --layer=features
nx g @<scope>/<plugin>:fsd-slice product-card --domain=catalog --layer=features --storybook=true
```

The generator calls `@nx/react:library` with `directory`, `name`, `tags`, `bundler: 'none'`, `component: false`, and the workspace unit-test runner (`--unitTestRunner=jest` when the repo already uses Jest; otherwise Vitest). It does not pass a linter, so an Oxlint workspace stays on Oxlint. `bundler: 'none'` keeps the slice as source. A Vite or Rollup build is a separate choice for a library that is published, not the default for an in-repo slice.

It writes `ui`, `model`, and `api`, then overwrites `src/index.ts` so the public API is the component and its props type. Delete a segment that stays empty.

Other projects import `@<scope>/catalog-features-product-card`. They do not import `libs/.../src/lib/ui/product-card`.

## Storybook

`--storybook=true` adds a Storybook target on that slice only: `.storybook/` inside the library, a CSF3 story next to the component, interaction tests, and static serve. Stories are not exported from `index.ts`, so they stay out of the app bundle.

That is the default. Per-slice targets are what `nx affected -t build-storybook,test-storybook` can cache. A workspace host that aggregates every slice is a separate library, created only when someone asks for one URL to browse them all. Use Storybook composition for that host. Do not generate the host from `fsd-slice`, and do not replace the per-slice targets with it.

Prerequisite, once per workspace, before the first `--storybook=true` run: `nx add @nx/storybook`. `@nx/react` is already required for the library generator.

```
nx storybook catalog-features-product-card
nx test-storybook catalog-features-product-card
```

## The gate

Add `boundaries/dep-constraints.mjs` to the existing `@nx/enforce-module-boundaries` rule (ESLint flat config or the Oxlint boundaries plugin). Tag the app `fsd:layer:app`. Each new domain gets one `fsd:domain:<name>` constraint that allows itself and `fsd:domain:shared`.

A slice that imports sideways fails lint. Raising the rule to `warn`, adding the project to `allow`, or tagging a library with a higher layer to make an import pass is a user decision.

Inside one library the tag rule cannot see `ui` importing `api`. Keep segments in their roles anyway: effects and server state in `model`, `fetch` in `api`, React out of `api`.

Done for a slice change means the workspace lint (and the storybook targets, when this change touched them) passed, and the reply names the command. Prefer `nx affected` over `nx run-many` when a base exists.

## What not to do

- Do not create `src/features/` or `src/pages/` in an app that should be importing libraries.
- Do not hand-roll a library folder. Use the generator, or `nx g @nx/react:library` with the same directory, name, and tags.
- Do not add `projectNameAndRootFormat`.
- Do not install packages the task did not ask for. `--storybook=true` is the ask for the Storybook dependency.
