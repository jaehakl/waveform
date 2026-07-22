import type { EvaluatedDocumentSnapshotV2 } from '../execution/snapshot'
import type { BuiltRealizationV2 } from '../execution/realization'
import type { RecordedData } from '../model/core'
import type { Tensor } from '../model/types'
import type { CadSourceDocumentV2 } from '../source/document'
import type { CompiledCadProjectV2 } from '../compiler/types'
import type { SolverProcess, SolverRunProvenanceV2, SolverValidationResult } from '../../solver'

export type CadDocumentType = 'structure' | 'experiment'
export type CadWorkerErrorType = 'compile' | 'type' | 'policy' | 'runtime' | 'model'
export type CadDiagnosticPhase = 'syntax' | 'semantic' | 'policy' | 'runtime' | 'model'

export type CadDiagnosticV2 = Readonly<{
  file: string
  range: Readonly<{
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
  }>
  code: string | number
  severity: 'error' | 'warning' | 'info'
  phase: CadDiagnosticPhase
  message: string
}>

export type CadEvaluationRequestV2 = Readonly<{
  type: 'evaluate-document'
  requestId: string
  revision: number
  document: Pick<CadSourceDocumentV2, 'apiVersion' | 'kind' | 'realizationSeed'>
  compiledProject: CompiledCadProjectV2
  vars?: Readonly<Record<string, Tensor>>
}>

export type CadWorkerRequest =
  | Readonly<{
      type: 'cache-realization'
      requestId: string
      revision: number
      realization: BuiltRealizationV2
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

export type CadEvaluationResponseV2 =
  | Readonly<{
      type: 'document-success'
      requestId: string
      revision: number
      documentType: CadDocumentType
      snapshot: EvaluatedDocumentSnapshotV2
    }>
  | Readonly<{
      type: 'document-error'
      requestId: string
      revision: number
      documentType: CadDocumentType
      errorType: CadWorkerErrorType
      message: string
      diagnostics?: readonly CadDiagnosticV2[]
      stack?: string
    }>

export type CadWorkerResponse =
  | Readonly<{
      type: 'solver-preflight'
      requestId: string
      structureRevision?: number
      experimentRevision: number
      result: SolverValidationResult
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
      provenance: SolverRunProvenanceV2
    }>
  | Readonly<{
      type: 'solver-error'
      requestId: string
      message: string
    }>
