export type Tensor = number | readonly Tensor[]
export type Vars = Readonly<Record<string, Tensor>>
export type Vec3 = readonly [number, number, number]
export type Rotation = Readonly<{ axis: Vec3; angle: number }>
export type StructureGroupMap = Readonly<Record<string, readonly string[]>>
export type VarsSchemaEntry = Readonly<{
  shape: readonly number[]
  default: Tensor
  min?: Tensor
  max?: Tensor
}>
export type ExperimentTarget = `${'experiment' | 'structure'}.${'geometry' | 'surface'}.${string}`
export type ExperimentRule<T> = Readonly<{
  target: readonly ExperimentTarget[]
  value: T
}>

export type BoxAttributes = Readonly<{
  size: Vec3
  pos?: Vec3
  rotate?: Rotation
  scale?: Vec3
}>

export type CylinderAttributes = Readonly<{
  radius: number
  radius_2?: number
  height: number
  segments?: number
  pos?: Vec3
  rotate?: Rotation
  scale?: Vec3
}>

export type CurvedEdgeCylinderFourierMode = Readonly<{
  amplitude: number
  phase: number
}>
export type CurvedEdgeCylinderTaylorCurve = Readonly<{
  origin: number
  coefficients: readonly number[]
}>
export type CurvedEdgeCylinderAttributes = Readonly<{
  height: number
  azimuthalCurve: readonly CurvedEdgeCylinderFourierMode[]
  verticalCurve: CurvedEdgeCylinderTaylorCurve
  azimuthalSegments?: number
  verticalSegments?: number
  pos?: Vec3
  rotate?: Rotation
  scale?: Vec3
}>

export type CurvedSurfaceSphereFourierMode = Readonly<{
  amplitude: number
  phase: number
}>
export type CurvedSurfaceSphereAttributes = Readonly<{
  azimuthalCurve: readonly CurvedSurfaceSphereFourierMode[]
  polarCurve: readonly CurvedSurfaceSphereFourierMode[]
  azimuthalSegments?: number
  polarSegments?: number
  pos?: Vec3
  rotate?: Rotation
  scale?: Vec3
}>

export type SphereAttributes = Readonly<{
  radius: number
  segments?: number
  pos?: Vec3
  rotate?: Rotation
  scale?: Vec3
}>

export type FiberFourierMode = Readonly<{ amplitude: number; phase: number }>
export type FiberHelix = Readonly<{
  turns: number
  phase?: number
  radius: number | ((u: number, theta: number) => number)
}>
export type FiberAttributes = Readonly<{
  from: Vec3
  to: Vec3
  basePath?: (t: number) => Vec3
  radius: number | ((s: number) => number)
  helix?: FiberHelix
  fourier?: readonly FiberFourierMode[]
  envelopePower?: number
  up?: Vec3
  pathSegments?: number
  radialSegments?: number
  pos?: Vec3
  rotate?: Rotation
  scale?: Vec3
}>

export type ArrayAttributes = Readonly<{
  shape: readonly [number, number, number]
  period: Vec3
  axes?: Readonly<{ x: Vec3; y: Vec3; z: Vec3 }>
  inject?: Readonly<Record<string, Tensor | Readonly<{ axis: Tensor; angle: Tensor }>>>
  pos?: Vec3
  rotate?: Rotation
  scale?: Vec3
  children?: unknown
}>

export type ShellAttributes = Readonly<{
  offsets: readonly number[]
  pos?: Vec3
  rotate?: Rotation
  scale?: Vec3
  children?: unknown
}>

export type GeometryAttributes<P extends object = object> = Readonly<
  P & {
    id: string
    materials?: readonly Material[]
    pos?: Vec3
    rotate?: Rotation
    scale?: Vec3
    children?: unknown
  }
>
export type Geometry<P extends object = object> = (props: GeometryAttributes<P>) => unknown

export type MaterialVariable =
  | string
  | number
  | boolean
  | null
  | readonly MaterialVariable[]
  | Readonly<{ [key: string]: MaterialVariable }>
export type MaterialVariables = Readonly<Record<string, MaterialVariable> & { color?: string }>

export class CadModelError extends Error {
  constructor(message: string)
}

export class Material {
  constructor(symbol: string)
  constructor(symbol: string, variables: MaterialVariables)
  constructor(symbol: string, version: string)
  constructor(symbol: string, version: string, variables: MaterialVariables)
  readonly symbol: string
  readonly version?: string
  readonly variables: MaterialVariables
}

export class Structure {
  constructor(options: {
    geometry: () => unknown
    varsSchema: Record<string, VarsSchemaEntry>
    geometryGroup?: StructureGroupMap
    surfaceGroup?: StructureGroupMap
  })
  readonly geometry: () => unknown
  readonly varsSchema: Readonly<Record<string, unknown>>
  readonly geometryGroup: StructureGroupMap
  readonly surfaceGroup: StructureGroupMap
  randomVars(seed?: number): Vars
}

export class Experiment<TInitialCondition = unknown, TBoundaryCondition = unknown> extends Structure {
  constructor(options: {
    geometry: () => unknown
    varsSchema: Record<string, VarsSchemaEntry>
    geometryGroup?: StructureGroupMap
    surfaceGroup?: StructureGroupMap
    initialConditions?: () => readonly ExperimentRule<TInitialCondition>[]
    boundaryConditions?: () => readonly ExperimentRule<TBoundaryCondition>[]
  })
  readonly initialConditions: () => readonly ExperimentRule<TInitialCondition>[]
  readonly boundaryConditions: () => readonly ExperimentRule<TBoundaryCondition>[]
}

export abstract class VariableObject<TObject extends Structure> {
  protected constructor(object: TObject, partialVars?: Record<string, Tensor>)
  readonly object: TObject
  readonly vars: Vars
}

export class Sample extends VariableObject<Structure> {
  constructor(structure: Structure, partialVars?: Record<string, Tensor>)
  readonly structure: Structure
}

export class Setup<TInitialCondition = unknown, TBoundaryCondition = unknown>
  extends VariableObject<Experiment<TInitialCondition, TBoundaryCondition>> {
  constructor(
    experiment: Experiment<TInitialCondition, TBoundaryCondition>,
    partialVars?: Record<string, Tensor>,
  )
  readonly experiment: Experiment<TInitialCondition, TBoundaryCondition>
}
