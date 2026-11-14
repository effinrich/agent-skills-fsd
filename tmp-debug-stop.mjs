import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const scripts = "D:/documents-from-c/GitHub/agent-skills-fsd/skills/feature-sliced-design/scripts"
const node = process.execPath
const dirtyRoot = mkdtempSync(join(tmpdir(), "fsd-dirty-"))
writeFileSync(join(dirtyRoot, "README.md"), "ok\n")
const git = (args) =>
  spawnSync("git", args, {
    cwd: dirtyRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@t",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@t",
    },
  })
git(["init"])
git(["add", "."])
git(["commit", "-m", "init"])
writeFileSync(join(dirtyRoot, "dirty.txt"), "x\n")
const failCmd = `${JSON.stringify(node)} -e "process.exit(1)"`
const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const id = `dirty-follow-${stamp}`
const payload = { cursor_version: "1", status: "completed", loop_count: 0, conversation_id: id }
console.log("failCmd", failCmd)
console.log("id", id)
const result = spawnSync(node, [join(scripts, "stop-gate.mjs"), failCmd], {
  cwd: dirtyRoot,
  encoding: "utf8",
  input: JSON.stringify(payload),
})
console.log("status", result.status)
console.log("stdout", result.stdout)
console.log("stderr", result.stderr)
const hash = createHash("sha256").update(id).digest("hex").slice(0, 16)
const file = join(tmpdir(), `fsd-gate-${hash}`)
console.log("attemptFile", file, existsSync(file) ? readFileSync(file, "utf8") : "missing")
const cwdHash = createHash("sha256").update(dirtyRoot).digest("hex").slice(0, 16)
const cwdFile = join(tmpdir(), `fsd-gate-${cwdHash}`)
console.log("cwdAttempt", cwdFile, existsSync(cwdFile) ? readFileSync(cwdFile, "utf8") : "missing")
rmSync(dirtyRoot, { recursive: true, force: true })
