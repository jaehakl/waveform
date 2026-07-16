import type { CadScene } from '../cad/evaluation/types'
import type {
  EvaluatedExperimentRules,
  Experiment,
  RecordedData,
  ResolvedExperimentSolver,
  Structure,
} from '../cad/model/core'
import type { Vars } from '../cad/model/types'

export type SolverModuleInput = Readonly<{
  structure: Readonly<{
    model: Structure
    vars: Readonly<Vars>
    scene: CadScene
  }>
  experiment: Readonly<{
    model: Experiment
    vars: Readonly<Vars>
    scene: CadScene
    rules: EvaluatedExperimentRules
    solver: ResolvedExperimentSolver
  }>
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
  name: string
  version: string
  solve: (input: SolverModuleInput, signal: AbortSignal) => Promise<RecordedData>
}>

export type SolverProcessListener = (process: SolverProcess) => void
