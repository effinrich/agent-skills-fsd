# Parity with feature-based-architecture

How these skills compare with `effinrich/agent-skills` (`feature-based-architecture`), checked against the code in both repos on 2026-11-18. "Before" is commit `99a007b`.

The two were not identical. The original has no harness: no gate, hooks, lefthook, or CI. It has a validator, a scaffold, and prose rules. The FSD skills already went further on enforcement, but they were missing several things the original does.

| Capability | Original | FSD before | FSD now |
| --- | --- | --- | --- |
| Scaffold a new unit | `scaffold.mjs <feature> [component]` | `scaffold.mjs <layer> <slice> [segment...]`; Nx `fsd-slice` | Same |
| Add a component to an existing unit | `scaffold.mjs <feature> <component>` | Missing: refused the existing slice | `scaffold.mjs <layer> <slice> --component <name>`; Nx: `nx g @nx/react:component <path>` (flag checked against `@nx/react` 23.1 schema) |
| Scaffold under a custom root | Path argument | Hard-coded `src/`, ignored `fsd.gate.json` `src` | Reads `src` from `fsd.gate.json` |
| Refactor in place, incrementally | Validator only reads `src/features/`, so legacy code elsewhere never fails | Gate failed on every legacy folder; the only escape was hand-editing `ignore`, which `AGENTS.md` forbids agents to do | `validate.mjs --baseline` / `validate-segments.mjs --baseline` writes failing units into `ignore` once, on the user's go-ahead |
| Splitting a large component | Steps in SKILL.md | Steps in both SKILL.md files | Same, plus the docs step and second-component step |
| Component folder needs a like-named file | Yes | Agnostic yes; Nx no | Both |
| One component per file | Folder rule plus lint | Gate checks exported names | Same |
| Kebab-case names | Yes | Yes | Same |
| Effects and server state only in hook files | `useEffect`, `useLayoutEffect`, `useQuery`, `useMutation`, `useInfiniteQuery`, `useSubscription`, `useSWR*` | No `useSubscription`; Nx only checked `ui` | Both check the full list; Nx allows them only in `model` |
| Network only in `api` | Anywhere outside `api.ts` fails | Agnostic yes; Nx only checked `ui` and `model` | Both: anywhere outside `api` fails |
| Inline `any` | Fails unless an eslint/biome disable comment is on that line or the line above | Missing in both | Both; oxlint disable comments also count |
| Sibling imports | Sibling-feature imports fail | Stronger: layer direction, public API, `@x` | Same |
| Docs change with code | Rule 10 in SKILL.md | Only in the templates | In both SKILL.md files too |
| Rule files for Cursor, Windsurf, Claude | SKILL.md section plus templates | Nx section plus templates; agnostic had templates only | Section in both |
| Gate, stop hook, shell guard, lefthook, CI | None | Yes | Same |
| Size budget | ~200 lines per file, prose | Per-file cap plus tree budget, enforced | Same |

Different by design, not gaps:

- Layout: `src/features/<feature>/<component>/{types,consts,hooks,utils,api}.ts` becomes FSD layers and segments (`model`, `config`, `lib`, `api`). The mapping table is in the agnostic SKILL.md.
- The original turns on `react/no-multi-comp` and `unicorn/filename-case`; the FSD gate checks both itself.
- The original's `validate.mjs <feature-path>` scopes a run to the features you migrated. FSD scopes through `ignore` instead, so the stop hook and CI check the same set.

Not covered:

- The Nx generator and `nx g @nx/react:component` were not run here: this repo has no Nx workspace. The self-checks cover the segment gate only.
- Neither skill checks that the Cursor, Windsurf, and `AGENTS.md` copies of a rule stay in sync.
