// Paste these objects into the existing @nx/enforce-module-boundaries depConstraints.
// Same shape for ESLint flat config and for the Oxlint @nx/oxlint boundaries plugin.
// An app project is tagged fsd:layer:app. A slice is never the app.

export const fsdLayerConstraints = [
  {
    sourceTag: 'fsd:layer:app',
    onlyDependOnLibsWithTags: [
      'fsd:layer:pages',
      'fsd:layer:widgets',
      'fsd:layer:features',
      'fsd:layer:entities',
      'fsd:layer:shared',
    ],
  },
  {
    sourceTag: 'fsd:layer:pages',
    onlyDependOnLibsWithTags: [
      'fsd:layer:widgets',
      'fsd:layer:features',
      'fsd:layer:entities',
      'fsd:layer:shared',
    ],
  },
  {
    sourceTag: 'fsd:layer:widgets',
    onlyDependOnLibsWithTags: ['fsd:layer:features', 'fsd:layer:entities', 'fsd:layer:shared'],
  },
  {
    sourceTag: 'fsd:layer:features',
    onlyDependOnLibsWithTags: ['fsd:layer:entities', 'fsd:layer:shared'],
  },
  {
    sourceTag: 'fsd:layer:entities',
    onlyDependOnLibsWithTags: ['fsd:layer:shared'],
  },
  {
    sourceTag: 'fsd:layer:shared',
    onlyDependOnLibsWithTags: ['fsd:layer:shared'],
  },
]

// Add one of these per business domain. `shared` is the only domain other domains may import.
// { sourceTag: 'fsd:domain:catalog', onlyDependOnLibsWithTags: ['fsd:domain:catalog', 'fsd:domain:shared'] }
// { sourceTag: 'fsd:domain:account', onlyDependOnLibsWithTags: ['fsd:domain:account', 'fsd:domain:shared'] }
// { sourceTag: 'fsd:domain:shared', onlyDependOnLibsWithTags: ['fsd:domain:shared'] }
//
// Migrating an existing monorepo: tag untouched projects legacy-code, then add:
// { sourceTag: 'legacy-code', onlyDependOnLibsWithTags: ['legacy-code', 'fsd:layer:shared', 'fsd:layer:entities'] }
//
// Shared kernel (types/DTOs only) is still fsd:layer:shared + fsd:domain:shared under
// libs/shared/shared/kernel. Do not let domains import each other through it with behavior.
