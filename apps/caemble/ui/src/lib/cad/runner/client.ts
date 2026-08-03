import type { CadEvaluationRequestV2, CadEvaluationResponseV2 } from '../worker/protocol'
import {
  assertRunnerEvaluationStartedEnvelopeV2,
  assertRunnerEvaluationResultEnvelopeV2,
  assertRunnerPreparedSessionErrorEnvelopeV2,
  assertRunnerPreparedSessionReadyEnvelopeV2,
  assertRunnerSimulationResultEnvelopeV3,
  assertRunnerSimulationStartedEnvelopeV3,
  type RunnerCancelEnvelopeV2,
  type RunnerEvaluationEnvelopeV2,
  type RunnerPreparedEvaluationEnvelopeV2,
  type RunnerPreparedEvaluationRequestV2,
  type RunnerPreparedSessionEnvelopeV2,
  type RunnerSimulationEnvelopeV3,
  type SimulationRunRequestV3,
  type SimulationRunResponseV3,
} from './protocol'

type EvaluationCallbacks = Readonly<{
  onFailure: (message: string) => void
  onResponse: (response: CadEvaluationResponseV2) => void
  onStart: () => void
}>

type PreparedEvaluationCallbacks = Readonly<{
  onFailure: (message: string) => void
  onReady: () => void
  onResponse: (response: CadEvaluationResponseV2) => void
}>

type SimulationCallbacksV3 = Readonly<{
  onFailure: (message: string) => void
  onResponse: (response: SimulationRunResponseV3) => void
  onStart: () => void
}>

export type PreparedEvaluationSession = Readonly<{
  dispose: () => void
  evaluate: (request: RunnerPreparedEvaluationRequestV2) => void
}>

let runnerFrame: Promise<Readonly<{ frame: HTMLIFrameElement; origin: string }>> | null = null
const runnerStartupTimeoutMs = 10_000
const simulationExecutionTimeoutMs = 30_000

function runnerLocation() {
  const configuredOrigin = import.meta.env.VITE_CAEMBLE_RUNNER_ORIGIN?.trim()
  if (!configuredOrigin) {
    if (import.meta.env.PROD) {
      throw new Error('VITE_CAEMBLE_RUNNER_ORIGIN must identify a separate runner origin in production.')
    }
    const hostPort = Number(window.location.port)
    if (!Number.isInteger(hostPort) || hostPort < 1 || hostPort >= 65_535) {
      throw new Error('The development CAD runner requires an explicit host port.')
    }
    const url = new URL('/runner.html', window.location.origin)
    url.hostname = 'localhost'
    url.port = String(hostPort + 1)
    return url
  }
  const url = new URL('/runner.html', configuredOrigin)
  if (url.origin === window.location.origin) {
    throw new Error('The CAD runner must use an origin different from the host application.')
  }
  return url
}

function loadRunnerFrame() {
  runnerFrame ??= new Promise<Readonly<{ frame: HTMLIFrameElement; origin: string }>>((resolve, reject) => {
    let url: URL
    try {
      url = runnerLocation()
    } catch (error) {
      reject(error)
      return
    }
    const frame = document.createElement('iframe')
    frame.hidden = true
    frame.setAttribute('aria-hidden', 'true')
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin')
    frame.referrerPolicy = 'no-referrer'
    const handleReady = (event: MessageEvent<unknown>) => {
      if (
        event.source !== frame.contentWindow
        || event.origin !== url.origin
        || typeof event.data !== 'object'
        || event.data === null
        || Array.isArray(event.data)
        || !('type' in event.data)
        || event.data.type !== 'caemble-runner-frame-ready-v2'
        || Object.keys(event.data).length !== 1
      ) {
        return
      }
      window.removeEventListener('message', handleReady)
      frame.removeEventListener('error', handleError)
      resolve(Object.freeze({ frame, origin: url.origin }))
    }
    const handleError = () => {
      window.removeEventListener('message', handleReady)
      reject(new Error('The isolated CAD runner could not be loaded.'))
    }
    window.addEventListener('message', handleReady)
    frame.addEventListener('error', handleError, { once: true })
    frame.src = url.href
    document.body.append(frame)
  }).catch((error) => {
    runnerFrame = null
    throw error
  })
  return runnerFrame
}

export function evaluateInIsolatedRunner(request: CadEvaluationRequestV2, callbacks: EvaluationCallbacks) {
  const nonce = crypto.randomUUID()
  let cancelled = false
  let port: MessagePort | null = null
  let started = false
  const startupTimeout = window.setTimeout(() => {
    if (cancelled || started) return
    cancelled = true
    if (port) {
      const cancel: RunnerCancelEnvelopeV2 = { type: 'caemble-runner-cancel-v2', nonce }
      port.postMessage(cancel)
      port.close()
      port = null
    }
    callbacks.onFailure(`The isolated CAD runner did not initialize within ${runnerStartupTimeoutMs / 1000} seconds.`)
  }, runnerStartupTimeoutMs)

  void loadRunnerFrame()
    .then(({ frame, origin }) => {
      if (cancelled) return
      const targetWindow = frame.contentWindow
      if (!targetWindow) throw new Error('The isolated CAD runner window is unavailable.')
      const channel = new MessageChannel()
      port = channel.port1
      channel.port1.onmessage = (event: MessageEvent<unknown>) => {
        if (cancelled) return
        let keepPortOpen = false
        try {
          if (
            typeof event.data === 'object' &&
            event.data !== null &&
            'type' in event.data &&
            event.data.type === 'caemble-runner-started-v2'
          ) {
            assertRunnerEvaluationStartedEnvelopeV2(event.data)
            if (
              started ||
              event.data.nonce !== nonce ||
              event.data.requestId !== request.requestId ||
              event.data.revision !== request.revision ||
              event.data.documentType !== request.document.kind
            ) {
              throw new Error('The isolated CAD runner start identity is invalid.')
            }
            started = true
            window.clearTimeout(startupTimeout)
            callbacks.onStart()
            keepPortOpen = true
            return
          }
          assertRunnerEvaluationResultEnvelopeV2(event.data)
          if (
            event.data.nonce !== nonce ||
            event.data.response.requestId !== request.requestId ||
            event.data.response.revision !== request.revision ||
            event.data.response.documentType !== request.document.kind ||
            (event.data.response.type === 'document-success' &&
              (event.data.response.snapshot.sourceHash !== request.compiledProject.sourceHash ||
                event.data.response.snapshot.seed !== request.document.realizationSeed))
          ) {
            throw new Error('The isolated CAD runner response identity is invalid.')
          }
          callbacks.onResponse(event.data.response)
        } catch (error) {
          callbacks.onFailure(error instanceof Error ? error.message : String(error))
        } finally {
          if (!keepPortOpen) {
            window.clearTimeout(startupTimeout)
            channel.port1.close()
            port = null
          }
        }
      }
      channel.port1.onmessageerror = () => {
        window.clearTimeout(startupTimeout)
        callbacks.onFailure('The isolated CAD runner response could not be decoded.')
        channel.port1.close()
        port = null
      }
      channel.port1.start()
      const envelope: RunnerEvaluationEnvelopeV2 = {
        type: 'caemble-runner-evaluate-v2',
        nonce,
        request,
      }
      targetWindow.postMessage(envelope, origin, [channel.port2])
    })
    .catch((error: unknown) => {
      if (!cancelled) {
        window.clearTimeout(startupTimeout)
        callbacks.onFailure(error instanceof Error ? error.message : String(error))
      }
    })

  return () => {
    cancelled = true
    window.clearTimeout(startupTimeout)
    if (!port) return
    const cancel: RunnerCancelEnvelopeV2 = { type: 'caemble-runner-cancel-v2', nonce }
    port.postMessage(cancel)
    port.close()
    port = null
  }
}

export function simulateInIsolatedRunnerV3(request: SimulationRunRequestV3, callbacks: SimulationCallbacksV3) {
  const nonce = crypto.randomUUID()
  let cancelled = false
  let port: MessagePort | null = null
  let started = false
  let executionTimeout = 0
  const startupTimeout = window.setTimeout(() => {
    if (cancelled || started) return
    cancelled = true
    if (port) {
      const cancel: RunnerCancelEnvelopeV2 = { type: 'caemble-runner-cancel-v2', nonce }
      port.postMessage(cancel)
      port.close()
      port = null
    }
    callbacks.onFailure(`The isolated Simulation runner did not initialize within ${runnerStartupTimeoutMs / 1000} seconds.`)
  }, runnerStartupTimeoutMs)

  void loadRunnerFrame()
    .then(({ frame, origin }) => {
      if (cancelled) return
      const targetWindow = frame.contentWindow
      if (!targetWindow) throw new Error('The isolated Simulation runner window is unavailable.')
      const channel = new MessageChannel()
      port = channel.port1
      channel.port1.onmessage = (event: MessageEvent<unknown>) => {
        if (cancelled) return
        let keepPortOpen = false
        try {
          if (
            typeof event.data === 'object'
            && event.data !== null
            && 'type' in event.data
            && event.data.type === 'caemble-runner-simulation-started-v3'
          ) {
            assertRunnerSimulationStartedEnvelopeV3(event.data)
            if (
              started
              || event.data.nonce !== nonce
              || event.data.requestId !== request.requestId
              || event.data.structureRevision !== request.structureRevision
              || event.data.experimentRevision !== request.experimentRevision
            ) {
              throw new Error('The isolated Simulation runner start identity is invalid.')
            }
            started = true
            window.clearTimeout(startupTimeout)
            executionTimeout = window.setTimeout(() => {
              if (cancelled || !port) return
              cancelled = true
              const cancel: RunnerCancelEnvelopeV2 = { type: 'caemble-runner-cancel-v2', nonce }
              port.postMessage(cancel)
              port.close()
              port = null
              callbacks.onFailure(
                `The Simulation run exceeded its ${simulationExecutionTimeoutMs / 1000} second execution budget.`,
              )
            }, simulationExecutionTimeoutMs)
            callbacks.onStart()
            keepPortOpen = true
            return
          }
          assertRunnerSimulationResultEnvelopeV3(event.data)
          if (
            event.data.nonce !== nonce
            || event.data.response.requestId !== request.requestId
            || event.data.response.structureRevision !== request.structureRevision
            || event.data.response.experimentRevision !== request.experimentRevision
          ) {
            throw new Error('The isolated Simulation runner response identity is invalid.')
          }
          callbacks.onResponse(event.data.response)
        } catch (error) {
          callbacks.onFailure(error instanceof Error ? error.message : String(error))
        } finally {
          if (!keepPortOpen) {
            window.clearTimeout(startupTimeout)
            window.clearTimeout(executionTimeout)
            channel.port1.close()
            port = null
          }
        }
      }
      channel.port1.onmessageerror = () => {
        window.clearTimeout(startupTimeout)
        window.clearTimeout(executionTimeout)
        callbacks.onFailure('The isolated Simulation runner response could not be decoded.')
        channel.port1.close()
        port = null
      }
      channel.port1.start()
      const envelope: RunnerSimulationEnvelopeV3 = {
        type: 'caemble-runner-simulate-v3',
        nonce,
        request,
      }
      targetWindow.postMessage(envelope, origin, [channel.port2])
    })
    .catch((error: unknown) => {
      if (!cancelled) {
        window.clearTimeout(startupTimeout)
        window.clearTimeout(executionTimeout)
        callbacks.onFailure(error instanceof Error ? error.message : String(error))
      }
    })

  return () => {
    cancelled = true
    window.clearTimeout(startupTimeout)
    window.clearTimeout(executionTimeout)
    if (!port) return
    const cancel: RunnerCancelEnvelopeV2 = { type: 'caemble-runner-cancel-v2', nonce }
    port.postMessage(cancel)
    port.close()
    port = null
  }
}

export function createPreparedEvaluationSession(
  compiledProject: CadEvaluationRequestV2['compiledProject'],
  documentType: CadEvaluationRequestV2['document']['kind'],
  callbacks: PreparedEvaluationCallbacks,
): PreparedEvaluationSession {
  const nonce = crypto.randomUUID()
  let activeRequest: RunnerPreparedEvaluationRequestV2 | null = null
  let disposed = false
  let port: MessagePort | null = null
  let ready = false

  const closePort = (sendCancel: boolean) => {
    if (!port) return
    if (sendCancel) {
      const cancel: RunnerCancelEnvelopeV2 = { type: 'caemble-runner-cancel-v2', nonce }
      port.postMessage(cancel)
    }
    port.close()
    port = null
  }
  const dispose = () => {
    if (disposed) return
    disposed = true
    window.clearTimeout(startupTimeout)
    activeRequest = null
    closePort(true)
  }
  const fail = (message: string) => {
    if (disposed) return
    dispose()
    callbacks.onFailure(message)
  }
  const startupTimeout = window.setTimeout(() => {
    fail(`The prepared CAD runner did not initialize within ${runnerStartupTimeoutMs / 1000} seconds.`)
  }, runnerStartupTimeoutMs)

  void loadRunnerFrame()
    .then(({ frame, origin }) => {
      if (disposed) return
      const targetWindow = frame.contentWindow
      if (!targetWindow) throw new Error('The isolated CAD runner window is unavailable.')
      const channel = new MessageChannel()
      port = channel.port1
      channel.port1.onmessage = (event: MessageEvent<unknown>) => {
        if (disposed) return
        try {
          if (
            typeof event.data === 'object' &&
            event.data !== null &&
            'type' in event.data &&
            event.data.type === 'caemble-runner-prepared-v2'
          ) {
            assertRunnerPreparedSessionReadyEnvelopeV2(event.data)
            if (
              ready ||
              event.data.nonce !== nonce ||
              event.data.documentType !== documentType ||
              event.data.sourceHash !== compiledProject.sourceHash
            ) {
              throw new Error('The prepared CAD runner identity is invalid.')
            }
            ready = true
            window.clearTimeout(startupTimeout)
            callbacks.onReady()
            return
          }
          if (
            typeof event.data === 'object' &&
            event.data !== null &&
            'type' in event.data &&
            event.data.type === 'caemble-runner-session-error-v2'
          ) {
            assertRunnerPreparedSessionErrorEnvelopeV2(event.data)
            if (event.data.nonce !== nonce) throw new Error('The prepared CAD runner error identity is invalid.')
            fail(event.data.message)
            return
          }
          assertRunnerEvaluationResultEnvelopeV2(event.data)
          const request = activeRequest
          if (
            !ready ||
            !request ||
            event.data.nonce !== nonce ||
            event.data.response.requestId !== request.requestId ||
            event.data.response.revision !== request.revision ||
            event.data.response.documentType !== documentType ||
            (event.data.response.type === 'document-success' &&
              (event.data.response.snapshot.sourceHash !== compiledProject.sourceHash ||
                event.data.response.snapshot.seed !== request.realizationSeed))
          ) {
            throw new Error('The prepared CAD runner response identity is invalid.')
          }
          activeRequest = null
          callbacks.onResponse(event.data.response)
        } catch (error) {
          fail(error instanceof Error ? error.message : String(error))
        }
      }
      channel.port1.onmessageerror = () => {
        fail('The prepared CAD runner response could not be decoded.')
      }
      channel.port1.start()
      const envelope: RunnerPreparedSessionEnvelopeV2 = {
        type: 'caemble-runner-prepare-v2',
        nonce,
        document: { apiVersion: 2, kind: documentType },
        compiledProject,
      }
      targetWindow.postMessage(envelope, origin, [channel.port2])
    })
    .catch((error: unknown) => {
      fail(error instanceof Error ? error.message : String(error))
    })

  return {
    dispose,
    evaluate(request) {
      if (disposed || !ready || !port) throw new Error('The prepared CAD runner is not ready.')
      if (activeRequest) throw new Error('The prepared CAD runner is already evaluating a request.')
      activeRequest = request
      const envelope: RunnerPreparedEvaluationEnvelopeV2 = {
        type: 'caemble-runner-evaluate-prepared-v2',
        nonce,
        request,
      }
      port.postMessage(envelope)
    },
  }
}
