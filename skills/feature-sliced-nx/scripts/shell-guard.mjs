#!/usr/bin/env node
// Shell hook for Cursor (beforeShellExecution) and Claude Code (PreToolUse on Bash).
// Denies commands that skip git hooks. Prints only the host's JSON schema on stdout.

const input = await readStdin()
const command = commandOf(input)
const reason = command ? bypass(command) : null

if (!reason) {
  process.stdout.write(`${JSON.stringify(allow(input))}\n`)
  process.exit(0)
}

const text = `Blocked: this command skips git hooks (${reason}). The gate runs on commit, push, and CI. Run the command without the bypass.`
process.stdout.write(`${JSON.stringify(deny(input, text))}\n`)
process.exit(0)

function commandOf(hookInput) {
  if (typeof hookInput.command === "string" && hookInput.tool_input == null) return hookInput.command
  if (typeof hookInput.tool_input?.command === "string") return hookInput.tool_input.command
  if (typeof hookInput.command === "string") return hookInput.command
  return ""
}

function allow(hookInput) {
  if (isClaude(hookInput)) {
    return {
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow" },
    }
  }
  return { permission: "allow" }
}

function deny(hookInput, text) {
  if (isClaude(hookInput)) {
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: text,
      },
    }
  }
  return { permission: "deny", user_message: text, agent_message: text }
}

function isClaude(hookInput) {
  return hookInput.cursor_version == null && (hookInput.tool_input != null || hookInput.hook_event_name === "PreToolUse")
}

function bypass(command) {
  for (const segment of command.split(/\r?\n|&&|\|\||;/)) {
    const env = envBypass(segment)
    if (env) return env
    const flag = flagBypass(segment)
    if (flag) return flag
    if (commitShortN(segment)) return "git commit -n"
  }
  return null
}

function envBypass(segment) {
  const tokens = tokenize(segment)
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (skipsValue(token)) {
      i += 1
      continue
    }
    if (token === "LEFTHOOK=0") return "LEFTHOOK=0"
    if (token === "HUSKY=0" || token === "HUSKY_SKIP_HOOKS" || token.startsWith("HUSKY_SKIP_HOOKS=")) return "HUSKY"
  }
  return null
}

function flagBypass(segment) {
  const tokens = tokenize(segment)
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (skipsValue(token)) {
      i += 1
      continue
    }
    if (token === "--no-verify") return "--no-verify"
    if (token === "--hooks-path" || token.startsWith("--hooks-path=")) return "hooks-path"
    if (token.includes("core.hooksPath")) return "core.hooksPath"
  }
  return null
}

function commitShortN(segment) {
  const tokens = tokenize(segment)
  const git = tokens.indexOf("git")
  if (git < 0) return false
  const rest = tokens.slice(git)
  const commitAt = rest.indexOf("commit")
  if (commitAt < 0) return false
  for (let i = commitAt + 1; i < rest.length; i++) {
    const token = rest[i]
    if (token === "--") break
    if (skipsValue(token)) {
      i += 1
      continue
    }
    if (/^-[A-Za-z]*n[A-Za-z]*$/.test(token)) return true
  }
  return false
}

function skipsValue(token) {
  return token === "-m" || token === "--message" || token === "-F" || token === "--file"
}

function tokenize(segment) {
  const tokens = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  for (const match of segment.matchAll(re)) tokens.push(match[1] ?? match[2] ?? match[3])
  return tokens
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
