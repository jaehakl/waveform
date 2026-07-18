import {
  assertRunnerCancelEnvelopeV2,
  assertRunnerEvaluationEnvelopeV2,
  assertRunnerEvaluationResultEnvelopeV2,
} from './protocol'
import { cadSnapshotTransferables } from '../execution/meshValidation'

const configuredHostOrigin = import.meta.env.VITE_CAEMBLE_HOST_ORIGIN?.trim()
const allowedHostOrigin = configuredHostOrigin || window.location.origin
const activeWorkers = new Map<string, Worker>()

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (event.origin !== allowedHostOrigin || event.ports.length !== 1) return
  try {
    assertRunnerEvaluationEnvelopeV2(event.data)
  } catch {
    return
  }
  const { nonce, request } = event.data
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
          typeof workerEvent.data !== 'object'
          || workerEvent.data === null
          || Array.isArray(workerEvent.data)
          || !('type' in workerEvent.data)
          || workerEvent.data.type !== 'caemble-runner-worker-ready-v2'
          || Object.keys(workerEvent.data).length !== 1
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
        worker.postMessage(event.data)
        keepWorker = true
        return
      }
      assertRunnerEvaluationResultEnvelopeV2(workerEvent.data)
      if (
        workerEvent.data.nonce !== nonce
        || workerEvent.data.response.requestId !== request.requestId
        || workerEvent.data.response.revision !== request.revision
        || workerEvent.data.response.documentType !== request.document.kind
        || (
          workerEvent.data.response.type === 'document-success'
          && (
            workerEvent.data.response.snapshot.sourceHash !== request.compiledProject.sourceHash
            || workerEvent.data.response.snapshot.seed !== request.document.realizationSeed
          )
        )
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
})
