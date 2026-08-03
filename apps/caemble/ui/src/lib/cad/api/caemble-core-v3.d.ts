// @caemble/core/v3 declaration version: 0.0.0
export {
  Mat,
  Material,
} from '@caemble/core/v2'

export type * from '@caemble/core/v2'

import type {
  CartesianBasis,
  DataDType,
  QuantityKindName,
  ScalarQuantityKindName,
  StructureGroupMap,
  Tensor,
  UcumUnit,
  VarsSchemaEntry,
  Vec3,
} from '@caemble/core/v2'

export type VarsSchemaDefinition = Readonly<Record<string, Readonly<VarsSchemaEntry>>>

type ShapeSource<Entry extends VarsSchemaEntry> = Entry['min'] extends readonly unknown[]
  ? Entry['min']
  : Entry['max']

type WidenTensor<Value> = Value extends number
  ? number
  : Value extends readonly unknown[]
    ? { readonly [Index in keyof Value]: WidenTensor<Value[Index]> }
    : never

export type InferVars<Schema extends VarsSchemaDefinition> = Readonly<{
  [Key in keyof Schema]: WidenTensor<ShapeSource<Schema[Key]>>
}>

export type SimulationBodyId = `${'structure' | 'experiment'}:${string}`

export type SimulationBody = Readonly<{
  id: SimulationBodyId
  source: 'structure' | 'experiment'
  geometryId: string
  referencePose: Readonly<{ position: readonly [number, number, number] }>
}>

export type SimulationWorld = Readonly<{
  bodies: readonly SimulationBody[]
}>

export type SimulationBodyState = Readonly<{
  body: SimulationBody | SimulationBodyId
  pose: Readonly<{ position: readonly [number, number, number] }>
  velocity: Vec3
}>

export type SimulationState = Readonly<{
  bodies: readonly SimulationBodyState[]
  values?: Readonly<Record<string, unknown>>
}>

declare const stateRefBrand: unique symbol
declare const artifactRefBrand: unique symbol

export type SimulationStateRef = Readonly<{
  runId: string
  revision: number
  [stateRefBrand]: true
}>

export type ArtifactRef = Readonly<{
  runId: string
  id: string
  [artifactRefBrand]: true
}>

export type SimulationObservation = Readonly<{
  value: boolean | string | number
  unit?: UcumUnit
  quantityKind?: QuantityKindName
}>

export type SimulationOutputSpec = Readonly<{
  dtype: DataDType
  unit?: UcumUnit
  quantityKind?: QuantityKindName
  basis?: CartesianBasis
  axes?: readonly Readonly<{
    length?: number
    name?: string
    ticks?: readonly (number | string)[]
    unit?: UcumUnit
    quantityKind?: ScalarQuantityKindName
  }>[]
  seriesAxis?: Readonly<{
    unit: UcumUnit
    quantityKind: ScalarQuantityKindName
  }>
}>

export type KernelRef<
  Config = unknown,
  Artifacts extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
  Observations extends Readonly<Record<string, SimulationObservation>> = Readonly<Record<string, SimulationObservation>>,
> = Readonly<{
  kind: 'caemble-kernel-ref-v3'
  name: string
  version: string
  __config?: Config
  __artifacts?: Artifacts
  __observations?: Observations
}>

export type KernelTask<
  Config = unknown,
  Artifacts extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
  Observations extends Readonly<Record<string, SimulationObservation>> = Readonly<Record<string, SimulationObservation>>,
> = Readonly<{
  kind: 'caemble-kernel-task-v3'
  kernel: KernelRef<Config, Artifacts, Observations>
  configure: (context: Readonly<{ vars: Readonly<Record<string, Tensor>>; world: SimulationWorld }>) => Config
}>

export type ResolvedKernelTask<
  Config = unknown,
  Artifacts extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
  Observations extends Readonly<Record<string, SimulationObservation>> = Readonly<Record<string, SimulationObservation>>,
> = Readonly<{
  kind: 'caemble-resolved-kernel-task-v3'
  kernel: KernelRef<Config, Artifacts, Observations>
  config: Config
  taskName: string
}>

type ResolvedTasks<Tasks extends Readonly<Record<string, KernelTask>>> = Readonly<{
  [Key in keyof Tasks]: Tasks[Key] extends KernelTask<infer Config, infer Artifacts, infer Observations>
    ? ResolvedKernelTask<Config, Artifacts, Observations>
    : never
}>

export type KernelRunResult<
  Artifacts extends Readonly<Record<string, unknown>>,
  Observations extends Readonly<Record<string, SimulationObservation>>,
> = Readonly<{
  state: SimulationStateRef
  artifacts: Readonly<{ [Key in keyof Artifacts]: ArtifactRef }>
  observations: Observations
}>

export type SimulationApi = Readonly<{
  run: <
    Config,
    Artifacts extends Readonly<Record<string, unknown>>,
    Observations extends Readonly<Record<string, SimulationObservation>>,
  >(
    task: ResolvedKernelTask<Config, Artifacts, Observations>,
    input: Readonly<{
      state: SimulationStateRef
      artifacts?: Readonly<Record<string, ArtifactRef>>
    }>,
  ) => Promise<KernelRunResult<Artifacts, Observations>>
  record: (name: string, artifact: ArtifactRef, coordinates?: Readonly<{ time?: number }>) => void
  random: () => number
}>

export declare function defineTask<
  Config,
  Artifacts extends Readonly<Record<string, unknown>>,
  Observations extends Readonly<Record<string, SimulationObservation>>,
>(
  kernel: KernelRef<Config, Artifacts, Observations>,
  configure: (context: Readonly<{
    vars: Readonly<Record<string, Tensor>>
    world: SimulationWorld
  }>) => NoInfer<Config>,
): KernelTask<Config, Artifacts, Observations>

export type ExperimentProgramOptions<
  Schema extends VarsSchemaDefinition,
  Tasks extends Readonly<Record<string, KernelTask>>,
  Outputs extends Readonly<Record<string, SimulationOutputSpec>>,
> = Readonly<{
  geometry: (context: Readonly<{ vars: InferVars<Schema> }>) => unknown
  lengthUnit: UcumUnit
  varsSchema: Schema
  geometryGroup?: StructureGroupMap
  surfaceGroup?: StructureGroupMap
  tasks: Tasks
  outputs: Outputs
  initialState?: (context: Readonly<{
    vars: InferVars<Schema>
    world: SimulationWorld
  }>) => SimulationState
  simulate: (context: Readonly<{
    sim: SimulationApi
    tasks: ResolvedTasks<Tasks>
    initialState: SimulationStateRef
    vars: InferVars<Schema>
    world: SimulationWorld
  }>) => Promise<SimulationStateRef> | SimulationStateRef
}>

export declare function experiment<
  const Schema extends VarsSchemaDefinition,
  const Tasks extends Readonly<Record<string, KernelTask>>,
  const Outputs extends Readonly<Record<string, SimulationOutputSpec>>,
>(options: ExperimentProgramOptions<Schema, Tasks, Outputs>): Readonly<{
  readonly apiVersion: 3
  readonly documentType: 'experiment'
  readonly varsSchema: Schema
}>
