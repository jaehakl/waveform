import type * as Monaco from 'monaco-editor'
import coreTypes from '../cad/api/caemble-core.d.ts?raw'
import jsxTypes from '../cad/api/cad-jsx.d.ts?raw'

let didSetup = false

type MonacoTypescriptApi = {
  JsxEmit: {
    React: unknown
  }
  ModuleKind: {
    ESNext: unknown
  }
  ModuleResolutionKind: {
    NodeJs: unknown
  }
  ScriptTarget: {
    ES2020: unknown
  }
  typescriptDefaults: {
    addExtraLib: (content: string, filePath?: string) => void
    setCompilerOptions: (options: Record<string, unknown>) => void
  }
}

export function setupMonaco(monaco: typeof Monaco) {
  if (didSetup) return

  const typescript = monaco.languages.typescript as unknown as MonacoTypescriptApi

  typescript.typescriptDefaults.setCompilerOptions({
    target: typescript.ScriptTarget.ES2020,
    module: typescript.ModuleKind.ESNext,
    moduleResolution: typescript.ModuleResolutionKind.NodeJs,
    allowNonTsExtensions: true,
    jsx: typescript.JsxEmit.React,
    jsxFactory: 'h',
    jsxFragmentFactory: 'Fragment',
    strict: true,
    noEmit: true,
  })

  typescript.typescriptDefaults.addExtraLib(coreTypes, 'file:///node_modules/@caemble/core/index.d.ts')
  typescript.typescriptDefaults.addExtraLib(coreTypes, 'file:///caemble-api/caemble-core.d.ts')
  typescript.typescriptDefaults.addExtraLib(jsxTypes, 'file:///caemble-api/cad-jsx.d.ts')
  didSetup = true
}
