import type { CadScene } from '../evaluation/types'
import type {
  EvaluatedExperimentRules,
  RecordedData,
  ResolvedExperimentSolver,
} from '../model/core'
import type { Vars } from '../model/types'
import type { SolverProcess, SolverValidationResult } from '../../solver'

export type CadDocumentType = 'structure' | 'experiment'

export type CadWorkerRequest =
  | Readonly<{
      type: 'evaluate-document'
      requestId: string
      revision: number
      source: string
      documentType: CadDocumentType
    }>
  | Readonly<{
      type: 'run-solver'
      requestId: string
      structureRevision: number
      experimentRevision: number
    }>
  | Readonly<{
      type: 'cancel-solver'
      requestId: string
    }>

export type CadWorkerErrorType = 'compile' | 'runtime' | 'model'

export type CadWorkerResponse =
  | Readonly<{
      type: 'document-success'
      requestId: string
      revision: number
      documentType: CadDocumentType
      scene: CadScene
      variables: Readonly<Vars>
      experimentRules?: EvaluatedExperimentRules
      solver?: ResolvedExperimentSolver
    }>
  | Readonly<{
      type: 'solver-preflight'
      requestId: string
      structureRevision?: number
      experimentRevision: number
      result: SolverValidationResult
    }>
  | Readonly<{
      type: 'document-error'
      requestId: string
      revision: number
      documentType: CadDocumentType
      errorType: CadWorkerErrorType
      message: string
      stack?: string
    }>
  | Readonly<{
      type: 'solver-process'
      requestId: string
      process: SolverProcess
    }>
  | Readonly<{
      type: 'solver-success'
      requestId: string
      structureRevision: number
      experimentRevision: number
      recordedData: RecordedData
    }>
  | Readonly<{
      type: 'solver-error'
      requestId: string
      message: string
    }>
