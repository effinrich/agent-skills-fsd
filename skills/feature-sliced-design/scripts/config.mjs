// Shared config for the Feature-Sliced gate.
//
// fsd.gate.json in the project root, when present:
// {
//   "src": "src",
//   "maxFiles": 80,
//   "maxLines": 4000,
//   "maxFileLines": 200,
//   "ignore": [],
//   "steiger": false,
//   "extra": []
// }

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

export function parseArgs(argv) {
  const out = {
    src: null,
    config: null,
    ignore: [],
    maxFiles: null,
    maxLines: null,
    maxFileLines: null,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => {
      const value = argv[++i]
      if (value === undefined) {
        throw new Error(`Missing value for ${arg}`)
      }
      return value
    }
    if (arg === "--src") out.src = next()
    else if (arg === "--config") out.config = next()
    else if (arg === "--ignore") out.ignore.push(next())
    else if (arg === "--max-files") out.maxFiles = number(next(), arg)
    else if (arg === "--max-lines") out.maxLines = number(next(), arg)
    else if (arg === "--max-file-lines") out.maxFileLines = number(next(), arg)
    else if (arg === "--baseline") out.baseline = true
    else if (arg === "-h" || arg === "--help") out.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return out
}

export function loadConfig(cwd, args) {
  const file = args.config ? resolve(cwd, args.config) : resolve(cwd, "fsd.gate.json")
  let raw = {}
  if (existsSync(file)) {
    raw = JSON.parse(readFileSync(file, "utf8"))
  }
  const ignore = [...(Array.isArray(raw.ignore) ? raw.ignore : []), ...args.ignore].map(normalizeIgnore)
  return {
    src: resolve(cwd, args.src ?? raw.src ?? "src"),
    maxFiles: args.maxFiles ?? raw.maxFiles ?? null,
    maxLines: args.maxLines ?? raw.maxLines ?? null,
    maxFileLines: args.maxFileLines ?? raw.maxFileLines ?? 200,
    ignore,
    steiger: raw.steiger === true,
    extra: Array.isArray(raw.extra) ? raw.extra : [],
  }
}

function number(value, flag) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} expects a non-negative integer, got ${value}`)
  }
  return parsed
}

function normalizeIgnore(entry) {
  return String(entry)
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/$/, "")
}
