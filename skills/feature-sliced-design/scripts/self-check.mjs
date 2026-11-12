#!/usr/bin/env node
// Builds a temporary tree and checks the gate scripts. Not part of a project's gate.

import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const scripts = dirname(fileURLToPath(import.meta.url))
const node = process.execPath
let failed = 0

const root = mkdtempSync(join(tmpdir(), "fsd-gate-"))
try {
  writeTree(root, validTree())
  writeFileSync(
    join(root, "fsd.gate.json"),
    JSON.stringify({ src: "src", maxFiles: 80, maxLines: 4000, maxFileLines: 200, ignore: [], steiger: false, extra: [] }, null, 2),
  )
  expect("valid tree", run("validate.mjs", root), 0, "OK feature-sliced design")
  expect("gate", run("gate.mjs", root), 0, "OK feature-sliced design")

  const scaffolded = mkdtempSync(join(tmpdir(), "fsd-scaffold-"))
  try {
    const created = spawnSync(node, [join(scripts, "scaffold.mjs"), "features", "sign-in"], { cwd: scaffolded, encoding: "utf8" })
    expect("scaffold", created, 0, "Created")
    expect("scaffold validates", run("validate.mjs", scaffolded), 0, "OK feature-sliced design")
    const again = spawnSync(node, [join(scripts, "scaffold.mjs"), "features", "sign-in"], { cwd: scaffolded, encoding: "utf8" })
    expect("scaffold refuses overwrite", again, 1, "Refusing to overwrite")
  } finally {
    rmSync(scaffolded, { recursive: true, force: true })
  }

  expectFail("sibling feature import", {
    "src/features/billing/index.ts": 'import { Auth } from "features/auth"\nexport {}\n',
    "src/features/billing/model/billing.ts": "export {}\n",
  }, "cannot import each other")

  expectFail("upward import", {
    "src/widgets/header/ui/header/header.tsx": 'import { Home } from "pages/home"\nexport const Header = () => null\n',
  }, "cannot import pages")

  expectFail("public api sidestep", {
    "src/pages/home/ui/home/home.tsx": 'import { Button } from "shared/ui/button/button"\nexport const Home = () => null\n',
  }, "public API")

  expectFail("wrong @x consumer", {
    "src/entities/playlist/index.ts": 'import type { User } from "entities/user/@x/song"\nexport {}\n',
    "src/entities/playlist/model/playlist.ts": "export {}\n",
  }, "@x")

  expectFail("effect in ui", {
    "src/pages/home/ui/home/home.tsx": 'import { useEffect } from "react"\nexport const Home = () => { useEffect(() => {}, []); return null }\n',
  }, "model/")

  expectFail("fetch in ui", {
    "src/pages/home/ui/home/home.tsx": "export const Home = () => { fetch(\"/api\"); return null }\n",
  }, "api segment")

  expectFail("unknown segment", {
    "src/features/auth/hooks/use-auth.ts": "export {}\n",
  }, "unknown segment")

  expectFail("pascal file", {
    "src/shared/ui/TaskList.tsx": "export const TaskList = () => null\n",
  }, "kebab-case")

  expectFail("two components", {
    "src/shared/ui/button/button.tsx": "export const Button = () => null\nexport const Icon = () => null\n",
  }, "one component per file")

  expectFail("processes layer", {
    "src/processes/index.ts": "export {}\n",
  }, "processes")

  expectFail("unknown folder", {
    "src/components/button.tsx": "export const Button = () => null\n",
  }, "unknown folder")

  const missing = mkdtempSync(join(tmpdir(), "fsd-missing-"))
  try {
    writeTree(missing, validTree())
    rmSync(join(missing, "src", "pages", "home", "index.ts"))
    expect("missing public index", run("validate.mjs", missing), 1, "missing index.ts")
  } finally {
    rmSync(missing, { recursive: true, force: true })
  }

  const budget = mkdtempSync(join(tmpdir(), "fsd-budget-"))
  try {
    writeTree(budget, { "src/app/index.tsx": "export const App = () => null\nexport const Other = () => null\n" })
    const over = spawnSync(node, [join(scripts, "size-budget.mjs"), "--src", "src", "--max-files", "0", "--max-lines", "100"], {
      cwd: budget,
      encoding: "utf8",
    })
    expect("size budget", over, 1, "FAIL size budget")
  } finally {
    rmSync(budget, { recursive: true, force: true })
  }

  const cursor = { cwd: root, sandbox: false, cursor_version: "1" }
  expect("shell allows status", pipe("shell-guard.mjs", { ...cursor, command: "git status" }), 0, '"permission":"allow"')
  expect("shell denies no-verify", pipe("shell-guard.mjs", { ...cursor, command: "git commit --no-verify -m x" }), 0, '"permission":"deny"')
  expect("shell denies commit -n", pipe("shell-guard.mjs", { ...cursor, command: "git commit -n -m x" }), 0, '"permission":"deny"')
  expect("shell denies LEFTHOOK", pipe("shell-guard.mjs", { ...cursor, command: "LEFTHOOK=0 git commit -m x" }), 0, '"permission":"deny"')
  expect("shell allows message", pipe("shell-guard.mjs", { ...cursor, command: 'git commit -m "ship the gate"' }), 0, '"permission":"allow"')
  const claude = pipe("shell-guard.mjs", { hook_event_name: "PreToolUse", tool_input: { command: "git push --no-verify" } })
  expect("claude denies no-verify", claude, 0, '"permissionDecision":"deny"')

  const gitRoot = mkdtempSync(join(tmpdir(), "fsd-stop-"))
  try {
    writeFileSync(join(gitRoot, "README.md"), "ok\n")
    git(gitRoot, ["init"])
    git(gitRoot, ["add", "."])
    git(gitRoot, ["commit", "-m", "init"])
    const marker = join(gitRoot, "ran.txt")
    const writeRan = `${JSON.stringify(node)} -e "require('fs').writeFileSync('ran.txt','1')"`
    const clean = pipe("stop-gate.mjs", { cursor_version: "1", status: "completed", loop_count: 0, conversation_id: "clean" }, gitRoot, [writeRan])
    expect("stop skips clean tree", clean, 0, "{}")
    if (existsSync(marker)) {
      failed += 1
      console.error("FAIL stop ran the gate on a clean tree")
    }
  } catch (error) {
    failed += 1
    console.error(`FAIL stop skips clean tree\n${error.message}`)
  } finally {
    rmSync(gitRoot, { recursive: true, force: true })
  }

  const dirtyRoot = mkdtempSync(join(tmpdir(), "fsd-dirty-"))
  try {
    writeFileSync(join(dirtyRoot, "README.md"), "ok\n")
    git(dirtyRoot, ["init"])
    git(dirtyRoot, ["add", "."])
    git(dirtyRoot, ["commit", "-m", "init"])
    writeFileSync(join(dirtyRoot, "dirty.txt"), "x\n")
    const failCmd = `${JSON.stringify(node)} -e "process.exit(1)"`
    const follow = pipe("stop-gate.mjs", { cursor_version: "1", status: "completed", loop_count: 0, conversation_id: "dirty-follow" }, dirtyRoot, [failCmd])
    expect("stop followup", follow, 0, "followup_message")
    const capped = pipe("stop-gate.mjs", { cursor_version: "1", status: "completed", loop_count: 3, conversation_id: "dirty-cap" }, dirtyRoot, [failCmd])
    expect("stop loop cap", capped, 0, "{}")
    const aborted = pipe("stop-gate.mjs", { cursor_version: "1", status: "aborted", loop_count: 0, conversation_id: "aborted" }, dirtyRoot, [failCmd])
    expect("stop ignores abort", aborted, 0, "{}")
  } finally {
    rmSync(dirtyRoot, { recursive: true, force: true })
  }
} finally {
  rmSync(root, { recursive: true, force: true })
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log("\nOK self-check")

function expect(name, result, status, needle) {
  const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
  if (result.status !== status || !text.includes(needle)) {
    failed += 1
    console.error(`FAIL ${name} (status ${result.status}, wanted ${status})\n${text}`)
    return
  }
  console.log(`OK ${name}`)
}

function expectFail(name, files, needle) {
  const dir = mkdtempSync(join(tmpdir(), "fsd-bad-"))
  try {
    writeTree(dir, { ...validTree(), ...files })
    expect(name, run("validate.mjs", dir), 1, needle)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function run(script, cwd, extra = []) {
  return spawnSync(node, [join(scripts, script), ...extra], { cwd, encoding: "utf8" })
}

function pipe(script, payload, cwd = root, extra = []) {
  return spawnSync(node, [join(scripts, script), ...extra], {
    cwd,
    encoding: "utf8",
    input: JSON.stringify(payload),
  })
}

function git(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "FSD Gate",
      GIT_AUTHOR_EMAIL: "fsd-gate@example.com",
      GIT_COMMITTER_NAME: "FSD Gate",
      GIT_COMMITTER_EMAIL: "fsd-gate@example.com",
    },
  })
  if (result.status !== 0) {
    const error = new Error(result.stderr || result.stdout || "git failed")
    error.code = "GIT"
    throw error
  }
}

function writeTree(dir, files) {
  for (const [file, body] of Object.entries(files)) {
    const abs = join(dir, ...file.split("/"))
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, body)
  }
}

function validTree() {
  return {
    "src/app/index.tsx": "export const App = () => null\n",
    "src/app/providers/app-providers.tsx":
      'import { useEffect } from "react"\nexport const AppProviders = ({ children }) => {\n  useEffect(() => {}, [])\n  return children\n}\n',
    "src/pages/home/index.ts":
      'export { Home } from "./ui/home/home"\nimport { Header } from "widgets/header"\nimport { Auth } from "features/auth"\n',
    "src/pages/home/ui/home/home.tsx": "export const Home = () => null\n",
    "src/pages/(marketing)/about/index.ts": 'export { About } from "./ui/about/about"\n',
    "src/pages/(marketing)/about/ui/about/about.tsx": "export const About = () => null\n",
    "src/widgets/header/index.ts": 'export { Header } from "./ui/header/header"\n',
    "src/widgets/header/ui/header/header.tsx": 'import { Button } from "shared/ui"\nexport const Header = () => null\n',
    "src/features/auth/index.ts": 'export { Auth } from "./ui/auth/auth"\nexport * from "./model/auth"\n',
    "src/features/auth/ui/auth/auth.tsx": "export const Auth = () => null\n",
    "src/features/auth/model/auth.ts":
      'import { useQuery } from "@tanstack/react-query"\nexport const useAuth = () => useQuery({ queryKey: ["auth"], queryFn: async () => null })\n',
    "src/entities/user/index.ts": 'export type { User } from "./model/user"\n',
    "src/entities/user/model/user.ts": "export interface User { id: string }\n",
    "src/entities/user/@x/song.ts": 'export type { User } from "../model/user"\n',
    "src/entities/song/index.ts": 'export type { Song } from "./model/song"\n',
    "src/entities/song/model/song.ts":
      'import type { User } from "entities/user/@x/song"\nexport interface Song { id: string; owner: User }\n',
    "src/shared/ui/index.ts": 'export { Button } from "./button/button"\nexport { Badge } from "./badge"\n',
    "src/shared/ui/button/button.tsx": "export const Button = () => null\n",
    "src/shared/ui/badge.tsx": "export const Badge = () => null\n",
    "src/shared/api/client.ts": "export const getJson = (url: string) => fetch(url)\n",
  }
}
