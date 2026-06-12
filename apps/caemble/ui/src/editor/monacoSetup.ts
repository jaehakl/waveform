import type * as Monaco from 'monaco-editor'

const cadTypes = `
declare function h(type: any, props: any, ...children: any[]): any
declare const Fragment: any

declare namespace JSX {
  type Vec3 = [number, number, number]

  interface IntrinsicElements {
    box: { size: Vec3 }
    cylinder: { radius: number; height: number; segments?: number }
    sphere: { radius: number; segments?: number }

    translate: {
      offset?: Vec3
      x?: number
      y?: number
      z?: number
      children?: any
    }

    rotate: {
      angles?: Vec3
      x?: number
      y?: number
      z?: number
      children?: any
    }

    scale: {
      factors?: Vec3
      x?: number
      y?: number
      z?: number
      children?: any
    }

    union: { children?: any }
    subtract: { children?: any }
    intersect: { children?: any }
  }
}
`

let didSetup = false

type MonacoTypescriptApi = {
  JsxEmit: {
    React: unknown
  }
  ModuleKind: {
    ESNext: unknown
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
    allowNonTsExtensions: true,
    jsx: typescript.JsxEmit.React,
    jsxFactory: 'h',
    jsxFragmentFactory: 'Fragment',
    strict: true,
    noEmit: true,
  })

  typescript.typescriptDefaults.addExtraLib(cadTypes, 'file:///cad-jsx.d.ts')
  didSetup = true
}
