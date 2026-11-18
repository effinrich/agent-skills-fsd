import { formatFiles, getProjects, type Tree } from '@nx/devkit'
import { domainSlices, writeAgentsDoc, type AgentsDocFacts, type PublicExport } from './agents-doc'

interface FsdAgentsGeneratorSchema {
  project: string
  force?: boolean
}

// Writes the AGENTS.md for one project, scoped to its domain and layer. Nx has no generator for
// this, so the skill ships one. It reads the project tags, so the tags stay the source of truth.
//
// Copy this folder into an Nx plugin: tools/<plugin>/src/generators/fsd-agents/
// Register it in that plugin's generators.json.
export default async function (tree: Tree, options: FsdAgentsGeneratorSchema) {
  const projects = getProjects(tree)
  const config = projects.get(options.project)
  if (!config) {
    const known = [...projects.keys()].sort().join(', ')
    throw new Error(
      'No Nx project named "' +
        options.project +
        '". Known projects: ' +
        (known || 'none') +
        '.',
    )
  }

  const tags = (config.tags ?? []).map(String)
  const layer = tags.find((tag) => tag.startsWith('fsd:layer:'))?.slice('fsd:layer:'.length)
  if (!layer) {
    throw new Error(
      'Project "' +
        options.project +
        '" has no fsd:layer tag. Tag it first, for example fsd:layer:features.',
    )
  }
  const domain = tags.find((tag) => tag.startsWith('fsd:domain:'))?.slice('fsd:domain:'.length)
  const projectRoot = config.root
  const file = projectRoot + '/AGENTS.md'

  if (tree.exists(file) && !options.force) {
    throw new Error(
      file +
        ' already exists. Pass --force to regenerate it, or edit it by hand and stop using this generator for it.',
    )
  }

  const facts: AgentsDocFacts = {
    projectName: options.project,
    projectType: config.projectType === 'application' ? 'application' : 'library',
    projectRoot,
    layer,
    domain,
    tags,
    publicApi: config.projectType === 'application' ? [] : publicApi(tree, projectRoot),
    domainSlices: domain ? domainSlices(tree, domain) : [],
  }

  writeAgentsDoc(tree, facts)
  await formatFiles(tree)

  return () => Promise.resolve()
}

// The names the public API exports, read from src/index.ts so the document cannot drift from it.
function publicApi(tree: Tree, projectRoot: string): PublicExport[] {
  const read = tree.read(projectRoot + '/src/index.ts', 'utf-8')
  if (!read) return []
  const content = String(read)
  const found = new Map<string, PublicExport>()

  const named = /^export\s+(type\s+)?\{([^}]*)\}/gm
  for (const match of content.matchAll(named)) {
    const isType = Boolean(match[1])
    for (const raw of match[2].split(',')) {
      const name = raw.trim().split(/\s+as\s+/).pop()?.trim()
      if (!name) continue
      found.set(name, { name, isType })
    }
  }

  const declared = /^export\s+(?:async\s+)?(?:function|const|class|let)\s+([A-Za-z0-9_]+)/gm
  for (const match of content.matchAll(declared)) {
    const name = match[1]
    if (!found.has(name)) found.set(name, { name })
  }

  return [...found.values()]
}
