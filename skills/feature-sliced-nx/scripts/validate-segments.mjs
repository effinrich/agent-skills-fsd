#!/usr/bin/env node
// Segment rules inside an Nx slice library. Module boundaries are a separate nx lint.
//
//   node validate-segments.mjs [--libs libs] [--max-file-lines 200] [--ignore prefix]
//
// Exits 0 when every library under libs/ matches this skill, 1 on violations,
// 2 when the libs directory is missing. fsd.nx.json supplies the same fields.

import { existsSync, readFileSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"

const LAYERS = new Set(["pages", "widgets", "features", "entities", "shared"])
const SEGMENTS = new Set(["ui", "model", "api", "lib", "config"])
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const EFFECT = /\b(?:useEffect|useLayoutEffect|useQuery|useMutation|useInfiniteQuery|useSWR(?:Infinite|Mutation)?)\s*\(/
const FETCH = /(?<![.\w$])(?:fetch\s*\(|axios\b)/
const REACT_IMPORT = /\bfrom\s+['"]react(?:\/[^'"]*)?['"]/

const config = loadConfig()
const violations = []

const libsRoot = join(process.cwd(), config.libs)
if (!existsSync(libsRoot)) {
  console.error(`libs directory does not exist: ${config.libs}`)
  process.exit(2)
}

const projects = []
await findProjects(libsRoot, projects)

for (const project of projects) {
  if (ignored(project)) continue
  await checkProject(project)
}

if (violations.length === 0) {
  console.log(`OK nx segments: ${projects.length} ${projects.length === 1 ? "library" : "libraries"}`)
  process.exit(0)
}

console.error(`FAIL nx segments: ${violations.length} violation(s)\n`)
for (const line of violations) console.error(`  ${line}`)
process.exit(1)

function loadConfig() {
  const defaults = { libs: "libs", maxFileLines: 200, ignore: [] }
  const file = join(process.cwd(), "fsd.nx.json")
  const fromFile = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {}
  const config = { ...defaults, ...fromFile, ignore: [...(fromFile.ignore ?? [])] }
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--libs") config.libs = args[++i]
    else if (arg === "--max-file-lines") config.maxFileLines = Number(args[++i])
    else if (arg === "--ignore") config.ignore.push(args[++i])
    else {
      console.error(`Unknown argument: ${arg}`)
      process.exit(2)
    }
  }
  return config
}

async function findProjects(dir, acc) {
  const entries = await readdir(dir, { withFileTypes: true })
  const names = new Set(entries.map((entry) => entry.name))
  const hasSource = names.has("src") && (existsSync(join(dir, "src", "index.ts")) || existsSync(join(dir, "src", "index.tsx")))
  if (names.has("project.json") || hasSource) {
    acc.push(dir)
    return
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "node_modules" || entry.name === "dist") continue
    await findProjects(join(dir, entry.name), acc)
  }
}

async function checkProject(project) {
  const place = placement(project)
  if (!place.layer) {
    fail(project, "library must live at libs/<domain>/<layer>/<slice> (shared code is libs/shared/shared/<slice>).")
    return
  }
  const projectFile = join(project, "project.json")
  if (!existsSync(projectFile)) {
    fail(project, "missing project.json. Generate the slice with fsd-slice; do not hand-roll the library.")
  } else {
    checkTags(project, place, projectFile)
  }
  const index = existsSync(join(project, "src", "index.ts"))
    ? join(project, "src", "index.ts")
    : join(project, "src", "index.tsx")
  if (!existsSync(index)) {
    fail(project, "missing src/index.ts public API.")
    return
  }
  const indexText = await readFile(index, "utf8")
  if (/\.stories['"]/.test(indexText)) fail(index, "stories are not part of the public API.")
  await checkSrcRoot(join(project, "src"))
  const lib = join(project, "src", "lib")
  if (!existsSync(lib)) {
    fail(project, "missing src/lib.")
    return
  }
  await checkLib(lib)
}

function checkTags(project, place, projectFile) {
  let parsed
  try {
    parsed = JSON.parse(readFileSync(projectFile, "utf8"))
  } catch {
    fail(projectFile, "project.json is not valid JSON.")
    return
  }
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.map(String)
    : String(parsed.tags ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
  const layerTag = `fsd:layer:${place.layer}`
  const domainTag = `fsd:domain:${place.domain}`
  if (!tags.includes(layerTag) || !tags.includes(domainTag)) {
    fail(projectFile, `tags must include ${layerTag} and ${domainTag}.`)
  }
}

async function checkSrcRoot(src) {
  for (const entry of await readdir(src, { withFileTypes: true })) {
    if (entry.name === "lib" || entry.name === "index.ts" || entry.name === "index.tsx") continue
    if (entry.name.endsWith(".d.ts")) continue
    fail(join(src, entry.name), "only index.ts and src/lib belong at the library src root.")
  }
}

async function checkLib(lib) {
  for (const entry of await readdir(lib, { withFileTypes: true })) {
    const abs = join(lib, entry.name)
    if (!entry.isDirectory()) {
      if (entry.name !== ".gitkeep") fail(abs, "files in src/lib must sit in a segment folder.")
      continue
    }
    if (!SEGMENTS.has(entry.name)) {
      fail(abs, `unknown segment "${entry.name}". Segments are ui, model, api, lib, config.`)
      continue
    }
    await walkSegment(abs, entry.name)
  }
}

async function walkSegment(dir, segment) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== "partials" && !KEBAB.test(entry.name)) {
        fail(abs, "folder name must be kebab-case.")
        continue
      }
      await walkSegment(abs, segment)
      continue
    }
    if (entry.name === ".gitkeep") continue
    if (!isKebabFile(entry.name)) {
      fail(abs, "file name must be kebab-case.")
      continue
    }
    if (!isCode(entry.name)) {
      fail(abs, "unexpected file in a segment.")
      continue
    }
    await checkFile(abs, segment, entry.name)
  }
}

async function checkFile(abs, segment, name) {
  const text = await readFile(abs, "utf8")
  const lines = text.split(/\r?\n/).length
  if (lines > config.maxFileLines && !isTestLike(name)) {
    fail(abs, `${lines} lines. Keep files at or under ${config.maxFileLines}.`)
  }
  const code = stripComments(text)
  if (segment === "ui") {
    if (name.endsWith(".ts") && !name.endsWith(".d.ts") && !isTestLike(name) && name !== "index.ts") {
      fail(abs, "hooks and types go in model, not ui.")
    }
    if (isComponentSource(name) && !isTestLike(name)) checkComponent(abs, name, code)
    if (EFFECT.test(code)) fail(abs, "effects and server state go in model.")
    if (FETCH.test(code)) fail(abs, "fetch and axios go in api.")
  }
  if (segment === "model" && FETCH.test(code)) fail(abs, "fetch and axios go in api.")
  if ((segment === "api" || segment === "lib" || segment === "config") && REACT_IMPORT.test(code)) {
    fail(abs, `${segment} does not import React.`)
  }
}

function checkComponent(abs, name, code) {
  const names = componentNames(code)
  if (names.length === 0) {
    fail(abs, "ui file has no component. Types and hooks go in model.")
    return
  }
  if (names.length > 1) {
    fail(abs, "one component per file.")
    return
  }
  const stem = name.replace(/\.(tsx|jsx)$/, "")
  if (stem === "index") return
  const expected = stem.replace(/(^|-)(.)/g, (_, __, char) => char.toUpperCase())
  if (names[0] !== expected) fail(abs, `file exports ${names[0]}; the component name is ${expected}.`)
}

function placement(project) {
  const rel = relative(libsRoot, project).replace(/\\/g, "/")
  const parts = rel.split("/").filter(Boolean)
  if (parts.length === 3 && LAYERS.has(parts[1])) {
    return { domain: parts[0], layer: parts[1], slice: parts[2] }
  }
  return { domain: null, layer: null, slice: null }
}

function ignored(project) {
  const rel = relative(process.cwd(), project).replace(/\\/g, "/")
  return config.ignore.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))
}

function fail(abs, message) {
  const rel = relative(process.cwd(), abs).replace(/\\/g, "/")
  violations.push(`${rel || abs}: ${message}`)
}

function componentNames(code) {
  const names = []
  const re = /(?:export\s+default\s+|export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(|(?:export\s+default\s+|export\s+)?const\s+([A-Za-z0-9_]+)\s*(?::[^=]+)?=\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z0-9_]+)\s*=>/g
  for (const match of code.matchAll(re)) {
    const name = match[1] || match[2]
    if (/^[A-Z][A-Za-z0-9]*$/.test(name) && /[a-z]/.test(name)) names.push(name)
  }
  return names
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

function isKebabFile(name) {
  const stem = name
    .replace(/\.(test|spec|stories|module|d)\.(tsx?|jsx?|css|scss)$/, "")
    .replace(/\.(tsx?|jsx?|mjs|cjs|css|scss|json|md)$/, "")
  return stem === "index" || KEBAB.test(stem)
}

function isTestLike(name) {
  return /\.(test|spec|stories)\.(tsx?|jsx?)$/.test(name)
}

function isComponentSource(name) {
  return name.endsWith(".tsx") || name.endsWith(".jsx")
}

function isCode(name) {
  return /\.(tsx?|jsx?|mjs|cjs|d\.ts|css|scss)$/.test(name) || isTestLike(name)
}
