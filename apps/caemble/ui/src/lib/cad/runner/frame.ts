import {
  assertRunnerCancelEnvelopeV2,
  assertRunnerEvaluationEnvelopeV2,
  assertRunnerEvaluationResultEnvelopeV2,
  assertRunnerPreparedEvaluationEnvelopeV2,
  assertRunnerPreparedSessionEnvelopeV2,
  assertRunnerPreparedSessionReadyEnvelopeV2,
  assertRunnerSimulationEnvelopeV3,
  assertRunnerSimulationResultEnvelopeV3,
  type RunnerEvaluationEnvelopeV2,
  type RunnerPreparedEvaluationRequestV2,
  type RunnerPreparedSessionEnvelopeV2,
  type RunnerSimulationEnvelopeV3,
} from './protocol'
import { cadSnapshotTransferables } from '../execution/meshValidation'

const configuredHostOrigin = import.meta.env.VITE_CAEMBLE_HOST_ORIGIN?.trim()
const runnerPort = Number(window.location.port)
const developmentHostPort = runnerPort - 1
const allowedHostOrigins = configuredHostOrigin
  ? new Set([new URL(configuredHostOrigin).origin])
  : import.meta.env.DEV && Number.isInteger(developmentHostPort) && developmentHostPort > 0
    ? new Set([
        `${window.location.protocol}//127.0.0.1:${developmentHostPort}`,
        `${window.location.protocol}//localhost:${developmentHostPort}`,
        `${window.location.protocol}//[::1]:${developmentHostPort}`,
      ])
    : new Set<string>()
const activeWorkers = new Map<string, Worker>()

function handleSimulation(event: MessageEvent<unknown>, envelope: RunnerSimulationEnvelopeV3) {
  const { nonce, request } = envelope
  if (activeWorkers.has(nonce)) return
  const port = event.ports[0]
  const postRuntimeError = (message: string) => {
    port.postMessage({
      type: 'caemble-runner-simulation-result-v3',
      nonce,
      response: {
        type: 'simulation-error-v3',
        requestId: request.requestId,
        structureRevision: request.structureRevision,
        experimentRevision: request.experimentRevision,
        message,
      },
    })
  }
  let worker: Worker
  try {
    worker = new Worker(new URL('./evaluation.worker.ts', import.meta.url), { type: 'module' })
  } catch (error) {
    postRuntimeError(error instanceof Error ? error.message : 'The Simulation Worker could not be created.')
    port.close()
    return
  }
  activeWorkers.set(nonce, worker)

  let finished = false
  let started = false
  const finish = () => {
    if (finished) return
    finished = true
    activeWorkers.delete(nonce)
    worker.terminate()
    port.close()
  }
  worker.onmessage = (workerEvent: MessageEvent<unknown>) => {
    let keepWorker = false
    try {
      if (!started) {
        if (
          typeof workerEvent.data !== 'object'
          || workerEvent.data === null
          || Array.isArray(workerEvent.data)
          || !('type' in workerEvent.data)
          || workerEvent.data.type !== 'caemble-runner-worker-ready-v2'
          || Object.keys(workerEvent.data).length !== 1
        ) {
          throw new Error('The Simulation Worker did not send a valid ready signal.')
        }
        started = true
        port.postMessage({
          type: 'caemble-runner-simulation-started-v3',
          nonce,
          requestId: request.requestId,
          structureRevision: request.structureRevision,
          experimentRevision: request.experimentRevision,
        })
        worker.postMessage(envelope)
        keepWorker = true
        return
      }
      assertRunnerSimulationResultEnvelopeV3(workerEvent.data)
      if (
        workerEvent.data.nonce !== nonce
        || workerEvent.data.response.requestId !== request.requestId
        || workerEvent.data.response.structureRevision !== request.structureRevision
        || workerEvent.data.response.experimentRevision !== request.experimentRevision
      ) {
        throw new Error('The Simulation Worker response identity is invalid.')
      }
      port.postMessage(workerEvent.data)
    } catch (error) {
      postRuntimeError(error instanceof Error ? error.message : 'The Simulation Worker returned an invalid response.')
    } finally {
      if (!keepWorker) finish()
    }
  }
  worker.onerror = (workerError) => {
    postRuntimeError(workerError.message || 'The Simulation Worker failed.')
    finish()
  }
  port.onmessage = (portEvent: MessageEvent<unknown>) => {
    try {
      assertRunnerCancelEnvelopeV2(portEvent.data)
      if (portEvent.data.nonce === nonce) finish()
    } catch {
      // Invalid control messages cannot affect the Simulation Worker.
    }
  }
  port.start()
}

function handleOneShotEvaluation(event: MessageEvent<unknown>, envelope: RunnerEvaluationEnvelopeV2) {
  const { nonce, request } = envelope
  if (activeWorkers.has(nonce)) return
  const port = event.ports[0]
  const postRuntimeError = (message: string) => {
    port.postMessage({
      type: 'caemble-runner-result-v2',
      nonce,
      response: {
        type: 'document-error',
        requestId: request.requestId,
        revision: request.revision,
        documentType: request.document.kind,
        errorType: 'runtime',
        message,
      },
    })
  }
  let worker: Worker
  try {
    worker = new Worker(new URL('./evaluation.worker.ts', import.meta.url), { type: 'module' })
  } catch (error) {
    postRuntimeError(error instanceof Error ? error.message : 'The evaluation Worker could not be created.')
    port.close()
    return
  }
  activeWorkers.set(nonce, worker)

  let finished = false
  let started = false
  const finish = () => {
    if (finished) return
    finished = true
    activeWorkers.delete(nonce)
    worker.terminate()
    port.close()
  }
  worker.onmessage = (workerEvent: MessageEvent<unknown>) => {
    let keepWorker = false
    try {
      if (!started) {
        if (
          typeof workerEvent.data !== 'object' ||
          workerEvent.data === null ||
          Array.isArray(workerEvent.data) ||
          !('type' in workerEvent.data) ||
          workerEvent.data.type !== 'caemble-runner-worker-ready-v2' ||
          Object.keys(workerEvent.data).length !== 1
        ) {
          throw new Error('The evaluation Worker did not send a valid ready signal.')
        }
        started = true
        port.postMessage({
          type: 'caemble-runner-started-v2',
          nonce,
          requestId: request.requestId,
          revision: request.revision,
          documentType: request.document.kind,
        })
        worker.postMessage(envelope)
        keepWorker = true
        return
      }
      assertRunnerEvaluationResultEnvelopeV2(workerEvent.data)
      if (
        workerEvent.data.nonce !== nonce ||
        workerEvent.data.response.requestId !== request.requestId ||
        workerEvent.data.response.revision !== request.revision ||
        workerEvent.data.response.documentType !== request.document.kind ||
        (workerEvent.data.response.type === 'document-success' &&
          (workerEvent.data.response.snapshot.sourceHash !== request.compiledProject.sourceHash ||
            workerEvent.data.response.snapshot.seed !== request.document.realizationSeed))
      ) {
        throw new Error('The evaluation Worker response identity is invalid.')
      }
      port.postMessage(
        workerEvent.data,
        workerEvent.data.response.type === 'document-success'
          ? cadSnapshotTransferables(workerEvent.data.response.snapshot.scene)
          : [],
      )
    } catch (error) {
      postRuntimeError(error instanceof Error ? error.message : 'The evaluation Worker returned an invalid response.')
    } finally {
      if (!keepWorker) finish()
    }
  }
  worker.onerror = (workerError) => {
    postRuntimeError(workerError.message || 'The evaluation Worker failed.')
    finish()
  }
  port.onmessage = (portEvent: MessageEvent<unknown>) => {
    try {
      assertRunnerCancelEnvelopeV2(portEvent.data)
      if (portEvent.data.nonce === nonce) finish()
    } catch {
      // Invalid control messages are ignored and cannot affect the evaluation job.
    }
  }
  port.start()
}

function handlePreparedSession(event: MessageEvent<unknown>, envelope: RunnerPreparedSessionEnvelopeV2) {
  const { compiledProject, document, nonce } = envelope
  if (activeWorkers.has(nonce)) return
  const port = event.ports[0]
  const postSessionError = (message: string) => {
    port.postMessage({
      type: 'caemble-runner-session-error-v2',
      nonce,
      message,
    })
  }
  let worker: Worker
  try {
    worker = new Worker(new URL('./evaluation.worker.ts', import.meta.url), { type: 'module' })
  } catch (error) {
    postSessionError(error instanceof Error ? error.message : 'The prepared evaluation Worker could not be created.')
    port.close()
    return
  }
  activeWorkers.set(nonce, worker)

  let activeRequest: RunnerPreparedEvaluationRequestV2 | null = null
  let finished = false
  let prepared = false
  let workerReady = false
  const finish = () => {
    if (finished) return
    finished = true
    activeWorkers.delete(nonce)
    worker.terminate()
    port.close()
  }
  worker.onmessage = (workerEvent: MessageEvent<unknown>) => {
    try {
      if (!workerReady) {
        if (
          typeof workerEvent.data !== 'object' ||
          workerEvent.data === null ||
          Array.isArray(workerEvent.data) ||
          !('type' in workerEvent.data) ||
          workerEvent.data.type !== 'caemble-runner-worker-ready-v2' ||
          Object.keys(workerEvent.data).length !== 1
        ) {
          throw new Error('The prepared evaluation Worker did not send a valid ready signal.')
        }
        workerReady = true
        worker.postMessage(envelope)
        return
      }
      if (!prepared) {
        assertRunnerPreparedSessionReadyEnvelopeV2(workerEvent.data)
        if (
          workerEvent.data.nonce !== nonce ||
          workerEvent.data.documentType !== document.kind ||
          workerEvent.data.sourceHash !== compiledProject.sourceHash
        ) {
          throw new Error('The prepared evaluation Worker identity is invalid.')
        }
        prepared = true
        port.postMessage(workerEvent.data)
        return
      }

      assertRunnerEvaluationResultEnvelopeV2(workerEvent.data)
      const request = activeRequest
      if (
        !request ||
        workerEvent.data.nonce !== nonce ||
        workerEvent.data.response.requestId !== request.requestId ||
        workerEvent.data.response.revision !== request.revision ||
        workerEvent.data.response.documentType !== document.kind ||
        (workerEvent.data.response.type === 'document-success' &&
          (workerEvent.data.response.snapshot.sourceHash !== compiledProject.sourceHash ||
            workerEvent.data.response.snapshot.seed !== request.realizationSeed))
      ) {
        throw new Error('The prepared evaluation Worker response identity is invalid.')
      }
      activeRequest = null
      port.postMessage(
        workerEvent.data,
        workerEvent.data.response.type === 'document-success'
          ? cadSnapshotTransferables(workerEvent.data.response.snapshot.scene)
          : [],
      )
    } catch (error) {
      postSessionError(
        error instanceof Error ? error.message : 'The prepared evaluation Worker returned an invalid response.',
      )
      finish()
    }
  }
  worker.onerror = (workerError) => {
    postSessionError(workerError.message || 'The prepared evaluation Worker failed.')
    finish()
  }
  port.onmessage = (portEvent: MessageEvent<unknown>) => {
    if (
      typeof portEvent.data === 'object' &&
      portEvent.data !== null &&
      'type' in portEvent.data &&
      portEvent.data.type === 'caemble-runner-cancel-v2'
    ) {
      try {
        assertRunnerCancelEnvelopeV2(portEvent.data)
        if (portEvent.data.nonce === nonce) finish()
      } catch {
        // Invalid control messages cannot affect the prepared session.
      }
      return
    }
    try {
      assertRunnerPreparedEvaluationEnvelopeV2(portEvent.data)
      if (portEvent.data.nonce !== nonce || !prepared || activeRequest !== null) {
        throw new Error('The prepared evaluation request state is invalid.')
      }
      activeRequest = portEvent.data.request
      worker.postMessage(portEvent.data)
    } catch (error) {
      postSessionError(error instanceof Error ? error.message : 'The prepared evaluation request is invalid.')
      finish()
    }
  }
  port.start()
}

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (event.ports.length !== 1) return
  if (!allowedHostOrigins.has(event.origin)) {
    if (
      typeof event.data === 'object'
      && event.data !== null
      && 'type' in event.data
      && event.data.type === 'caemble-runner-prepare-v2'
      && 'nonce' in event.data
      && typeof event.data.nonce === 'string'
    ) {
      event.ports[0].postMessage({
        type: 'caemble-runner-session-error-v2',
        nonce: event.data.nonce,
        message: 'The prepared evaluation host origin is not allowed.',
      })
      event.ports[0].close()
    }
    return
  }
  if (
    typeof event.data === 'object'
    && event.data !== null
    && 'type' in event.data
    && event.data.type === 'caemble-runner-simulate-v3'
  ) {
    try {
      assertRunnerSimulationEnvelopeV3(event.data)
      handleSimulation(event, event.data)
    } catch {
      // Invalid cross-origin messages are ignored.
    }
    return
  }
  if (
    typeof event.data === 'object' &&
    event.data !== null &&
    'type' in event.data &&
    event.data.type === 'caemble-runner-prepare-v2'
  ) {
    try {
      assertRunnerPreparedSessionEnvelopeV2(event.data)
      handlePreparedSession(event, event.data)
    } catch (error) {
      const nonce = 'nonce' in event.data ? event.data.nonce : null
      if (typeof nonce !== 'string') return
      event.ports[0].postMessage({
        type: 'caemble-runner-session-error-v2',
        nonce,
        message: error instanceof Error ? error.message : 'The prepared evaluation request is invalid.',
      })
      event.ports[0].close()
    }
    return
  }
  try {
    assertRunnerEvaluationEnvelopeV2(event.data)
    handleOneShotEvaluation(event, event.data)
  } catch {
    // Invalid cross-origin messages are ignored.
  }
})

allowedHostOrigins.forEach((origin) => {
  window.parent.postMessage({ type: 'caemble-runner-frame-ready-v2' }, origin)
})
