import type { BuiltSampleV2, BuiltSetupV2 } from '../cad/execution/realization'
import type { CadScene } from '../cad/evaluation/types'
import type {
  DataDType,
  ExperimentRule,
  RecordedDataResult,
  RecordedDataRule,
  SolverParameters,
} from '../cad/model/descriptor'
import type { Vec3, Vars } from '../cad/model/types'
import type { UcumUnit } from '../cad/model/units'
import type {
  CartesianBasis,
  QuantityKindName,
  ScalarQuantityKindName,
} from '../quantitykind/runtime'

export type SimulationBodyIdV3 = `${'structure' | 'experiment'}:${string}`

export type SimulationBodyV3 = Readonly<{
  id: SimulationBodyIdV3
  source: 'structure' | 'experiment'
  geometryId: string
  referencePose: Readonly<{
    position: readonly [number, number, number]
  }>
}>

export type SimulationWorldV3 = Readonly<{
  bodies: readonly SimulationBodyV3[]
  scenes: Readonly<{
    structure: CadScene
    experiment: CadScene
  }>
}>

export type SimulationBodyStateV3 = Readonly<{
  body: SimulationBodyIdV3 | SimulationBodyV3
  pose: Readonly<{
    position: readonly [number, number, number]
  }>
  velocity: Vec3
}>

export type SimulationStateDataV3 = Readonly<{
  bodies: readonly SimulationBodyStateV3[]
  values?: Readonly<Record<string, unknown>>
}>

declare const stateRefBrand: unique symbol
declare const artifactRefBrand: unique symbol

export type SimulationStateRefV3 = Readonly<{
  runId: string
  revision: number
  [stateRefBrand]: true
}>

export type SimulationArtifactRefV3 = Readonly<{
  runId: string
  id: string
  [artifactRefBrand]: true
}>

export type SimulationObservationV3 = Readonly<{
  value: boolean | string | number
  unit?: UcumUnit
  quantityKind?: QuantityKindName
}>

export type SimulationOutputAxisV3 = Readonly<{
  length?: number
  name?: string
  ticks?: readonly (number | string)[]
  unit?: UcumUnit
  quantityKind?: ScalarQuantityKindName
}>

export type SimulationOutputSpecV3 = Readonly<{
  dtype: DataDType
  unit?: UcumUnit
  quantityKind?: QuantityKindName
  basis?: CartesianBasis
  axes?: readonly SimulationOutputAxisV3[]
  seriesAxis?: Readonly<{
    unit: UcumUnit
    quantityKind: ScalarQuantityKindName
  }>
}>

export type SimulationOutputSampleV3 = Readonly<{
  time?: number
  artifact: SimulationArtifactRefV3
  data: unknown
}>

export type SimulationOutputSeriesV3 = Readonly<{
  spec: SimulationOutputSpecV3
  samples: readonly SimulationOutputSampleV3[]
}>

export type KernelIdentityV3 = Readonly<{
  name: string
  version: string
}>

export type KernelRefV3<
  TConfig = unknown,
  TArtifacts extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
  TObservations extends Readonly<Record<string, SimulationObservationV3>> = Readonly<
    Record<string, SimulationObservationV3>
  >,
> = Readonly<{
  kind: 'caemble-kernel-ref-v3'
  name: string
  version: string
  __config?: TConfig
  __artifacts?: TArtifacts
  __observations?: TObservations
}>

export type KernelTaskContextV3<TVars extends Readonly<Vars> = Readonly<Vars>> = Readonly<{
  vars: TVars
  world: SimulationWorldV3
}>

export type DefinedKernelTaskV3<
  TConfig = unknown,
  TArtifacts extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
  TObservations extends Readonly<Record<string, SimulationObservationV3>> = Readonly<
    Record<string, SimulationObservationV3>
  >,
> = Readonly<{
  kind: 'caemble-kernel-task-v3'
  kernel: KernelRefV3<TConfig, TArtifacts, TObservations>
  configure: (context: KernelTaskContextV3) => TConfig
}>

export type ResolvedKernelTaskV3<
  TConfig = unknown,
  TArtifacts extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
  TObservations extends Readonly<Record<string, SimulationObservationV3>> = Readonly<
    Record<string, SimulationObservationV3>
  >,
> = Readonly<{
  kind: 'caemble-resolved-kernel-task-v3'
  kernel: KernelRefV3<TConfig, TArtifacts, TObservations>
  config: TConfig
  taskName: string
}>

export type KernelRunResultV3<
  TArtifacts extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
  TObservations extends Readonly<Record<string, SimulationObservationV3>> = Readonly<
    Record<string, SimulationObservationV3>
  >,
> = Readonly<{
  state: SimulationStateRefV3
  artifacts: Readonly<{ [Key in keyof TArtifacts]: SimulationArtifactRefV3 }>
  observations: TObservations
}>

export type KernelExecutionInputV3<TConfig = unknown> = Readonly<{
  runId: string
  world: SimulationWorldV3
  state: SimulationStateDataV3
  artifacts: Readonly<Record<string, unknown>>
  config: TConfig
  outputs: Readonly<Record<string, SimulationOutputSpecV3>>
  sample: BuiltSampleV2
  setup: BuiltSetupV2
}>

export type KernelExecutionResultV3 = Readonly<{
  state?: SimulationStateDataV3
  artifacts?: Readonly<Record<string, unknown>>
  observations?: Readonly<Record<string, SimulationObservationV3>>
}>

export type KernelModuleV3 = Readonly<{
  ref: KernelRefV3
  execute: (
    input: KernelExecutionInputV3,
    signal: AbortSignal,
  ) => Promise<KernelExecutionResultV3>
}>

export type SimulationTraceEntryV3 = Readonly<{
  sequence: number
  task: string
  kernel: KernelIdentityV3
  inputStateRevision: number
  outputStateRevision: number | null
  inputHash: string
  outputHash: string | null
  status: 'succeeded' | 'failed' | 'fallback'
  error?: string
  startedAt: number
  finishedAt: number
}>

export type SimulationProvenanceV3 = Readonly<{
  sourceHash: string
  structureSourceHash: string
  experimentSourceHash: string
  structureSeed: number
  experimentSeed: number
  structureVars: Readonly<Vars>
  experimentVars: Readonly<Vars>
  kernels: readonly KernelIdentityV3[]
}>

export type SimulationResultV3 = Readonly<{
  format: 'caemble-run'
  version: 3
  runId: string
  status: 'succeeded'
  finalState: Readonly<{
    revision: number
    bodyCount: number
  }>
  outputs: Readonly<Record<string, SimulationOutputSeriesV3>>
  trace: readonly SimulationTraceEntryV3[]
  provenance: SimulationProvenanceV3
}>

export type SimulationProgramManifestV3 = Readonly<{
  version: 3
  tasks: Readonly<Record<string, KernelIdentityV3>>
  outputs: Readonly<Record<string, SimulationOutputSpecV3>>
}>

export type DcKernelRuleV3 = Omit<ExperimentRule, 'label'> & Readonly<{ label?: string }>
export type DcKernelRecordedRuleV3 = Omit<RecordedDataRule, 'label' | 'result'> &
  Readonly<{
    key: string
    label?: string
    result?: RecordedDataResult
  }>

export type DcCurrentDensityTaskConfigV3 = Readonly<{
  parameters: SolverParameters
  initializations: readonly DcKernelRuleV3[]
  boundaryConditions: readonly DcKernelRuleV3[]
  recordedData: readonly DcKernelRecordedRuleV3[]
}>

export type DcCurrentDensityArtifactsV3 = Readonly<Record<string, unknown>>
