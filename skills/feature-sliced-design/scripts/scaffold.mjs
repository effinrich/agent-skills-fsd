#!/usr/bin/env node
// Scaffold a Feature-Sliced slice.
//
//   node scaffold.mjs <pages|widgets|features|entities> <slice> [segment...]
//
// Names are kebab-case. Refuses to overwrite. Prints the created tree.
// Default segments: pages and widgets get ui; features get ui and model; entities get model.

import { mkdir, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { relative, resolve, join } from "node:path"

const LAYERS = new Set(["pages", "widgets", "features", "entities"])
const SEGMENTS = new Set(["ui", "model", "api", "lib", "config"])
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DEFAULTS = {
  pages: ["ui"],
  widgets: ["ui"],
  features: ["ui", "model"],
  entities: ["model"],
}

const [layer, slice, ...segmentArgs] = process.argv.slice(2)
if (!layer || !slice) {
  console.error("Usage: scaffold.mjs <pages|widgets|features|entities> <slice> [segment...]")
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

const root = resolve(process.cwd(), "src", layer, slice)
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
