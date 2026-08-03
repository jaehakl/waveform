/// <reference lib="webworker" />

import { evaluateDocumentEntry, executeCompiledProject, loadCompiledProject } from '../execution/userModule'
import { assertEvaluatedDocumentSnapshotV2, serializeEvaluatedDocumentSnapshotV2 } from '../execution/snapshot'
import { cadSnapshotTransferables } from '../execution/meshValidation'
import { runtimeDiagnostic } from '../execution/runtimeDiagnostics'
import { CadModelError } from '../model/core'
import { ExperimentProgramDefinitionV3 } from '../model/v3'
import {
  KernelRegistryV3,
  kernelModulesV3,
  runSimulationProgramV3,
} from '../../simulation'
import {
  assertRunnerEvaluationEnvelopeV2,
  assertRunnerPreparedEvaluationEnvelopeV2,
  assertRunnerPreparedSessionEnvelopeV2,
  assertRunnerSimulationEnvelopeV3,
  type RunnerEvaluationResultEnvelopeV2,
  type RunnerPreparedSessionEnvelopeV2,
} from './protocol'

let preparedEntry: ReturnType<typeof loadCompiledProject> | null = null
let preparedSession: RunnerPreparedSessionEnvelopeV2 | null = null

self.onmessage = (event: MessageEvent<unknown>) => {
  if (
    typeof event.data === 'object'
    && event.data !== null
    && 'type' in event.data
    && event.data.type === 'caemble-runner-simulate-v3'
  ) {
    const envelope = event.data
    let requestId = 'unknown'
    let structureRevision = 0
    let experimentRevision = 0
    let nonce = 'invalid'
    void Promise.resolve().then(async () => {
      assertRunnerSimulationEnvelopeV3(envelope)
      requestId = envelope.request.requestId
      structureRevision = envelope.request.structureRevision
      experimentRevision = envelope.request.experimentRevision
      nonce = envelope.nonce
      const entry = loadCompiledProject(envelope.request.compiledProject, 'experiment')
      if (!(entry instanceof ExperimentProgramDefinitionV3)) {
        throw new CadModelError('Simulation Run requires an Experiment imported from @caemble/core/v3.')
      }
      const definition = entry.createProgramRuntime(envelope.request.setup.experiment.variables)
      if (
        JSON.stringify(definition.manifest)
        !== JSON.stringify(envelope.request.setup.experiment.simulationProgram)
      ) {
        throw new CadModelError('Simulation Program manifest changed after the evaluated preview snapshot.')
      }
      const result = await runSimulationProgramV3(
        definition,
        envelope.request.sample,
        envelope.request.setup,
        new KernelRegistryV3(kernelModulesV3),
        new AbortController().signal,
        requestId,
      )
      self.postMessage({
        type: 'caemble-runner-simulation-result-v3',
        nonce,
        response: {
          type: 'simulation-success-v3',
          requestId,
          structureRevision,
          experimentRevision,
          result,
        },
      })
    }).catch((error: unknown) => {
      self.postMessage({
        type: 'caemble-runner-simulation-result-v3',
        nonce,
        response: {
          type: 'simulation-error-v3',
          requestId,
          structureRevision,
          experimentRevision,
          message: error instanceof Error ? error.message : String(error),
          ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
        },
      })
    })
    return
  }

  if (
    typeof event.data === 'object' &&
    event.data !== null &&
    'type' in event.data &&
    event.data.type === 'caemble-runner-prepare-v2'
  ) {
    assertRunnerPreparedSessionEnvelopeV2(event.data)
    if (preparedSession) throw new Error('The evaluation Worker already has a prepared session.')
    preparedSession = event.data
    self.postMessage({
      type: 'caemble-runner-prepared-v2',
      nonce: event.data.nonce,
      documentType: event.data.document.kind,
      sourceHash: event.data.compiledProject.sourceHash,
    })
    return
  }

  if (
    typeof event.data === 'object' &&
    event.data !== null &&
    'type' in event.data &&
    event.data.type === 'caemble-runner-evaluate-prepared-v2'
  ) {
    assertRunnerPreparedEvaluationEnvelopeV2(event.data)
    const session = preparedSession
    if (!session || event.data.nonce !== session.nonce) {
      throw new Error('The evaluation Worker prepared session identity is invalid.')
    }
    const { request } = event.data
    let response: RunnerEvaluationResultEnvelopeV2['response']
    try {
      preparedEntry ??= loadCompiledProject(session.compiledProject, session.document.kind)
      const snapshot = serializeEvaluatedDocumentSnapshotV2(
        evaluateDocumentEntry(
          preparedEntry,
          session.document.kind,
          session.compiledProject.sourceHash,
          request.realizationSeed,
          request.vars,
        ),
      )
      assertEvaluatedDocumentSnapshotV2(snapshot)
      response = {
        type: 'document-success',
        requestId: request.requestId,
        revision: request.revision,
        documentType: session.document.kind,
        snapshot,
      }
    } catch (error) {
      const diagnostic = error instanceof Error ? runtimeDiagnostic(error, session.compiledProject) : undefined
      response = {
        type: 'document-error',
        requestId: request.requestId,
        revision: request.revision,
        documentType: session.document.kind,
        errorType: error instanceof CadModelError ? 'model' : 'runtime',
        message: error instanceof Error ? error.message : String(error),
        ...(diagnostic ? { diagnostics: [diagnostic] } : {}),
        ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
      }
    }
    self.postMessage(
      { type: 'caemble-runner-result-v2', nonce: session.nonce, response },
      response.type === 'document-success' ? cadSnapshotTransferables(response.snapshot.scene) : [],
    )
    return
  }

  assertRunnerEvaluationEnvelopeV2(event.data)
  const { nonce, request } = event.data
  let response: RunnerEvaluationResultEnvelopeV2['response']
  try {
    const snapshot = serializeEvaluatedDocumentSnapshotV2(
      executeCompiledProject(
        request.compiledProject,
        request.document.kind,
        request.document.realizationSeed,
        request.vars,
      ),
    )
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
