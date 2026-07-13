import type * as Monaco from 'monaco-editor'

const cadTypes = `
declare function h(type: any, attributes: any, ...children: any[]): any
declare const Fragment: any
declare const vars: any
type VarsTensor = number | readonly VarsTensor[]

declare module '@caemble/core' {
  type Tensor = number | readonly Tensor[]
  type Vars = Readonly<Record<string, Tensor>>
  export type Vec3 = readonly [number, number, number]
  export type Rotation = Readonly<{
    axis: Vec3
    angle: number
  }>
  export type GeometryAttributes<P extends object = object> = Readonly<
    P & {
      materials?: readonly Material[]
      pos?: Vec3
      rotate?: Rotation
      scale?: Vec3
      children?: unknown
    }
  >

  export type Geometry<P extends object = object> = (props: GeometryAttributes<P>) => unknown

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
  type Vec3 = readonly [number, number, number]
  type Rotation = Readonly<{
    axis: Vec3
    angle: number
  }>

  interface IntrinsicElements {
    box: { size: Vec3; pos?: Vec3; rotate?: Rotation; scale?: Vec3 }
    cylinder: { radius: number; height: number; segments?: number; pos?: Vec3; rotate?: Rotation; scale?: Vec3 }
    sphere: { radius: number; segments?: number; pos?: Vec3; rotate?: Rotation; scale?: Vec3 }
    array: {
      shape: readonly [number, number, number]
      period: Vec3
      axes?: Readonly<{ x: Vec3; y: Vec3; z: Vec3 }>
      inject?: Readonly<Record<string, VarsTensor | Readonly<{ axis: VarsTensor; angle: VarsTensor }>>>
      pos?: Vec3
      rotate?: Rotation
      scale?: Vec3
      children?: any
    }

    union: { pos?: Vec3; rotate?: Rotation; scale?: Vec3; children?: any }
    subtract: { pos?: Vec3; rotate?: Rotation; scale?: Vec3; children?: any }
    intersect: { pos?: Vec3; rotate?: Rotation; scale?: Vec3; children?: any }
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
