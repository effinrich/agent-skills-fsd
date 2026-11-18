import { formatFiles, names, readNxJson, updateJson, writeJson, type GeneratorCallback, type Tree } from '@nx/devkit'
import { storybookConfigurationGenerator } from '@nx/react'

interface FsdSliceGeneratorSchema {
  name: string
  domain: string
  layer: 'shared' | 'entities' | 'features' | 'widgets' | 'pages'
  storybook?: boolean
  unitTestRunner?: 'vitest' | 'jest' | 'none'
}

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// This generator writes the slice itself. It does not call the framework generator, because that
// drops the framework's own conventions into every slice and rewrites the shared root config each
// time it runs. The skill owns the pattern, so the skill writes the files.
//
// Copy this file into an Nx plugin: tools/<plugin>/src/generators/fsd-slice/generator.ts
// Register it in that plugin's generators.json.
export default async function (tree: Tree, options: FsdSliceGeneratorSchema) {
  const slice = names(options.name).fileName
  const domain = names(options.domain).fileName
  if (!KEBAB.test(slice) || !KEBAB.test(domain)) {
    throw new Error('Slice and domain names must be kebab-case.')
  }

  const { className, fileName } = names(slice)
  const projectDirectory = `libs/${domain}/${options.layer}/${fileName}`
  const projectName = `${domain}-${options.layer}-${fileName}`
  const tags = [`fsd:layer:${options.layer}`, `fsd:domain:${domain}`]
  // npmScope is not in the NxJsonConfiguration type in @nx/devkit 24, but it is there.
  const scope = (readNxJson(tree) as { npmScope?: string } | undefined)?.npmScope
  const up = '../'.repeat(projectDirectory.split('/').length)
  const tasks: GeneratorCallback[] = []

  if (tree.exists(`${projectDirectory}/project.json`)) {
    throw new Error(`${projectDirectory} already exists.`)
  }

  writeJson(tree, `${projectDirectory}/project.json`, {
    name: projectName,
    $schema: `${up}node_modules/nx/schemas/project-schema.json`,
    sourceRoot: `${projectDirectory}/src`,
    projectType: 'library',
    tags,
    '// targets': `to see all targets run: nx show project ${projectName} --web`,
    targets: {},
  })

  writeJson(tree, `${projectDirectory}/tsconfig.json`, {
    compilerOptions: {
      jsx: 'react-jsx',
      allowJs: false,
      allowSyntheticDefaultImports: true,
    },
    files: [],
    include: [],
    references: [{ path: './tsconfig.lib.json' }],
    extends: `${up}tsconfig.base.json`,
  })

  writeJson(tree, `${projectDirectory}/tsconfig.lib.json`, {
    extends: './tsconfig.json',
    compilerOptions: {
      outDir: `${up}dist/out-tsc`,
    },
    exclude: [
      'jest.config.ts',
      'jest.config.cts',
      'src/**/*.spec.ts',
      'src/**/*.test.ts',
      'src/**/*.spec.tsx',
      'src/**/*.test.tsx',
      'src/**/*.spec.js',
      'src/**/*.test.js',
      'src/**/*.spec.jsx',
      'src/**/*.test.jsx',
    ],
    include: ['src/**/*.js', 'src/**/*.jsx', 'src/**/*.ts', 'src/**/*.tsx'],
  })

  const runner = options.unitTestRunner ?? 'none'
  if (runner !== 'none') {
    writeJson(tree, `${projectDirectory}/tsconfig.spec.json`, {
      extends: './tsconfig.json',
      compilerOptions: {
        outDir: `${up}dist/out-tsc`,
        types: ['node', runner],
      },
      include: [
        'src/**/*.spec.ts',
        'src/**/*.spec.tsx',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
      ],
    })
  }

  // An ESLint workspace needs the slice config to import the root one, or the root rules never
  // reach the slice. A workspace that lints with oxlint needs no per-slice config at all.
  const rootEslint = ['eslint.config.mjs', 'eslint.config.js', 'eslint.config.cjs'].find((file) =>
    tree.exists(file),
  )
  if (rootEslint) {
    tree.write(
      `${projectDirectory}/eslint.config.mjs`,
      [
        "import nx from '@nx/eslint-plugin';",
        `import baseConfig from '${up}${rootEslint}';`,
        '',
        'export default [',
        "  ...nx.configs['flat/react'],",
        '  ...baseConfig,',
        '  {',
        "    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],",
        '    rules: {},',
        '  },',
        '];',
        '',
      ].join('\n'),
    )
  }

  const srcPath = `${projectDirectory}/src`
  tree.write(`${srcPath}/lib/model/.gitkeep`, '')
  tree.write(`${srcPath}/lib/api/.gitkeep`, '')

  const componentDir = `${srcPath}/lib/ui`
  tree.write(
    `${componentDir}/${fileName}.tsx`,
    `export interface ${className}Props {\n  title?: string\n}\n\nexport function ${className}({ title = '${className}' }: ${className}Props) {\n  return <div>{title}</div>\n}\n`,
  )

  writePublicApi(tree, srcPath, className, fileName)

  // The slice joins the root project references, so the workspace typecheck builds it.
  if (tree.exists('tsconfig.json')) {
    updateJson(tree, 'tsconfig.json', (json) => {
      json.references ??= []
      if (!json.references.some((reference: { path?: string }) => reference.path === `./${projectDirectory}`)) {
        json.references.push({ path: `./${projectDirectory}` })
      }
      return json
    })
  }

  // Other projects import the slice by its public path, never by a deep path.
  if (scope && tree.exists('tsconfig.base.json')) {
    updateJson(tree, 'tsconfig.base.json', (json) => {
      json.compilerOptions ??= {}
      json.compilerOptions.paths ??= {}
      json.compilerOptions.paths[`@${scope}/${projectName}`] = [`./${projectDirectory}/src/index.ts`]
      return json
    })
  }

  if (options.storybook) {
    const afterStorybook = await storybookConfigurationGenerator(tree, {
      project: projectName,
      configureStaticServe: true,
      generateStories: true,
      interactionTests: true,
    })
    if (afterStorybook) tasks.push(afterStorybook)
    writePublicApi(tree, srcPath, className, fileName)
  }

  await formatFiles(tree)

  return async () => {
    for (const task of tasks) {
      await task()
    }
  }
}

function writePublicApi(tree: Tree, srcPath: string, className: string, fileName: string) {
  tree.write(
    `${srcPath}/index.ts`,
    `export { ${className} } from './lib/ui/${fileName}'\nexport type { ${className}Props } from './lib/ui/${fileName}'\n`,
  )
}
