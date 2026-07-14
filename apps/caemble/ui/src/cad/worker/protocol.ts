import type { CadScene } from '../evaluation/types'

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
    }>
  | Readonly<{
      type: 'error'
      requestId: string
      errorType: CadWorkerErrorType
      message: string
      stack?: string
    }>

