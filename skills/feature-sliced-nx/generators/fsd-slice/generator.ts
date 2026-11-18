import { formatFiles, names, readNxJson, type GeneratorCallback, type Tree } from '@nx/devkit'
import { libraryGenerator, storybookConfigurationGenerator } from '@nx/react'

interface FsdSliceGeneratorSchema {
  name: string
  domain: string
  layer: 'shared' | 'entities' | 'features' | 'widgets' | 'pages'
  storybook?: boolean
  unitTestRunner?: 'vitest' | 'jest' | 'none'
}

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Copy this file into an Nx plugin: tools/<plugin>/src/generators/fsd-slice/generator.ts
// Register it in that plugin's generators.json. Do not pass projectNameAndRootFormat;
// current @nx/react:library takes `directory` as the project root.
export default async function (tree: Tree, options: FsdSliceGeneratorSchema) {
  const slice = names(options.name).fileName
  const domain = names(options.domain).fileName
  if (!KEBAB.test(slice) || !KEBAB.test(domain)) {
    throw new Error('Slice and domain names must be kebab-case.')
  }

  const { className, fileName } = names(slice)
  const projectDirectory = `libs/${domain}/${options.layer}/${fileName}`
  const projectName = `${domain}-${options.layer}-${fileName}`
  const tags = `fsd:layer:${options.layer},fsd:domain:${domain}`
  // npmScope is not in the NxJsonConfiguration type in @nx/devkit 24, but it is there.
  const scope = (readNxJson(tree) as { npmScope?: string } | undefined)?.npmScope
  const tasks: GeneratorCallback[] = []

  const afterLibrary = await libraryGenerator(tree, {
    directory: projectDirectory,
    name: projectName,
    tags,
    style: 'css',
    bundler: 'none',
    unitTestRunner: options.unitTestRunner ?? 'vitest',
    component: false,
    skipFormat: true,
    ...(scope ? { importPath: `@${scope}/${projectName}` } : {}),
  })
  if (afterLibrary) tasks.push(afterLibrary)

  const srcPath = `${projectDirectory}/src`
  for (const leftover of [
    `${srcPath}/lib/${fileName}.tsx`,
    `${srcPath}/lib/${fileName}.spec.tsx`,
    `${srcPath}/lib/${fileName}.spec.ts`,
  ]) {
    if (tree.exists(leftover)) tree.delete(leftover)
  }

  tree.write(`${srcPath}/lib/model/.gitkeep`, '')
  tree.write(`${srcPath}/lib/api/.gitkeep`, '')

  const componentDir = `${srcPath}/lib/ui`
  tree.write(
    `${componentDir}/${fileName}.tsx`,
    `export interface ${className}Props {
  title?: string
}

export function ${className}({ title = '${className}' }: ${className}Props) {
  return <div>{title}</div>
}
`,
  )

  writePublicApi(tree, srcPath, className, fileName)

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
