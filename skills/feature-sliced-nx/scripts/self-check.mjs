#!/usr/bin/env node
// Temporary libraries for the Nx segment gate. Not part of a project's gate.

import { spawnSync } from "node:child_process"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const scripts = dirname(fileURLToPath(import.meta.url))
const node = process.execPath
let failed = 0

const root = mkdtempSync(join(tmpdir(), "fsd-nx-"))
try {
  writeTree(root, validLibrary("catalog", "features", "product-card"))
  expect("valid library", run("validate-segments.mjs", root), 0, "OK nx segments")
  expect("gate without nx.json", run("gate.mjs", root), 0, "boundary lint skipped")

  expectFail("fetch in ui", {
    "libs/catalog/features/product-card/src/lib/ui/product-card.tsx":
      'export function ProductCard() { fetch("/api"); return null }\n',
  }, "go in api")

  expectFail("effect in ui", {
    "libs/catalog/features/product-card/src/lib/ui/product-card.tsx":
      'import { useEffect } from "react"\nexport function ProductCard() { useEffect(() => {}, []); return null }\n',
  }, "go in model")

  expectFail("fetch in model", {
    "libs/catalog/features/product-card/src/lib/model/product-card.ts": 'export const load = () => fetch("/api")\n',
  }, "go in api")

  expectFail("react in api", {
    "libs/catalog/features/product-card/src/lib/api/product-card.ts":
      'import { useState } from "react"\nexport const load = () => null\n',
  }, "does not import React")

  expectFail("two components", {
    "libs/catalog/features/product-card/src/lib/ui/product-card.tsx":
      "export function ProductCard() { return null }\nexport function Badge() { return null }\n",
  }, "one component per file")

  expectFail("pascal file", {
    "libs/catalog/features/product-card/src/lib/ui/ProductCard.tsx": "export function ProductCard() { return null }\n",
  }, "kebab-case")

  expectFail("unknown segment", {
    "libs/catalog/features/product-card/src/lib/hooks/use-product.ts": "export {}\n",
  }, "unknown segment")

  expectFail("story exported", {
    "libs/catalog/features/product-card/src/index.ts": 'export { Default } from "./lib/ui/product-card.stories"\n',
  }, "public API")

  expectFail("missing tags", {
    "libs/catalog/features/product-card/project.json": '{ "name": "catalog-features-product-card", "tags": [] }\n',
  }, "fsd:layer:features")

  expectFail("line cap", {
    "libs/catalog/features/product-card/src/lib/model/product-card.ts": `${"export {}\n".repeat(201)}`,
  }, "at or under")

  expectFail("hand rolled path", {
    "libs/catalog/product-card/project.json":
      '{ "name": "product-card", "tags": ["fsd:layer:features", "fsd:domain:catalog"] }\n',
    "libs/catalog/product-card/src/index.ts": "export {}\n",
    "libs/catalog/product-card/src/lib/ui/product-card.tsx": "export function ProductCard() { return null }\n",
  }, "libs/<domain>/<layer>/<slice>")

  const ignored = mkdtempSync(join(tmpdir(), "fsd-nx-ignore-"))
  try {
    writeTree(ignored, {
      ...validLibrary("catalog", "features", "product-card"),
      "fsd.nx.json": '{ "libs": "libs", "maxFileLines": 200, "ignore": ["libs/legacy"] }\n',
      "libs/legacy/old/src/index.ts": "export {}\n",
      "libs/legacy/old/src/lib/hooks/use-old.ts": "export {}\n",
    })
    expect("ignore legacy", run("validate-segments.mjs", ignored), 0, "OK nx segments")
  } finally {
    rmSync(ignored, { recursive: true, force: true })
  }

  const missing = mkdtempSync(join(tmpdir(), "fsd-nx-missing-"))
  try {
    expect("missing libs", run("validate-segments.mjs", missing), 2, "does not exist")
  } finally {
    rmSync(missing, { recursive: true, force: true })
  }

  const cursor = { cwd: root, sandbox: false, cursor_version: "1" }
  expect("shell allows status", pipe("shell-guard.mjs", { ...cursor, command: "git status" }), 0, '"permission":"allow"')
  expect("shell denies no-verify", pipe("shell-guard.mjs", { ...cursor, command: "git commit --no-verify -m x" }), 0, '"permission":"deny"')
} finally {
  rmSync(root, { recursive: true, force: true })
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log("\nOK nx self-check")

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
  const dir = mkdtempSync(join(tmpdir(), "fsd-nx-bad-"))
  try {
    writeTree(dir, { ...validLibrary("catalog", "features", "product-card"), ...files })
    expect(name, run("validate-segments.mjs", dir), 1, needle)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function run(script, cwd) {
  return spawnSync(node, [join(scripts, script)], { cwd, encoding: "utf8" })
}

function pipe(script, payload) {
  return spawnSync(node, [join(scripts, script)], { cwd: root, encoding: "utf8", input: JSON.stringify(payload) })
}

function writeTree(dir, files) {
  for (const [file, body] of Object.entries(files)) {
    const abs = join(dir, ...file.split("/"))
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, body)
  }
}

function validLibrary(domain, layer, slice) {
  const root = `libs/${domain}/${layer}/${slice}`
  return {
    [`${root}/project.json`]: `${JSON.stringify({ name: `${domain}-${layer}-${slice}`, tags: [`fsd:layer:${layer}`, `fsd:domain:${domain}`] }, null, 2)}\n`,
    [`${root}/src/index.ts`]: `export { ProductCard } from "./lib/ui/${slice}"\nexport type { ProductCardProps } from "./lib/ui/${slice}"\n`,
    [`${root}/src/lib/ui/${slice}.tsx`]: `export interface ProductCardProps { title?: string }\nexport function ProductCard({ title = "ProductCard" }: ProductCardProps) {\n  return title\n}\n`,
    [`${root}/src/lib/model/${slice}.ts`]: "export {}\n",
    [`${root}/src/lib/api/.gitkeep`]: "",
  }
}
