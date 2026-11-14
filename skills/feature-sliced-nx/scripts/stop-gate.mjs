#!/usr/bin/env node
// Stop hook for Cursor and Claude Code.
// Skips a clean git tree. Otherwise runs the gate and, on failure, sends the agent back.
// Cursor: stdout { "followup_message" } and exit 0. Claude Code Stop: { "decision": "block", "reason" }.
// Three failures in one conversation end the loop; stderr keeps the last output.
//
//   node stop-gate.mjs [gate command]
//
// With no argument, runs package.json "gate" when it exists, otherwise the bundled gate.mjs.

import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const MAX_ATTEMPTS = 3
const here = dirname(fileURLToPath(import.meta.url))

const input = await readStdin()
if (input.status && input.status !== "completed") {
  process.stdout.write("{}\n")
  process.exit(0)
}

const dirty = isDirty(process.cwd())
if (!dirty) {
  clearAttempts(input)
  process.stdout.write("{}\n")
  process.exit(0)
}

const attempts = readAttempts(input)
if (attempts >= MAX_ATTEMPTS || (typeof input.loop_count === "number" && input.loop_count >= MAX_ATTEMPTS)) {
  process.stderr.write("gate still failing after 3 attempts; not sending the agent back again.\n")
  process.stdout.write("{}\n")
  process.exit(0)
}

const command = process.argv[2] ?? defaultGate()
const result = spawnSync(command, { shell: true, encoding: "utf8", cwd: process.cwd() })
if ((result.status ?? 1) === 0) {
  clearAttempts(input)
  process.stdout.write("{}\n")
  process.exit(0)
}

writeAttempts(input, attempts + 1)
const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim().slice(0, 6000)
const message = [
  "The gate failed. Fix these violations before stopping.",
  "Do not raise fsd.nx.json maxFileLines, widen ignore, retag a library, or set the boundary rule to warn. Those are the user's call.",
  "If a violation is in a file you did not touch, report it and leave that file alone.",
  "",
  output || `Gate command failed: ${command}`,
].join("\n")

process.stdout.write(`${JSON.stringify(stopPayload(input, message))}\n`)
process.exit(0)

function stopPayload(hookInput, message) {
  const claude = hookInput.hook_event_name === "Stop" && hookInput.cursor_version == null && hookInput.loop_count == null
  if (claude) return { decision: "block", reason: message }
  return { followup_message: message }
}

function defaultGate() {
  const pkgPath = join(process.cwd(), "package.json")
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
      if (pkg.scripts?.gate) return `${packageManager()} run gate`
    } catch {
      // Fall through to the bundled gate.
    }
  }
  return `"${process.execPath}" "${join(here, "gate.mjs")}"`
}

function packageManager() {
  if (existsSync(join(process.cwd(), "bun.lock")) || existsSync(join(process.cwd(), "bun.lockb"))) return "bun"
  if (existsSync(join(process.cwd(), "pnpm-lock.yaml"))) return "pnpm"
  if (existsSync(join(process.cwd(), "yarn.lock"))) return "yarn"
  return "npm"
}

function isDirty(cwd) {
  const result = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8", cwd })
  if (result.status !== 0) return true
  return result.stdout.trim() !== ""
}

function attemptFile(hookInput) {
  const key = hookInput.conversation_id || hookInput.session_id || process.cwd()
  const hash = createHash("sha256").update(String(key)).digest("hex").slice(0, 16)
  return join(tmpdir(), `fsd-nx-gate-${hash}`)
}

function readAttempts(hookInput) {
  const file = attemptFile(hookInput)
  if (!existsSync(file)) return 0
  const value = Number(readFileSync(file, "utf8"))
  return Number.isInteger(value) ? value : 0
}

function writeAttempts(hookInput, count) {
  writeFileSync(attemptFile(hookInput), String(count))
}

function clearAttempts(hookInput) {
  const file = attemptFile(hookInput)
  if (existsSync(file)) unlinkSync(file)
}

async function readStdin() {
  if (process.stdin.isTTY) return {}
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString("utf8").trim()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}
