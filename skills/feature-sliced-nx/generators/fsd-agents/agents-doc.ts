import { type Tree } from '@nx/devkit'

// The domain scoped AGENTS.md for one project. The generator owns this file, so it can be
// regenerated after a slice moves, changes layer, or gets a new public API.

// Markdown code spans are assembled with BT so this file carries no backtick of its own.
const BT = String.fromCharCode(96)

export interface PublicExport {
  name: string
  isType?: boolean
}

export interface AgentsDocFacts {
  projectName: string
  projectType: 'application' | 'library'
  projectRoot: string
  layer: string
  domain?: string
  tags: string[]
  publicApi: PublicExport[]
  domainSlices: string[]
}

interface LayerRule {
  mayImport: string
  belongs: string
  notHere: string
}

const LAYER_RULES: Record<string, LayerRule> = {
  app: {
    mayImport: 'pages, widgets, features, entities and shared',
    belongs:
      'The app shell: routing, global styles, the entry point, and any server code the app hosts.',
    notHere:
      'Pages, features or entities. The app does not grow src/features or src/pages, and it never imports another application.',
  },
  pages: {
    mayImport: 'widgets, features, entities and shared',
    belongs: 'One route screen, with the composition that only this page uses.',
    notHere:
      'A reused action (that is a feature), a reused domain model (that is an entity), or kit UI (that is shared). Never another page.',
  },
  widgets: {
    mayImport: 'features, entities and shared',
    belongs: 'A UI composition reused across pages, built only from features and lower layers.',
    notHere:
      'Business rules, or a parking place for a page. widgets is discouraged: reach for pages, features or shared first.',
  },
  features: {
    mayImport: 'entities and shared',
    belongs: 'One reused user action: its state, its API calls and the UI it drives.',
    notHere:
      'A page shell, a reusable domain model (that is an entity), or kit UI (that is shared). Never another feature.',
  },
  entities: {
    mayImport: 'shared code only',
    belongs: 'One reused domain model: its types, its data and its pure rules.',
    notHere: 'UI components, React state, or network calls. Never a feature and never another domain.',
  },
  shared: {
    mayImport: 'other shared projects only',
    belongs: 'Code with no business rules: kit UI, the API client, DTOs and helpers.',
    notHere: 'Business rules or domain models. Shared code stays domain free.',
  },
}

const LAYER_ORDER = ['app', 'pages', 'widgets', 'features', 'entities', 'shared']

function code(text: string): string {
  return BT + text + BT
}

export function buildAgentsDoc(facts: AgentsDocFacts): string {
  const rule = LAYER_RULES[facts.layer] ?? {
    mayImport: 'nothing above its own layer',
    belongs: 'Code that belongs to this layer.',
    notHere: 'Code that belongs to another layer.',
  }
  const lines: string[] = []

  lines.push('# ' + facts.projectName)
  lines.push('')
  lines.push(
    'Instructions for this project. The workspace rules live in the root ' +
      code('AGENTS.md') +
      '; this file narrows them to this one domain and layer.',
  )
  lines.push('')
  lines.push('| | |')
  lines.push('| --- | --- |')
  lines.push('| Nx project | ' + code(facts.projectName) + ' |')
  lines.push('| Project type | ' + code(facts.projectType) + ' |')
  lines.push('| Layer | ' + code(facts.layer) + ' |')
  lines.push('| Domain | ' + (facts.domain ? code(facts.domain) : 'none (the app shell)') + ' |')
  lines.push('| Path | ' + code(facts.projectRoot) + ' |')
  lines.push('| Tags | ' + facts.tags.map(code).join(', ') + ' |')
  lines.push('')

  lines.push(facts.domain ? '## One domain' : '## Domains')
  lines.push('')
  if (facts.domain) {
    lines.push('This project is part of the ' + code(facts.domain) + ' domain.')
    lines.push('')
    if (facts.domainSlices.length > 0) {
      lines.push('The ' + code(facts.domain) + ' domain holds:')
      lines.push('')
      for (const slice of facts.domainSlices) {
        lines.push('- ' + code(slice))
      }
      lines.push('')
    }
    if (facts.domain === 'shared') {
      lines.push(
        'A ' + code('shared') +
          ' project may not import a business domain. Shared code stays domain free.',
      )
    } else {
      lines.push(
        'A ' + code(facts.domain) + ' project may import ' + code(facts.domain) +
          ' and ' + code('shared') +
          '. It must not import another business domain.',
      )
    }
  } else {
    lines.push(
      'The app is not part of a domain. It may import any slice in the workspace, and nothing imports the app.',
    )
  }
  lines.push('')

  lines.push('## Layer')
  lines.push('')
  lines.push(
    code(facts.layer) + ' is ' + layerPosition(facts.layer) + '. It may import ' +
      rule.mayImport + '.',
  )
  lines.push('')

  lines.push('## What belongs here')
  lines.push('')
  lines.push(rule.belongs)
  lines.push('')

  lines.push('## What does not belong here')
  lines.push('')
  lines.push(rule.notHere)
  lines.push('')

  lines.push('## Public API')
  lines.push('')
  if (facts.projectType === 'application') {
    lines.push(
      'The app has no public API. Other projects do not import it; the browser loads its entry point.',
    )
  } else {
    lines.push(
      'Other projects import this project only through ' + code('src/index.ts') +
        '. A deep import into ' + code('src/lib') + ' is a boundary error.',
    )
    lines.push('')
    if (facts.publicApi.length > 0) {
      lines.push('Current exports:')
      lines.push('')
      for (const entry of facts.publicApi) {
        lines.push('- ' + code(entry.name) + (entry.isType ? ' (type)' : ''))
      }
    } else {
      lines.push('No public exports yet.')
    }
  }
  lines.push('')

  if (facts.projectType === 'library') {
    lines.push('## Segments')
    lines.push('')
    lines.push('- ' + code('ui/') + ' markup and wiring. One component per file, kebab-case, named after the component.')
    lines.push('- ' + code('model/') + ' state, effects, hooks and types.')
    lines.push('- ' + code('api/') + ' requests. No React.')
    lines.push('- ' + code('lib/') + ' pure helpers. No React.')
    lines.push('- ' + code('config/') + ' constants and fixed values. No React.')
    lines.push('')
    lines.push('Delete the segment folders this project does not use.')
    lines.push('')
  }

  lines.push('## Verify')
  lines.push('')
  lines.push('- ' + code('npx nx typecheck ' + facts.projectName))
  lines.push('- ' + code('npx nx lint ' + facts.projectName))
  lines.push('- ' + code('node .agents/skills/feature-sliced-nx/scripts/gate.mjs'))
  lines.push('')

  return lines.join('\n')
}

export function writeAgentsDoc(tree: Tree, facts: AgentsDocFacts): void {
  tree.write(facts.projectRoot + '/AGENTS.md', buildAgentsDoc(facts))
}

// The slices under libs/<domain>, read from the tree so a slice being generated counts too.
export function domainSlices(tree: Tree, domain: string): string[] {
  const base = 'libs/' + domain
  if (!tree.exists(base)) return []
  const slices: string[] = []
  for (const layer of tree.children(base)) {
    for (const slice of tree.children(base + '/' + layer)) {
      if (tree.exists(base + '/' + layer + '/' + slice + '/project.json')) {
        slices.push(layer + '/' + slice)
      }
    }
  }
  return slices.sort()
}

function layerPosition(layer: string): string {
  const index = LAYER_ORDER.indexOf(layer)
  if (index === -1) return 'a layer the skill does not describe'
  if (index === 0) return 'the top layer'
  const above = LAYER_ORDER[index - 1]
  const below = LAYER_ORDER[index + 1]
  return below
    ? 'below ' + code(above) + ' and above ' + code(below)
    : 'below ' + code(above)
}
