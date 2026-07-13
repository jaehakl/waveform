import type * as Monaco from 'monaco-editor'

const cadTypes = `
declare function h(type: any, attributes: any, ...children: any[]): any
declare const Fragment: any
declare const vars: any

declare module '@caemble/core' {
  type Tensor = number | readonly Tensor[]
  type Vars = Readonly<Record<string, Tensor>>

  export class Material {
    constructor(name: string, vars: Record<string, Tensor>, displayColor?: string)
    readonly name: string
    readonly vars: Vars
    readonly displayColor: string
  }

  export class Structure {
    constructor(options: {
      geometry: () => unknown
      varsSchema: Record<string, {
        shape: number[]
        default: Tensor
        min?: Tensor
        max?: Tensor
      }>
    })
    readonly geometry: () => unknown
    readonly varsSchema: Readonly<Record<string, unknown>>
    randomVars(seed?: number): Vars
  }

  export class Sample {
    constructor(structure: Structure, partialVars?: Record<string, Tensor>)
    readonly structure: Structure
    readonly vars: Vars
  }
}

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

  typescript.typescriptDefaults.addExtraLib(cadTypes, 'file:///caemble-core.d.ts')
  didSetup = true
}
