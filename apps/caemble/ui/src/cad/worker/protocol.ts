import type { CadScenePart } from '../evaluation/types'

export type CadWorkerRequest = Readonly<{
  type: 'run'
  requestId: string
  source: string
}>

export type CadWorkerErrorType = 'compile' | 'runtime' | 'model'

export type CadWorkerResponse =
  | Readonly<{
      type: 'success'
      requestId: string
      parts: CadScenePart[]
    }>
  | Readonly<{
      type: 'error'
      requestId: string
      errorType: CadWorkerErrorType
      message: string
      stack?: string
    }>

