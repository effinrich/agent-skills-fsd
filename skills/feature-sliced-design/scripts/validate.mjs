#!/usr/bin/env node
// Validate a Feature-Sliced tree. Exits 0 when clean, 1 on violations, 2 on usage errors.
//
//   node validate.mjs [--config fsd.gate.json] [--src src] [--ignore path] [--max-file-lines 200] [--baseline]
//
// --baseline adopts an existing app: every top-level folder, slice, or segment that fails
// is added to "ignore" in the config file, so the gate holds new code while legacy code waits.

import { readdir, readFile, stat } from "node:fs/promises"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { loadConfig, parseArgs } from "./config.mjs"

const LAYERS = ["app", "pages", "widgets", "features", "entities", "shared"]
const RANK = Object.fromEntries(LAYERS.map((layer, index) => [layer, index]))
const SLICED = new Set(["pages", "widgets", "features", "entities"])
const SEGMENTS = new Set(["ui", "model", "api", "lib", "config"])
const APP_FOLDERS = new Set([...SEGMENTS, "providers", "styles", "routes", "store"])
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const ROOT_FILES = new Set(["main.ts", "main.tsx", "index.ts", "index.tsx", "vite-env.d.ts"])
const APP_ROOT_FILES = new Set([
  "index.ts",
  "index.tsx",
  "app.tsx",
  "main.ts",
  "main.tsx",
  "providers.tsx",
  "styles.css",
  "global.css",
])
const EFFECT_RE = /\b(useEffect|useLayoutEffect|useQuery|useMutation|useInfiniteQuery|useSubscription|useSWR(?:Infinite|Mutation)?)\s*\(/
const ANY_RE = /(?::\s*|\bas\s+)any\b/
const ANY_ESCAPE = /(?:eslint|oxlint)-disable|biome-ignore/
const FETCH_RE = /(?<![.\w$])fetch\s*\(|(?<![.\w$])axios\b/
const REACT_RE = /\bfrom\s+['"]react(?:-dom)?(?:\/[^'"]*)?['"]|\brequire\(\s*['"]react(?:-dom)?['"]\s*\)/
const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"])

const args = (() => {
  try {
    return parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    process.exit(2)
  }
})()

if (args.help) {
  console.log("Usage: validate.mjs [--config fsd.gate.json] [--src src] [--ignore path] [--max-file-lines 200] [--baseline]")
  process.exit(0)
}

const config = loadConfig(process.cwd(), args)
const srcRoot = config.src
const maxFileLines = config.maxFileLines
const violations = []
const failedPaths = []
const aliases = await loadAliases(process.cwd())

if (!(await exists(srcRoot))) {
  console.error(`No source root at ${relative(process.cwd(), srcRoot) || srcRoot}. Create src/ or set "src" in fsd.gate.json.`)
  process.exit(2)
}

await validateRoot(srcRoot)

if (args.baseline) {
  writeBaseline()
  process.exit(0)
}

if (violations.length === 0) {
  console.log(`OK feature-sliced design: ${display(srcRoot)}`)
  process.exit(0)
}

console.error(`FAIL feature-sliced design: ${violations.length} violation(s)\n`)
for (const item of violations) console.error(`  ${item}`)
process.exit(1)

async function validateRoot(root) {
  const entries = await readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const abs = join(root, entry.name)
    if (ignored(abs)) continue
    if (entry.isDirectory()) {
      if (entry.name === "processes") {
        fail(abs, "the processes layer was removed from Feature-Sliced Design.")
        continue
      }
      if (!Object.hasOwn(RANK, entry.name)) {
        fail(abs, `unknown folder. Layers are ${LAYERS.join(", ")}.`)
        continue
      }
      if (SLICED.has(entry.name)) await validateSlicedLayer(abs, entry.name)
      else await validateUnslicedLayer(abs, entry.name)
    } else if (!allowedSrcRootFile(entry.name)) {
      fail(abs, "loose file in src. Entry files may be main.tsx or index.tsx; everything else belongs in a layer.")
    }
  }
}

async function validateSlicedLayer(dir, layer) {
  await walkForSlices(dir, layer)
}

async function walkForSlices(dir, layer) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const abs = join(dir, entry.name)
    if (ignored(abs)) continue
    if (entry.isFile()) {
      const kind = SLICED.has(layer) && (entry.name === "index.ts" || entry.name === "index.tsx") ? "layer barrel" : "file"
      if (kind === "layer barrel") {
        fail(abs, `layer barrel. Import each slice through ${layer}/<slice>, not the whole layer.`)
      } else {
        fail(abs, `file on the ${layer} layer. A slice is a folder with index.ts and segments.`)
      }
      continue
    }
    const childEntries = await readdir(abs, { withFileTypes: true })
    if (isSliceEntries(childEntries)) {
      if (!isTransparent(entry.name) && (!KEBAB.test(entry.name) || SEGMENTS.has(entry.name) || Object.hasOwn(RANK, entry.name))) {
        fail(abs, "slice name must be kebab-case and must not be a layer or segment name.")
      }
      await validateSlice(abs, layer, entry.name, childEntries)
      continue
    }
    if (isTransparent(entry.name)) {
      await walkForSlices(abs, layer)
      continue
    }
    if (SEGMENTS.has(entry.name)) {
      fail(abs, `segment directly on ${layer}. Put ${entry.name}/ inside a slice.`)
      continue
    }
    fail(abs, `folder on ${layer} has no index.ts or segment. A slice needs a public index.ts.`)
  }
}

async function validateSlice(dir, layer, slice, entries) {
  entries = entries ?? (await readdir(dir, { withFileTypes: true }))
  const names = new Set(entries.map((entry) => entry.name))
  if (!names.has("index.ts") && !names.has("index.tsx")) {
    fail(dir, "slice is missing index.ts, the public API other layers import.")
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name)
    if (ignored(abs)) continue
    if (entry.isFile()) {
      if (entry.name !== "index.ts" && entry.name !== "index.tsx") {
        fail(abs, "loose file in a slice. Move it into ui, model, api, lib, or config.")
      } else {
        await checkFile(abs, { layer, segment: "root", slice, fileName: entry.name, component: false })
      }
      continue
    }
    if (entry.name === "@x") {
      if (layer !== "entities") fail(abs, "@x cross-imports are only allowed on entities.")
      else await validateCrossApi(abs, slice)
      continue
    }
    if (!SEGMENTS.has(entry.name)) {
      fail(abs, `unknown segment. Use ${[...SEGMENTS].join(", ")}, or @x on an entity.`)
      continue
    }
    await validateSegment(abs, layer, entry.name)
  }
}

async function validateCrossApi(dir, ownerSlice) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) {
      fail(abs, "@x holds one file per importing slice, not folders.")
      continue
    }
    const stem = entry.name.replace(/\.tsx?$/, "")
    if (!KEBAB.test(stem)) fail(abs, "@x file name is the importing slice, in kebab-case.")
    if (stem === ownerSlice) fail(abs, "@x file is for another slice, not the owner.")
    await checkFile(abs, { layer: "entities", segment: "@x", slice: ownerSlice, fileName: entry.name, component: false })
  }
}

async function validateUnslicedLayer(dir, layer) {
  const allowed = layer === "app" ? APP_FOLDERS : SEGMENTS
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const abs = join(dir, entry.name)
    if (ignored(abs)) continue
    if (entry.isDirectory()) {
      if (!allowed.has(entry.name)) {
        fail(abs, layer === "app"
          ? `unknown app folder. Use ${[...allowed].join(", ")}.`
          : `unknown shared folder. shared has segments (${[...SEGMENTS].join(", ")}), not slices.`)
        continue
      }
      await validateSegment(abs, layer, entry.name)
      continue
    }
    if (layer === "shared") {
      fail(abs, "loose file in shared. Import a segment through shared/<segment>.")
      continue
    }
    if (!allowedAppRootFile(entry.name)) {
      const route = entry.name === "page.tsx" || entry.name === "layout.tsx" || entry.name === "route.ts"
      fail(abs, route
        ? "framework route file in the FSD app layer. Screens live in pages/. Add a framework route folder to fsd.gate.json ignore only when the framework requires that path."
        : "unexpected file in app. Entry files are index.tsx or app.tsx; other code goes in a segment or providers, styles, routes, or store.")
      continue
    }
    await checkFile(abs, { layer, segment: "root", slice: null, fileName: entry.name, component: isComponentSource(entry.name) })
  }
}

async function validateSegment(dir, layer, segment) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const abs = join(dir, entry.name)
    if (ignored(abs)) continue
    if (entry.isDirectory()) {
      if (segment === "ui") {
        if (entry.name === "partials") {
          fail(abs, "partials belong inside a component folder (ui/<component>/partials).")
          continue
        }
        if (!KEBAB.test(entry.name)) {
          fail(abs, "component folder name must be kebab-case.")
          continue
        }
        await validateComponentFolder(abs, entry.name, layer)
      } else {
        if (!KEBAB.test(entry.name) && !isTransparent(entry.name)) {
          fail(abs, "folder name must be kebab-case.")
          continue
        }
        await validateSegment(abs, layer, segment)
      }
      continue
    }
    if (!isKebabFile(entry.name)) {
      fail(abs, "file name must be kebab-case.")
      continue
    }
    const component = segment === "ui" && isComponentSource(entry.name) && !isTestLike(entry.name) && !entry.name.startsWith("index.")
    await checkFile(abs, { layer, segment, slice: null, fileName: entry.name, component })
  }
}

async function validateComponentFolder(dir, name, layer) {
  const entries = await readdir(dir, { withFileTypes: true })
  const componentFile = entries.find((entry) => entry.isFile() && (entry.name === `${name}.tsx` || entry.name === `${name}.jsx`))
  if (!componentFile) fail(dir, `component folder needs ${name}.tsx.`)
  for (const entry of entries) {
    const abs = join(dir, entry.name)
    if (ignored(abs)) continue
    if (entry.isDirectory()) {
      if (entry.name !== "partials") {
        fail(abs, "only partials/ may sit inside a component folder.")
        continue
      }
      await validatePartials(abs, layer)
      continue
    }
    if (!isKebabFile(entry.name)) {
      fail(abs, "file name must be kebab-case.")
      continue
    }
    if (!allowedComponentCompanion(name, entry.name)) {
      fail(abs, `unexpected file in ${name}/. Keep ${name}.tsx, its test, story, and styles, and partials/.`)
      continue
    }
    const component = entry.name === `${name}.tsx` || entry.name === `${name}.jsx`
    await checkFile(abs, { layer, segment: "ui", slice: null, fileName: entry.name, component })
  }
}

async function validatePartials(dir, layer) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const abs = join(dir, entry.name)
    if (ignored(abs)) continue
    if (entry.isDirectory()) {
      fail(abs, "partials are flat files.")
      continue
    }
    if (!isKebabFile(entry.name)) {
      fail(abs, "file name must be kebab-case.")
      continue
    }
    const component = isComponentSource(entry.name) && !isTestLike(entry.name)
    await checkFile(abs, { layer, segment: "ui", slice: null, fileName: entry.name, component })
  }
}

async function checkFile(abs, ctx) {
  let info
  try {
    info = await stat(abs)
  } catch {
    return
  }
  if (!info.isFile()) return
  const ext = extension(ctx.fileName)
  if (!CODE_EXT.has(ext) && ext !== ".css" && ext !== ".scss") return
  const text = await readFile(abs, "utf8")
  const lines = text.split(/\r?\n/).length
  if (lines > maxFileLines && !isTestLike(ctx.fileName)) {
    fail(abs, `${lines} lines. Keep files at or under ${maxFileLines}. Split a segment file or a partial out.`)
  }
  if (ext === ".css" || ext === ".scss" || ctx.fileName.endsWith(".d.ts")) return

  const tsx = ext === ".tsx" || ext === ".jsx"
  if (tsx && ctx.segment !== "ui" && ctx.layer !== "app") {
    fail(abs, "TSX belongs in a ui segment (app may hold provider and entry components).")
  }
  if (ctx.segment === "ui" && ext === ".ts" && ctx.fileName !== "index.ts" && !ctx.fileName.endsWith(".d.ts") && !isTestLike(ctx.fileName)) {
    fail(abs, "ui holds components. Move hooks, types, and helpers to model, lib, or config.")
  }

  checkAny(abs, text)
  const code = stripComments(text)
  if (ctx.component && !isTestLike(ctx.fileName)) {
    checkComponent(abs, ctx.fileName, code)
  }
  if (!isTestLike(ctx.fileName)) {
    const effectSegment = ctx.segment === "ui" || ctx.segment === "api" || ctx.segment === "lib" || ctx.segment === "config"
    if (effectSegment && EFFECT_RE.test(code)) {
      fail(abs, "effects and server-state hooks belong in model/ (or in app wiring), not in ui, api, lib, or config.")
    }
    if (ctx.segment !== "api" && FETCH_RE.test(code) && !(ctx.layer === "app" && ctx.segment !== "ui")) {
      fail(abs, "fetch and axios belong in an api segment.")
    }
    if ((ctx.segment === "api" || ctx.segment === "lib" || ctx.segment === "config") && REACT_RE.test(code)) {
      fail(abs, `${ctx.segment} does not import React. Hooks belong in model; components belong in ui.`)
    }
  }
  for (const spec of collectSpecs(code)) {
    checkImport(abs, spec, ctx)
  }
}

function checkAny(abs, text) {
  const lines = text.split(/\r?\n/)
  lines.forEach((line, index) => {
    const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "")
    if (!ANY_RE.test(code)) return
    if (ANY_ESCAPE.test(line) || ANY_ESCAPE.test(lines[index - 1] ?? "")) return
    fail(abs, `inline "any" at line ${index + 1}. Type it, or add a lint-disable comment that says why.`)
  })
}

// The smallest unit ignored whole: a non-layer folder or file, a slice, or an unsliced segment.
function legacyUnit(abs) {
  const parts = partsUnderSrc(abs)
  if (!parts) return null
  if (!Object.hasOwn(RANK, parts[0]) || parts.length === 1) return parts.slice(0, 1)
  if (!SLICED.has(parts[0])) return parts.slice(0, 2)
  return parts.slice(0, describe(parts).sliceIndex + 1)
}

function writeBaseline() {
  const file = resolve(process.cwd(), args.config ?? "fsd.gate.json")
  const raw = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {}
  const before = new Set(Array.isArray(raw.ignore) ? raw.ignore : [])
  const added = new Set()
  for (const abs of failedPaths) {
    const unit = legacyUnit(abs)
    if (!unit) continue
    const entry = display(join(srcRoot, ...unit))
    if (!before.has(entry)) added.add(entry)
  }
  raw.ignore = [...before, ...added].sort()
  writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`)
  console.log(`Baseline: ${added.size} path(s) added to ignore in ${display(file)}`)
  for (const entry of [...added].sort()) console.log(`  ${entry}`)
  console.log("Size budget unchanged. Run the gate next; raising maxFiles or maxLines is the user's call.")
}

function checkComponent(abs, fileName, code) {
  if (/export\s+default\s+(?:async\s+)?function\s*\(/.test(code) || /export\s+default\s+(?:async\s+)?\([^)]*\)\s*=>/.test(code)) {
    fail(abs, "name the component. Anonymous default exports do not match the file.")
  }
  const names = componentNames(code)
  const namedByFile = !fileName.startsWith("index.")
  const expected = toPascal(fileName.replace(/\.jsx$/, "").replace(/\.tsx$/, ""))
  if (names.length > 1) fail(abs, `one component per file (found ${names.join(", ")}).`)
  if (namedByFile && names.length === 0) fail(abs, `exports no component named ${expected}.`)
  else if (namedByFile && names[0] !== expected) fail(abs, `component ${names[0]} does not match the file name. Expected ${expected}.`)
}

function checkImport(fromFile, spec, ctx) {
  const resolved = resolveSpecifier(fromFile, spec)
  if (!resolved) return
  const parts = partsUnderSrc(resolved)
  if (!parts) return
  if (ignored(resolved)) return
  const target = describe(parts)
  if (!target) {
    fail(fromFile, `imports ${spec}, outside the six layers.`)
    return
  }
  const sourceParts = partsUnderSrc(fromFile)
  const source = sourceParts ? describe(sourceParts) : null
  if (!source) return
  if (target.layerRank < source.layerRank) {
    fail(fromFile, `imports ${spec}. ${source.layer} cannot import ${target.layer}; imports go downward only.`)
    return
  }
  if (SLICED.has(target.layer) && !target.slice) {
    fail(fromFile, `imports ${spec}. Import a slice through ${target.layer}/<slice>, not the layer root.`)
    return
  }
  if (target.layer === source.layer && SLICED.has(target.layer)) {
    if (target.slice !== source.slice && !allowedCrossImport(source, target, parts)) {
      fail(fromFile, `imports ${spec}. Slices on ${target.layer} cannot import each other. On entities, expose the type through @x/${source.slice}.`)
    }
    return
  }
  if (!SLICED.has(target.layer) && source.layer === target.layer) return
  if (SLICED.has(target.layer)) {
    if (!isSlicePublicApi(target, parts)) {
      fail(fromFile, `imports ${spec}. Import ${target.layer}/${target.slice} through its index.ts public API.`)
    }
    return
  }
  if (!isSegmentPublicApi(parts)) {
    fail(fromFile, `imports ${spec}. Import ${target.layer}/${parts[1]} through that segment's public API, not a file inside it.`)
  }
}

function allowedCrossImport(source, target, parts) {
  if (source.layer !== "entities" || target.layer !== "entities") return false
  const rest = parts.slice(target.sliceIndex + 1)
  if (rest[0] !== "@x" || rest.length !== 2) return false
  const name = rest[1].replace(/\.tsx?$/, "")
  return name === source.slice
}

function isSlicePublicApi(target, parts) {
  const rest = parts.slice(target.sliceIndex + 1)
  if (rest.length === 0) return true
  return rest.length === 1 && isIndexName(rest[0])
}

function isSegmentPublicApi(parts) {
  const layer = parts[0]
  const rest = parts.slice(1)
  if (rest.length === 0) return false
  if (layer === "app" && rest.length === 1 && (APP_ROOT_FILES.has(rest[0]) || isIndexName(rest[0]))) return true
  const head = rest[0]
  const segment = head.replace(/\.tsx?$/, "")
  const folderOk = SEGMENTS.has(head) || (layer === "app" && APP_FOLDERS.has(head))
  if (rest.length === 1 && (SEGMENTS.has(segment) || folderOk)) return true
  return rest.length === 2 && folderOk && isIndexName(rest[1])
}

function isIndexName(name) {
  return name === "index" || name === "index.ts" || name === "index.tsx"
}

function describe(parts) {
  const layer = parts[0]
  if (!Object.prototype.hasOwnProperty.call(RANK, layer)) return null
  if (!SLICED.has(layer)) return { layer, layerRank: RANK[layer], slice: null, sliceIndex: 0 }
  let index = 1
  while (parts[index] && isTransparent(parts[index]) && !looksLikeSliceStop(parts, index)) index += 1
  return { layer, layerRank: RANK[layer], slice: parts[index] ?? null, sliceIndex: index }
}

function looksLikeSliceStop(parts, index) {
  // A transparent folder is the slice when the next entry is a segment, @x, or index file,
  // or when nothing follows it. Groups have another folder after them.
  const next = parts[index + 1]
  if (!next) return true
  if (next === "@x" || SEGMENTS.has(next)) return true
  if (next === "index.ts" || next === "index.tsx") return true
  return false
}

function isSliceEntries(entries) {
  return entries.some((entry) => {
    if (entry.isFile() && (entry.name === "index.ts" || entry.name === "index.tsx")) return true
    if (entry.isDirectory() && (SEGMENTS.has(entry.name) || entry.name === "@x")) return true
    return false
  })
}

function resolveSpecifier(fromFile, spec) {
  const clean = spec.replace(/[?#].*$/, "")
  if (clean.startsWith(".")) return resolve(dirname(fromFile), clean)
  for (const alias of aliases) {
    if (alias.star) {
      if (clean.startsWith(alias.from)) return join(alias.to, clean.slice(alias.from.length))
    } else if (clean === alias.from) return alias.to
  }
  const match = clean.match(/^(?:@\/|~\/)?(app|pages|widgets|features|entities|shared)(?:\/(.*))?$/)
  if (match) return join(srcRoot, match[1], match[2] ?? "")
  return null
}

function collectSpecs(code) {
  const specs = new Set()
  const fromRe = /\b(?:import|export)\b[\s\S]*?\bfrom\s+['"]([^'"]+)['"]/g
  const bareRe = /\bimport\s+['"]([^'"]+)['"]/g
  const dynamicRe = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g
  for (const re of [fromRe, bareRe, dynamicRe]) {
    for (const match of code.matchAll(re)) specs.add(match[1])
  }
  return specs
}

function componentNames(code) {
  const names = []
  const re = /(?:export\s+default\s+|export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(|(?:export\s+default\s+|export\s+)?const\s+([A-Za-z0-9_]+)\s*(?::[^=]+)?=\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z0-9_]+)\s*=>/g
  for (const match of code.matchAll(re)) {
    const name = match[1] || match[2]
    if (isComponentName(name)) names.push(name)
  }
  return names
}

function isComponentName(name) {
  return /^[A-Z][A-Za-z0-9]*$/.test(name) && /[a-z]/.test(name)
}

function toPascal(kebab) {
  return kebab.replace(/(^|-)(.)/g, (_, __, char) => char.toUpperCase())
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

function partsUnderSrc(abs) {
  const rel = relative(srcRoot, abs)
  if (rel.startsWith("..") || rel === "") return null
  return rel.split(/[/\\]/).filter(Boolean)
}

function ignored(abs) {
  const rel = relative(process.cwd(), abs).replace(/\\/g, "/")
  return config.ignore.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))
}

function fail(abs, message) {
  failedPaths.push(abs)
  violations.push(`${display(abs)}: ${message}`)
}

function display(abs) {
  const rel = relative(process.cwd(), abs).replace(/\\/g, "/")
  return rel || abs
}

function isTransparent(name) {
  return /^\(.*\)$/.test(name) || /^\[.*\]$/.test(name)
}

function isKebabFile(name) {
  if (name === "index.ts" || name === "index.tsx" || name === "index.js" || name === "index.jsx") return true
  const stem = name
    .replace(/\.(test|spec|stories|module|d)\.(tsx?|jsx?|css|scss)$/, "")
    .replace(/\.(tsx?|jsx?|mjs|cjs|css|scss|svg|png|jpe?g|webp|gif|json|md)$/, "")
  return KEBAB.test(stem)
}

function isTestLike(name) {
  return /\.(test|spec|stories)\.(tsx?|jsx?)$/.test(name)
}

function isComponentSource(name) {
  return name.endsWith(".tsx") || name.endsWith(".jsx")
}

function allowedComponentCompanion(component, name) {
  if (name === `${component}.tsx` || name === `${component}.jsx`) return true
  if (name === `${component}.test.tsx` || name === `${component}.test.ts`) return true
  if (name === `${component}.spec.tsx` || name === `${component}.spec.ts`) return true
  if (name === `${component}.stories.tsx`) return true
  if (name === `${component}.module.css` || name === `${component}.css` || name === `${component}.scss` || name === `${component}.module.scss`) return true
  return false
}

function allowedSrcRootFile(name) {
  return ROOT_FILES.has(name) || name.endsWith(".d.ts")
}

function allowedAppRootFile(name) {
  return APP_ROOT_FILES.has(name) || name.endsWith(".d.ts") || name.endsWith(".css")
}

function extension(name) {
  if (name.endsWith(".d.ts")) return ".d.ts"
  const index = name.lastIndexOf(".")
  return index === -1 ? "" : name.slice(index)
}

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function loadAliases(cwd) {
  const found = []
  for (const fileName of ["tsconfig.json", "tsconfig.app.json"]) {
    const file = join(cwd, fileName)
    if (!existsSync(file)) continue
    let parsed
    try {
      const text = (await readFile(file, "utf8"))
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/,\s*([}\]])/g, "$1")
      parsed = JSON.parse(text)
    } catch {
      continue
    }
    const options = parsed.compilerOptions ?? {}
    const base = options.baseUrl ? resolve(cwd, options.baseUrl) : cwd
    const paths = options.paths ?? {}
    for (const [key, targets] of Object.entries(paths)) {
      const target = Array.isArray(targets) ? targets[0] : null
      if (!target) continue
      const star = key.endsWith("/*")
      found.push({
        from: star ? key.slice(0, -1) : key,
        to: resolve(base, star ? target.slice(0, target.endsWith("/*") ? -1 : undefined) : target),
        star,
      })
    }
    if (found.length > 0) break
  }
  found.sort((a, b) => b.from.length - a.from.length)
  return found
}
