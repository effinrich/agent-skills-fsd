---
trigger: always_on
description: What this repo is. Apps, slices, and the gate command.
---

# Project context: <project name>

Template: fill in every `<...>`, delete lines that do not apply, and state only what the repo's config confirms.

## Apps

- **Web**: <framework> at `<app root>`. UI in `src/`.
- **Backend**: <server entry and routing>, or delete this line.
- **Mobile**: <framework> in `<mobile folder>`, or delete this line.
- **Data**: <data layer and auth>. Client code: `<paths>`.

## Source layout

- Layers: `src/{app,pages,widgets,features,entities,shared}`.
- Slices: <list pages, widgets, features, and entities>.
- Worked example: `<path to the best-shaped slice, including its index.ts>`.
- App shell: `src/app/` (providers and entry, not a framework route folder).
- Legacy folders still ignored by the gate: <list `fsd.gate.json` ignore entries, or "none">.

## Commands

- Dev: `<command>` (port <port>).
- Gate: `node .agents/skills/feature-sliced-design/scripts/gate.mjs`.
- Lint: `<command>`. Format: `<command>`.
- Type-check: `<command>`.
- Tests: `<command>`, or "no test runner".
- Add lint and type-check to `fsd.gate.json` `extra` when those commands exist.

## Secrets

- `.env*` is git-ignored. `.env.example` lists names. Never write secret values into code, docs, or rules.
