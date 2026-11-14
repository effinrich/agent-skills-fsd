---
trigger: glob
globs: **/*.ts,**/*.tsx
description: React and TypeScript conventions for Feature-Sliced Nx libraries.
---

# Frontend (React / TSX)

- One component per `.tsx` file. The file name is the component in kebab-case: `TaskList` -> `task-list.tsx`. A component with partials lives in `ui/<component>/<component>.tsx` and `partials/`.
- Prioritize small files: `ui` is markup plus wiring. Types and hooks go in `model`, consts in `config`, helpers in `lib`, network in `api`.
- Segment files are role- or concept-named (`types.ts`, `hooks.ts`), never `<slice>.types.ts` or `<component>.consts.ts`.
- Name a page or slice after the route or capability (`pages/focus` + `ui/focus.tsx`), not a UI variant (`focus-radar-modal`).
- No `useEffect`, `useQuery`, `fetch`, or `axios` in `ui`. Effects and server state go in `model`. Network calls go in `api`.
- `api`, `lib`, and `config` do not import React.
- Import another library only through its package name. Do not import `libs/.../src/lib/...`.
- Imports go at the top of the file. No inline or dynamic imports without a documented reason.
- Do not add a dependency for something a few lines of code can do.
- Formatting follows the project formatter. Its command is in `10-project-context`.
