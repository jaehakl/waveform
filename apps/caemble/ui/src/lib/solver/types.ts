import type { CadScene } from '../cad/evaluation/types'
import type { EvaluatedExperimentRules, RecordedData, ResolvedExperimentSolver } from '../cad/model/core'
import type { Vars } from '../cad/model/types'
import type { EvaluatedDocumentSnapshotV2 } from '../cad/execution/snapshot'
import type { BuiltSampleV2, BuiltSetupV2 } from '../cad/execution/realization'
import type { FrozenMaterialParameters } from '../material'
import type { SolverSpec, SolverValidationIssue } from './spec'

export type SolverCompatibility = Readonly<{
  status: 'unavailable' | 'checking' | 'compatible' | 'incompatible'
  issues: readonly SolverValidationIssue[]
}>

export type SolverModuleInput = Readonly<{
  structure: Readonly<{
    vars: Readonly<Vars>
    scene: CadScene
    provenance: Pick<EvaluatedDocumentSnapshotV2, 'apiVersion' | 'seed' | 'sourceHash'>
    materialParameters: FrozenMaterialParameters
  }>
  experiment: Readonly<{
    vars: Readonly<Vars>
    scene: CadScene
    rules: EvaluatedExperimentRules
    solver: ResolvedExperimentSolver
    provenance: Pick<EvaluatedDocumentSnapshotV2, 'apiVersion' | 'seed' | 'sourceHash'>
    materialParameters: FrozenMaterialParameters
  }>
}>

export type SolverPreflightInput = Readonly<{
  structure?: Readonly<{
    scene: CadScene
  }>
  experiment: Readonly<{
    scene: CadScene
    rules: EvaluatedExperimentRules
    solver: ResolvedExperimentSolver
  }>
}>

export type SolverBuiltInput = Readonly<{
  sample: BuiltSampleV2
  setup: BuiltSetupV2
}>

export type SolverProcessStatus = 'idle' | 'preparing' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export type SolverProcess = Readonly<{
  runId: string | null
  status: SolverProcessStatus
  solver: Readonly<{ name: string; version: string }> | null
  error: string | null
  startedAt: number | null
  finishedAt: number | null
}>

export type SolverModule = Readonly<{
  spec: SolverSpec
  solve: (input: SolverModuleInput, signal: AbortSignal) => Promise<RecordedData>
}>

export type SolverRunProvenanceV2 = Readonly<{
  structure: Readonly<{
    apiVersion: 2
    sourceHash: string
    seed: number
    vars: Readonly<Vars>
  }>
  experiment: Readonly<{
    apiVersion: 2
    sourceHash: string
    seed: number
    vars: Readonly<Vars>
  }>
  solver: Readonly<{
    name: string
    version: string
  }>
}>

export type SolverProcessListener = (process: SolverProcess) => void
