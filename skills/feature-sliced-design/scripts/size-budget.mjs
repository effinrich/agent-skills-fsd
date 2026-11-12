#!/usr/bin/env node
// Count source files and non-blank lines. Exits 1 when over the budget.
//
//   node size-budget.mjs [--config fsd.gate.json] [--max-files 80] [--max-lines 4000] [--src src]
//
// A missing budget (no maxFiles and no maxLines) exits 0. Raising a limit is the user's call.

import { readdir, readFile, stat } from "node:fs/promises"
import { join, relative } from "node:path"
import { loadConfig, parseArgs } from "./config.mjs"

const SOURCE = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".scss"])

try {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log("Usage: size-budget.mjs [--max-files N] [--max-lines N] [--src dir]")
    process.exit(0)
  }
  const config = loadConfig(process.cwd(), args)
  if (config.maxFiles === null && config.maxLines === null) {
    console.log("size budget: not set (add maxFiles and maxLines to fsd.gate.json)")
    process.exit(0)
  }
  const counts = await countTree(config.src, config.ignore)
  const filesOver = config.maxFiles !== null && counts.files > config.maxFiles
  const linesOver = config.maxLines !== null && counts.lines > config.maxLines
  const fileLimit = config.maxFiles === null ? "none" : String(config.maxFiles)
  const lineLimit = config.maxLines === null ? "none" : String(config.maxLines)
  const summary = `size budget: ${counts.files} files, ${counts.lines} non-blank lines (limits ${fileLimit} / ${lineLimit})`
  if (!filesOver && !linesOver) {
    console.log(`OK ${summary}`)
    process.exit(0)
  }
  console.error(`FAIL ${summary}`)
  console.error("Cut scope. Raising maxFiles or maxLines in fsd.gate.json is the user's call.")
  process.exit(1)
} catch (error) {
  console.error(error.message)
  process.exit(2)
}

async function countTree(dir, ignore) {
  let files = 0
  let lines = 0
  if (!(await exists(dir))) return { files, lines }
  await walk(dir)
  return { files, lines }

  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue
      const abs = join(current, entry.name)
      if (isIgnored(abs, ignore)) continue
      if (entry.isDirectory()) {
        await walk(abs)
        continue
      }
      const ext = extension(entry.name)
      if (!SOURCE.has(ext)) continue
      files += 1
      const text = await readFile(abs, "utf8")
      for (const line of text.split(/\r?\n/)) {
        if (line.trim() !== "") lines += 1
      }
    }
  }
}

function isIgnored(abs, ignore) {
  const rel = relative(process.cwd(), abs).replace(/\\/g, "/")
  return ignore.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))
}

function extension(name) {
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
