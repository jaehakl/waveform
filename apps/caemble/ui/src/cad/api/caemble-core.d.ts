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
export type ExperimentTensorDType =
  | 'bool'
  | 'string'
  | 'int8'
  | 'int16'
  | 'int32'
  | 'int64'
  | 'uint8'
  | 'uint16'
  | 'uint32'
  | 'uint64'
  | 'float16'
  | 'float32'
  | 'float64'
export type ExperimentScalarParameter =
  | boolean
  | string
  | number
  | Readonly<{ type: 'bool'; value: boolean }>
  | Readonly<{ type: 'string'; value: string }>
  | Readonly<{ type: 'int'; value: number }>
  | Readonly<{ type: 'float'; value: number }>
export type ExperimentTensorParameter = Readonly<{
  type: 'tensor'
  dimension: number
  shape: readonly number[]
  dtype: ExperimentTensorDType
  value: boolean | string | number | readonly unknown[]
}>
export type ExperimentParameter = ExperimentScalarParameter | ExperimentTensorParameter
export type ExperimentParameters = Readonly<Record<string, ExperimentParameter>>
export type RecordedDataResult = Readonly<{
  type: 'tensor'
  dimension: number
  shape: readonly number[]
  dtype: ExperimentTensorDType
}>
export type ExperimentRule<TParameters extends ExperimentParameters = ExperimentParameters> = Readonly<{
  target: readonly ExperimentTarget[]
  label: string
  methodId: string
  parameters: TParameters
}>
export type RecordedDataRule<TParameters extends ExperimentParameters = ExperimentParameters> = Readonly<
  ExperimentRule<TParameters> & { result: RecordedDataResult }
>

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
export type SolverParameters = Readonly<Record<string, MaterialVariable>>
export type ExperimentSolver = Readonly<{
  name: string
  version: string
  parameters: () => SolverParameters
}>

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

export class Experiment<
  TInitialConditionParameters extends ExperimentParameters = ExperimentParameters,
  TBoundaryConditionParameters extends ExperimentParameters = ExperimentParameters,
  TRecordedDataParameters extends ExperimentParameters = ExperimentParameters,
> extends Structure {
  constructor(options: {
    solver: ExperimentSolver
    geometry: () => unknown
    varsSchema: Record<string, VarsSchemaEntry>
    geometryGroup?: StructureGroupMap
    surfaceGroup?: StructureGroupMap
    initialConditions?: () => readonly ExperimentRule<TInitialConditionParameters>[]
    boundaryConditions?: () => readonly ExperimentRule<TBoundaryConditionParameters>[]
    recordedData?: () => readonly RecordedDataRule<TRecordedDataParameters>[]
  })
  readonly solver: ExperimentSolver
  readonly initialConditions: () => readonly ExperimentRule<TInitialConditionParameters>[]
  readonly boundaryConditions: () => readonly ExperimentRule<TBoundaryConditionParameters>[]
  readonly recordedData: () => readonly RecordedDataRule<TRecordedDataParameters>[]
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

export class Setup<
  TInitialConditionParameters extends ExperimentParameters = ExperimentParameters,
  TBoundaryConditionParameters extends ExperimentParameters = ExperimentParameters,
  TRecordedDataParameters extends ExperimentParameters = ExperimentParameters,
> extends VariableObject<Experiment<
    TInitialConditionParameters,
    TBoundaryConditionParameters,
    TRecordedDataParameters
  >> {
  constructor(
    experiment: Experiment<
      TInitialConditionParameters,
      TBoundaryConditionParameters,
      TRecordedDataParameters
    >,
    partialVars?: Record<string, Tensor>,
  )
  readonly experiment: Experiment<
    TInitialConditionParameters,
    TBoundaryConditionParameters,
    TRecordedDataParameters
  >
}
