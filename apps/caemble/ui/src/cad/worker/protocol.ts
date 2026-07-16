import type { CadScene } from '../evaluation/types'
import type { EvaluatedExperimentRules } from '../model/core'

export type CadDocumentType = 'structure' | 'experiment'

export type CadWorkerRequest = Readonly<{
  type: 'run'
  requestId: string
  source: string
  documentType: CadDocumentType
}>

export type CadWorkerErrorType = 'compile' | 'runtime' | 'model'

export type CadWorkerResponse =
  | Readonly<{
      type: 'success'
      requestId: string
      scene: CadScene
      experimentRules?: EvaluatedExperimentRules
    }>
  | Readonly<{
      type: 'error'
      requestId: string
      errorType: CadWorkerErrorType
      message: string
      stack?: string
    }>

