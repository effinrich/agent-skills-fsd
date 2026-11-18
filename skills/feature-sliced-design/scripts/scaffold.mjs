#!/usr/bin/env node
// Scaffold a Feature-Sliced slice.
//
//   node scaffold.mjs <pages|widgets|features|entities> <slice> [segment...]
//   node scaffold.mjs <pages|widgets|features|entities> <slice> --component <name>
//
// Names are kebab-case. Refuses to overwrite. Prints the created tree. The source root is
// "src" in fsd.gate.json (default src).
// Default segments: pages and widgets get ui; features get ui and model; entities get model.
// --component adds ui/<name>/<name>.tsx to an existing slice; export it from index.ts only
// when another layer needs it.

import { mkdir, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { relative, resolve, join } from "node:path"
import { loadConfig, parseArgs } from "./config.mjs"

const LAYERS = new Set(["pages", "widgets", "features", "entities"])
const SEGMENTS = new Set(["ui", "model", "api", "lib", "config"])
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DEFAULTS = {
  pages: ["ui"],
  widgets: ["ui"],
  features: ["ui", "model"],
  entities: ["model"],
}

const argv = process.argv.slice(2)
const componentFlag = argv.indexOf("--component")
const component = componentFlag === -1 ? null : argv[componentFlag + 1]
if (componentFlag !== -1) argv.splice(componentFlag, 2)
const [layer, slice, ...segmentArgs] = argv
if (!layer || !slice || (componentFlag !== -1 && !component)) {
  console.error("Usage: scaffold.mjs <pages|widgets|features|entities> <slice> [segment...] | --component <name>")
  process.exit(1)
}
if (!LAYERS.has(layer)) {
  console.error(`Layer must be pages, widgets, features, or entities. app and shared are not sliced.`)
  process.exit(1)
}
if (!KEBAB.test(slice) || SEGMENTS.has(slice)) {
  console.error(`Slice name must be kebab-case and not a segment name (got ${slice}).`)
  process.exit(1)
}

const segments = segmentArgs.length > 0 ? segmentArgs : DEFAULTS[layer]
for (const segment of segments) {
  if (!SEGMENTS.has(segment)) {
    console.error(`Unknown segment "${segment}". Use ui, model, api, lib, or config.`)
    process.exit(1)
  }
}

const root = resolve(loadConfig(process.cwd(), parseArgs([])).src, layer, slice)

if (component) {
  if (!KEBAB.test(component)) {
    console.error(`Component name must be kebab-case (got ${component}).`)
    process.exit(1)
  }
  if (!existsSync(root)) {
    console.error(`No slice at ${relative(process.cwd(), root)}. Scaffold the slice first.`)
    process.exit(1)
  }
  const dir = join(root, "ui", component)
  if (existsSync(dir)) {
    console.error(`Refusing to overwrite existing path: ${relative(process.cwd(), dir)}`)
    process.exit(1)
  }
  const name = toPascal(component)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${component}.tsx`), `// ${name} — markup and wiring. Effects, server state, and network calls stay out of ui.

export const ${name} = () => {
  return null
}
`)
  console.log(`Created ${relative(process.cwd(), dir).replaceAll("\\", "/")}/${component}.tsx`)
  console.log("Export it from index.ts only when another layer imports it.")
  process.exit(0)
}

if (existsSync(root)) {
  console.error(`Refusing to overwrite existing path: ${relative(process.cwd(), root)}`)
  process.exit(1)
}

const pascal = toPascal(slice)
const files = new Map()

if (segments.includes("ui")) {
  files.set(
    join("ui", slice, `${slice}.tsx`),
    `// ${pascal} — markup and wiring. Effects, server state, and network calls stay out of ui.

export const ${pascal} = () => {
  return null
}
`,
  )
}

if (segments.includes("model")) {
  files.set(
    join("model", `${slice}.ts`),
    `// ${slice} model — state, schemas, and hooks. No fetch or axios; those belong in api/.

export {}
`,
  )
}

if (segments.includes("api")) {
  files.set(
    join("api", `${slice}.ts`),
    `// ${slice} api — request functions. No React.

export {}
`,
  )
}

if (segments.includes("lib")) {
  files.set(
    join("lib", `${slice}.ts`),
    `// ${slice} lib — pure helpers for this slice. No React.

export {}
`,
  )
}

if (segments.includes("config")) {
  files.set(
    join("config", `${slice}.ts`),
    `// ${slice} config — fixed values and flags for this slice.

export {}
`,
  )
}

const exports = []
if (segments.includes("ui")) exports.push(`export { ${pascal} } from "./ui/${slice}/${slice}"`)
if (segments.includes("model")) exports.push(`export * from "./model/${slice}"`)
files.set(
  "index.ts",
  exports.length > 0
    ? `${exports.join("\n")}\n`
    : `// Public API for ${layer}/${slice}. Re-export what other layers may import.\n\nexport {}\n`,
)

await mkdir(root, { recursive: true })
for (const [file, body] of files) {
  const target = join(root, file)
  await mkdir(join(target, ".."), { recursive: true })
  await writeFile(target, body)
}

console.log(`Created ${relative(process.cwd(), root)}/`)
for (const file of files.keys()) console.log(`  ${file.replaceAll("\\", "/")}`)

function toPascal(kebab) {
  return kebab.replace(/(^|-)(.)/g, (_, __, char) => char.toUpperCase())
}
