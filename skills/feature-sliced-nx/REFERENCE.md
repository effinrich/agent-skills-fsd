# Feature-Sliced Nx — Reference

Current Nx facts this skill relies on, and the edges the generator does not decide.

## Generator options that moved

`@nx/react:library` requires `directory` (argv index 0). That directory is the project root, for example `libs/catalog/features/product-card`. Pass `name` when the project name is not the last folder (`catalog-features-product-card`). `projectNameAndRootFormat` is not in the schema; passing it fails on current Nx.

`bundler` defaults to `none`. `component` defaults to `true` and would drop an extra component in `src/lib/`, so the slice generator sets `component: false` and deletes a leftover `${fileName}.tsx` if one appears. `linter` is omitted on purpose: the schema says it defaults to the linter the workspace already uses (`eslint` or `oxlint`).

`libraryGenerator` may return a callback that installs packages after the tree is written. The slice generator collects that callback, and the one from `storybookConfigurationGenerator`, and runs them after `formatFiles`. Dropping the return value skips those installs.

`storybookConfigurationGenerator` requires `project`. `generateStories`, `interactionTests`, and `configureStaticServe` all default to `true`. The generator passes them explicitly. Storybook v10 is what `@nx/react:storybook-configuration` sets up.

Before editing flags in a repo, run `nx g @nx/react:library --help` and `nx g @nx/react:storybook-configuration --help`. The installed schema wins over this file.

## Registering the generator

```
nx g @nx/plugin:generator tools/<plugin>/src/generators/fsd-slice --name=fsd-slice
```

Replace the generated `generator.ts` and `schema.json` with the copies in this skill. `generators.json` in the plugin needs:

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

The `nx g` name is the `name` in that plugin's `package.json`, not a guessed `@my-workspace/internal-plugin`.

## Boundaries

`boundaries/dep-constraints.mjs` is the layer list. Same-layer imports fail because the source layer is absent from `onlyDependOnLibsWithTags`. `shared` may depend on `shared`.

Projects with no tags cannot depend on tagged projects. Tag the app `fsd:layer:app` or its imports of page libraries fail.

Domain rules are not generated from a glob. `sourceTag: "fsd:domain:*"` with `onlyDependOnLibsWithTags: ["fsd:domain:*"]` would allow every domain to import every other domain. Add one constraint per domain instead.

Oxlint uses the same constraint objects under `@nx/enforce-module-boundaries` with `jsPlugins: ["@nx/oxlint/boundaries-plugin"]`. Nx marks that Oxlint API experimental.

## Storybook host

Per-slice Storybook is the cached path: `nx affected -t build-storybook,test-storybook` only rebuilds slices whose stories changed.

A host is for browsing. Create one library, point it at the other Storybooks with [Storybook composition](https://nx.dev/docs/technologies/test-tools/storybook/guides/storybook-composition-setup), and leave the per-slice targets in place. One host that globs every story file into a single build drops the per-project cache the slice targets exist to provide.

## Inside the library

`src/index.ts` is rewritten after Storybook generation so a story file cannot become part of the public API. Segment files are an in-project convention. The boundary rule will not catch `fetch` inside `ui`. When a slice grows past one component, split files the way the agnostic skill describes (one component per file, kebab-case, effects in `model`, requests in `api`) without turning those folders into extra Nx projects.

## Agnostic skill

`feature-sliced-design` validates `src/{app,pages,widgets,features,entities,shared}`. Pointing it at `libs/` reports unknown folders. An Nx app that renders a page should import the page library. It should not grow a second Feature-Sliced tree under `apps/<app>/src`.
