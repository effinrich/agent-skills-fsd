# agent-skills-fsd

Portable Feature-Sliced Design skill, plus the project files that make an agent stay on that path: a gate, a stop hook, and a shell guard.

This is the sliced sibling of [agent-skills](https://github.com/effinrich/agent-skills). That repo uses feature folders (`src/features/<feature>/<component>/`). This one uses [Feature-Sliced Design](https://feature-sliced.design/): layers, slices, segments, and a public API. The two are not interchangeable.

## Install the skill (global, so agents can read it)

Agnostic, one `src/` tree:

```
npx skills add effinrich/agent-skills-fsd --skill feature-sliced-design -g -a cursor -a claude-code -a codex -a windsurf -y
```

Nx workspace, one library per slice:

```
npx skills add effinrich/agent-skills-fsd --skill feature-sliced-nx -g -a cursor -a claude-code -a codex -a windsurf -y
```

Those install to `~/.agents/skills/feature-sliced-design/` and `~/.agents/skills/feature-sliced-nx/`. Use the agnostic skill when the repo has no `nx.json`. Use the Nx skill when it does.

## Adopt it in a project

The agnostic gate can only run files that live in the project. Copy the skill in, then copy the workflow template. For an Nx workspace, follow `skills/feature-sliced-nx/SKILL.md` instead of the steps below.

1. Copy `skills/feature-sliced-design` to `<project>/.agents/skills/feature-sliced-design`.
2. Copy the contents of `templates/agent-workflow/` into the project root. If `.cursor/hooks.json` or `.claude/settings.json` already exists, merge the hook entries instead of replacing the file.
3. Fill in every `<...>` in `AGENTS.md` and `.cursor/rules/10-project-context.mdc` (and the matching Windsurf file).
4. Add a gate script: `"gate": "node .agents/skills/feature-sliced-design/scripts/gate.mjs"`.
5. Set `maxFiles` and `maxLines` in `fsd.gate.json`. On an existing app, set them to today's counts. Raising them later is a user decision. Put folders that are not on Feature-Sliced yet in `ignore`.
6. Wire `lefthook.yml` (or the same command in husky) and keep `.github/workflows/gate.yml` required on the default branch.

`node .agents/skills/feature-sliced-design/scripts/gate.mjs` is the check. It fails when a layer, a public import, a file size, or the tree budget is wrong. The stop hook runs it before an agent finishes. The shell guard refuses `git commit --no-verify` and the other hook bypasses.

## Layout

```
skills/feature-sliced-design/     Agnostic src/ layout, gate, hooks
skills/feature-sliced-nx/         Nx library-per-slice, tags, Storybook
templates/agent-workflow/         AGENTS.md, rules, hooks, fsd.gate.json, CI
```

Check the scripts after a change:

```
node skills/feature-sliced-design/scripts/self-check.mjs
```
