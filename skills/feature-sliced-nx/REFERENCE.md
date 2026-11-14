# Feature-Sliced Nx — Reference

Current Nx facts this skill relies on, and the edges the generator does not decide.

## Generator options that moved

`@nx/react:library` requires `directory` (argv index 0). That directory is the project root, for example `libs/catalog/features/product-card`. Pass `name` when the project name is not the last folder (`catalog-features-product-card`). `projectNameAndRootFormat` is not in the schema; passing it fails on current Nx.

`bundler` defaults to `none`. `component` defaults to `true` and would drop an extra component in `src/lib/`, so the slice generator sets `component: false` and deletes a leftover `${fileName}.tsx` if one appears. `linter` is omitted on purpose: the schema says it defaults to the linter the workspace already uses (`eslint` or `oxlint`).

`libraryGenerator` may return a callback that installs packages after the tree is written. The slice generator collects that callback, and the one from `storybookConfigurationGenerator`, and runs them after `formatFiles`. Dropping the return value skips those installs.

`storybookConfigurationGenerator` requires `project`. `generateStories`, `interactionTests`, and `configureStaticServe` all default to `true`. The generator passes them explicitly. Storybook v10 is what `@nx/react:storybook-configuration` sets up.

Before editing flags in a repo, run `nx g @nx/react:library --help` and `nx g @nx/react:storybook-configuration --help`. The installed schema wins over this file.

## What the generator automates

When a developer runs `fsd-slice`, the script:

1. Maps the slice to `libs/<domain>/<layer>/<name>` and the project name `<domain>-<layer>-<name>`.
2. Injects `fsd:layer:<layer>` and `fsd:domain:<domain>` on the new library so module boundaries stay enforceable.
3. Delegates core scaffolding to the native Nx React library generator (`bundler: 'none'`).
4. Force-scaffolds the FSD segments under `src/lib/` (`ui` with a starter component, empty `model` and `api`).
5. Writes a strict public API in `src/index.ts` (component + props only; stories never exported).
6. Optionally adds a per-slice Storybook target when `--storybook=true`.

Copy `generators/fsd-slice/generator.ts` and `schema.json` from this skill. Do not paste older drafts that use `@nx/js`, `projectNameAndRootFormat`, empty `ui/.gitkeep` only, or `export * from './lib/model'` as the public API.

## How to add and run the generator

1. Initialize a local plugin if the workspace does not have one yet:

```
nx g @nx/plugin:plugin internal-plugin --directory=tools/internal-plugin
```

2. Generate the generator file structure:

```
nx g @nx/plugin:generator fsd-slice --project=internal-plugin
```

Or, if the plugin path is already known:

```
nx g @nx/plugin:generator tools/internal-plugin/src/generators/fsd-slice --name=fsd-slice
```

3. Overwrite `tools/internal-plugin/src/generators/fsd-slice/generator.ts` and `schema.json` with the copies in this skill's `generators/fsd-slice/` folder. Point `generators.json` at them:

```json
{
  "generators": {
    "fsd-slice": {
      "factory": "./src/generators/fsd-slice/generator",
      "schema": "./src/generators/fsd-slice/schema.json",
      "description": "Generate an FSD slice library"
    }
  }
}
```

4. Run it to create a pre-tagged slice:

```
nx g @<scope>/internal-plugin:fsd-slice product-card --domain=catalog --layer=features
nx g @<scope>/internal-plugin:fsd-slice product-card --domain=catalog --layer=features --storybook=true
```

The `nx g` package name is the `name` in that plugin's `package.json`, not a guessed `@my-workspace/internal-plugin`. Confirm with the plugin's `package.json` before documenting the command for a repo.

### Storybook and Playwright

Storybook is supported: pass `--storybook=true` (after `nx add @nx/storybook` once). That keeps Storybook on the slice so `nx affected -t build-storybook,test-storybook` can cache. A workspace host is separate and optional.

Playwright E2E is not part of `fsd-slice`. E2E stays at the app or workspace level; a slice library is the wrong home for browser journeys. Wire Playwright with the workspace's existing e2e project generator when the task asks for it.

## Domain-first layout (default)

This skill uses **domain-first** for business code and keeps shared primitives under `libs/shared/`:

```
apps/
  web/                         Tag fsd:layer:app
libs/
  shared/
    shared/ui/                 Kit, zero business rules
    shared/api/                Base client
    shared/kernel/             Optional: DTOs / contracts only (see Shared kernel)
  catalog/
    entities/product/
    features/add-to-cart/
    pages/catalog-home/
  account/
    entities/user/
    features/login/
```

**Layer-first** (`libs/features/...`, `libs/entities/...`) fits a single tight app. Prefer domain-first when more than one app shares domains, or when domains must not import each other. Cross-domain composition happens in a page, the app, or (rarely) a widget — not by letting `catalog` import `account` directly.

## Boundaries

`boundaries/dep-constraints.mjs` is the layer list. Same-layer imports fail because the source layer is absent from `onlyDependOnLibsWithTags`. `shared` may depend on `shared`.

Projects with no tags cannot depend on tagged projects. Tag the app `fsd:layer:app` or its imports of page libraries fail.

Domain rules are not generated from a glob. `sourceTag: "fsd:domain:*"` with `onlyDependOnLibsWithTags: ["fsd:domain:*"]` would allow every domain to import every other domain. Add one constraint per domain instead.

Oxlint uses the same constraint objects under `@nx/enforce-module-boundaries` with `jsPlugins: ["@nx/oxlint/boundaries-plugin"]`. Nx marks that Oxlint API experimental.

### Legacy escape hatch

When adapting an existing monorepo, tag untouched libraries `legacy-code` and add:

```js
{ sourceTag: 'legacy-code', onlyDependOnLibsWithTags: ['legacy-code', 'fsd:layer:shared', 'fsd:layer:entities'] }
```

New work uses `fsd-slice` and FSD tags. Touched legacy code moves into FSD libraries over time (strangulation). Do not write new features under `legacy-code`.

### Shared kernel

Domains must not import each other. Structural contracts that both need (API DTOs, shared TypeScript types with no behavior) go in `libs/shared/shared/kernel` tagged `fsd:layer:shared,fsd:domain:shared`. No React, no fetches, no domain rules — types and constants only. If it has behavior, it is not a kernel; put it in an entity or a feature.

## Storybook host

Per-slice Storybook is the cached path: `nx affected -t build-storybook,test-storybook` only rebuilds slices whose stories changed.

A host is for browsing. Create one library, point it at the other Storybooks with [Storybook composition](https://nx.dev/docs/technologies/test-tools/storybook/guides/storybook-composition-setup), and leave the per-slice targets in place. One host that globs every story file into a single build drops the per-project cache the slice targets exist to provide.

## Inside the library

`src/index.ts` is rewritten after Storybook generation so a story file cannot become part of the public API. Tag lint cannot see one file inside a library importing another. `validate-segments.mjs` checks that part: effects and server state in `model`, `fetch` in `api`, React out of `api`, `lib`, and `config`, one component per file, kebab-case. Splitting a component stays inside the library. It does not become a new Nx project until a second slice needs it.

Shared slices use the same three folders as every other slice: `libs/shared/shared/<slice>`. `libs/shared/ui/<button>` skips the layer folder, and the segment gate rejects it.

## Placement

The skill uses pages-first extraction: keep code in the page library until reuse is real, the boundary has its own reason to change, and the responsibility is focused. `widgets` stays in the generator enum and in the boundary allow-lists so existing widget libraries keep working, but new work should prefer the app, a page, a feature, or shared before opening a widget library.

Same-layer feature imports: merge, move shared responsibility down, compose from a page or the app, or last-resort public-API import. `@x` is entities-only.

There is no `processes` layer. FSD v2.1 deprecated it.

## Why FSD over flat feature folders in Nx

A flat `features/` tree plus a custom boundary map (which feature may import which) drifts as the graph grows. FSD + Nx tags keep one static rule: import only downward by layer, and only within a domain (or via `shared`). Linters enforce the rule; FSD supplies what the rule means. Feature-based architecture remains valid for smaller apps; this skill is for workspaces that want that static map and AI-predictable placement.

## CI and affected

Prefer `nx affected -t lint,test,build` with `NX_BASE` (CI: the merge base against the default branch). The gate already runs affected lint when `nx.json` and a base exist. Do not default to `nx run-many` for every PR when a base is available — that drops the cache benefit that per-slice libraries exist to provide.

## Cursor / AGENTS rule snippets

Copy into the project's `AGENTS.md` Learned Preferences (and keep `.cursor/rules/20-frontend.mdc` in sync):

```markdown
- Prioritize small, readable files: `ui` is markup plus wiring; types, hooks, consts, and helpers go in their segments (`model`, `config`, `lib`), not in the component file.
- Segment files are unprefixed role or concept names (`types.ts`, `hooks.ts`), never `task-list.types.ts`.
- Name a page or slice after the route or capability (`pages/focus` + `ui/focus.tsx`), not a descriptive variant like `focus-radar-modal`.
```

Copy into `AGENTS.md` / `.cursor/rules/10-project-context.mdc` for layout and migration:

```markdown
- Domain-first: `libs/<domain>/<layer>/<slice>`. Shared kit under `libs/shared/`. Layer-first only for a single tight app.
- Tag untouched libraries `legacy-code` and add the boundary escape hatch from `boundaries/dep-constraints.mjs`. New work uses `fsd-slice`.
- Cross-domain DTOs with no behavior: `libs/shared/shared/kernel` (`fsd:layer:shared`, `fsd:domain:shared`).
```

The templates under `templates/agent-workflow-nx/` already include these.

## Agnostic skill

`feature-sliced-design` validates `src/{app,pages,widgets,features,entities,shared}`. Pointing it at `libs/` reports unknown folders. An Nx app that renders a page should import the page library. It should not grow a second Feature-Sliced tree under `apps/<app>/src`.
