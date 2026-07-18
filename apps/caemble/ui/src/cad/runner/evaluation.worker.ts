/// <reference lib="webworker" />

import { executeCompiledProject } from '../execution/userModule'
import {
  assertEvaluatedDocumentSnapshotV2,
  serializeEvaluatedDocumentSnapshotV2,
} from '../execution/snapshot'
import { cadSnapshotTransferables } from '../execution/meshValidation'
import { runtimeDiagnostic } from '../execution/runtimeDiagnostics'
import { CadModelError } from '../model/core'
import {
  assertRunnerEvaluationEnvelopeV2,
  type RunnerEvaluationResultEnvelopeV2,
} from './protocol'

self.onmessage = (event: MessageEvent<unknown>) => {
  assertRunnerEvaluationEnvelopeV2(event.data)
  const { nonce, request } = event.data
  let response: RunnerEvaluationResultEnvelopeV2['response']
  try {
    const snapshot = serializeEvaluatedDocumentSnapshotV2(executeCompiledProject(
      request.compiledProject,
      request.document.kind,
      request.document.realizationSeed,
      request.vars,
    ))
    assertEvaluatedDocumentSnapshotV2(snapshot)
    response = {
      type: 'document-success',
      requestId: request.requestId,
      revision: request.revision,
      documentType: request.document.kind,
      snapshot,
    }
  } catch (error) {
    const diagnostic = error instanceof Error ? runtimeDiagnostic(error, request.compiledProject) : undefined
    response = {
      type: 'document-error',
      requestId: request.requestId,
      revision: request.revision,
      documentType: request.document.kind,
      errorType: error instanceof CadModelError ? 'model' : 'runtime',
      message: error instanceof Error ? error.message : String(error),
      ...(diagnostic ? { diagnostics: [diagnostic] } : {}),
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    }
  }
  self.postMessage(
    { type: 'caemble-runner-result-v2', nonce, response },
    response.type === 'document-success' ? cadSnapshotTransferables(response.snapshot.scene) : [],
  )
}

self.postMessage({ type: 'caemble-runner-worker-ready-v2' })

export {}
