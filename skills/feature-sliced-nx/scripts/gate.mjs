#!/usr/bin/env node
// Segment check, then Nx boundary lint when this directory is an Nx workspace.
// Boundary lint uses NX_BASE, or origin/main when that merge-base exists.
// A repo with no nx.json (this skills repo) stops after the segment check.

import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const segments = spawnSync(process.execPath, [join(here, "validate-segments.mjs"), ...process.argv.slice(2)], {
  stdio: "inherit",
})
if ((segments.status ?? 1) !== 0) process.exit(segments.status ?? 1)

if (!existsSync(join(process.cwd(), "nx.json"))) {
  console.log("OK nx gate: no nx.json, boundary lint skipped")
  process.exit(0)
}

const nxBin = resolveNxBin()
if (!nxBin) {
  console.error("nx.json is present but nx is not installed. Boundary lint did not run.")
  process.exit(1)
}

const base = process.env.NX_BASE || mergeBase()
if (!base) {
  console.error("Boundary lint needs a base. Set NX_BASE to the ref this work should compare against.")
  process.exit(1)
}

const result = spawnSync(process.execPath, [join(process.cwd(), nxBin), "affected", "-t", "lint", `--base=${base}`], {
  stdio: "inherit",
})
process.exit(result.status ?? 1)

// Nx moved its CLI entry point in v24 (node_modules/nx/dist/bin/nx.js). Resolve the installed
// package instead of guessing one path, so the gate works on every Nx version.
function resolveNxBin() {
  const candidates = [
    "node_modules/nx/bin/nx.js",
    "node_modules/nx/bin/nx",
    "node_modules/nx/dist/bin/nx.js",
  ]
  const direct = candidates.find((path) => existsSync(join(process.cwd(), path)))
  if (direct) {
    return direct
  }
  try {
    const require = createRequire(import.meta.url)
    const manifest = require.resolve("nx/package.json", { paths: [process.cwd()] })
    const pkg = JSON.parse(readFileSync(manifest, "utf8"))
    const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.nx
    return bin ? join(dirname(manifest), bin) : null
  } catch {
    return null
  }
}

function mergeBase() {
  for (const ref of ["origin/main", "origin/master"]) {
    const result = spawnSync("git", ["merge-base", "HEAD", ref], { encoding: "utf8" })
    if (result.status === 0 && result.stdout.trim()) return ref
  }
  return null
}
