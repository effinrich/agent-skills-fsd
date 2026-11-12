# agent-skills-fsd

Portable Feature-Sliced Design skill, plus the project files that make an agent stay on that path: a gate, a stop hook, and a shell guard.

This is the sliced sibling of [agent-skills](https://github.com/effinrich/agent-skills). That repo uses feature folders (`src/features/<feature>/<component>/`). This one uses [Feature-Sliced Design](https://feature-sliced.design/): layers, slices, segments, and a public API. The two are not interchangeable.

## Install the skill (global, so agents can read it)

From this folder, before the repo is on GitHub:

```
npx skills add D:\documents-from-c\GitHub\agent-skills-fsd --skill feature-sliced-design -g -a cursor -a claude-code -a codex -a windsurf -y
```

That installs to `~/.agents/skills/feature-sliced-design/`.

## Adopt it in a project

The gate can only run files that live in the project. Copy the skill in, then copy the workflow template.

1. Copy `skills/feature-sliced-design` to `<project>/.agents/skills/feature-sliced-design`.
2. Copy the contents of `templates/agent-workflow/` into the project root. If `.cursor/hooks.json` or `.claude/settings.json` already exists, merge the hook entries instead of replacing the file.
3. Fill in every `<...>` in `AGENTS.md` and `.cursor/rules/10-project-context.mdc` (and the matching Windsurf file).
4. Add a gate script: `"gate": "node .agents/skills/feature-sliced-design/scripts/gate.mjs"`.
5. Set `maxFiles` and `maxLines` in `fsd.gate.json`. On an existing app, set them to today's counts. Raising them later is a user decision. Put folders that are not on Feature-Sliced yet in `ignore`.
6. Wire `lefthook.yml` (or the same command in husky) and keep `.github/workflows/gate.yml` required on the default branch.

`node .agents/skills/feature-sliced-design/scripts/gate.mjs` is the check. It fails when a layer, a public import, a file size, or the tree budget is wrong. The stop hook runs it before an agent finishes. The shell guard refuses `git commit --no-verify` and the other hook bypasses.

## Layout

```
skills/feature-sliced-design/     SKILL.md, REFERENCE.md, scripts/
templates/agent-workflow/         AGENTS.md, rules, hooks, fsd.gate.json, CI
```

Check the scripts after a change:

```
node skills/feature-sliced-design/scripts/self-check.mjs
```
