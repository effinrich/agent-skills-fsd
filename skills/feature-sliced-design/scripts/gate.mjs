#!/usr/bin/env node
// One gate: architecture, then the size budget, then optional extra commands, then Steiger.
//
//   node gate.mjs [--config fsd.gate.json]
//
// Reads fsd.gate.json. extra commands and Steiger run only after the architecture check passes.
// Steiger runs only when "steiger" is true, and only if it is already installed (--no-install).

import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { loadConfig, parseArgs } from "./config.mjs"

const here = dirname(fileURLToPath(import.meta.url))

let args
try {
  args = parseArgs(process.argv.slice(2))
} catch (error) {
  console.error(error.message)
  process.exit(2)
}

if (args.help) {
  console.log("Usage: gate.mjs [--config fsd.gate.json]")
  process.exit(0)
}

const config = loadConfig(process.cwd(), args)
const validate = runNode("validate.mjs", process.argv.slice(2))
const budget = runNode("size-budget.mjs", process.argv.slice(2))
emit(validate)
emit(budget)

if (validate.status === 2) process.exit(2)
if (validate.status !== 0 || budget.status !== 0) process.exit(1)

for (const command of config.extra) {
  const result = spawnSync(command, { shell: true, encoding: "utf8", cwd: process.cwd() })
  emit(result, command)
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (config.steiger) {
  const result = spawnSync("npx --no-install steiger src", { shell: true, encoding: "utf8", cwd: process.cwd() })
  if (result.error || result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
    console.error(detail || "steiger failed.")
    console.error('Steiger is required by fsd.gate.json ("steiger": true) and must already be installed. The gate does not install it.')
    process.exit(result.status || 1)
  }
  emit(result)
}

process.exit(0)

function runNode(script, forwarded) {
  return spawnSync(process.execPath, [join(here, script), ...forwarded], {
    encoding: "utf8",
    cwd: process.cwd(),
  })
}

function emit(result, label) {
  if (label) console.log(`\n$ ${label}`)
  if (result.stdout) process.stdout.write(result.stdout.endsWith("\n") ? result.stdout : `${result.stdout}\n`)
  if (result.stderr) process.stderr.write(result.stderr.endsWith("\n") ? result.stderr : `${result.stderr}\n`)
}
