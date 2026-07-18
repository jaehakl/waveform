import type { CadEvaluationRequestV2, CadEvaluationResponseV2 } from '../worker/protocol'
import {
  assertRunnerEvaluationStartedEnvelopeV2,
  assertRunnerEvaluationResultEnvelopeV2,
  type RunnerCancelEnvelopeV2,
  type RunnerEvaluationEnvelopeV2,
} from './protocol'

type EvaluationCallbacks = Readonly<{
  onFailure: (message: string) => void
  onResponse: (response: CadEvaluationResponseV2) => void
  onStart: () => void
}>

let runnerFrame: Promise<Readonly<{ frame: HTMLIFrameElement; origin: string }>> | null = null
const runnerStartupTimeoutMs = 10_000

function runnerLocation() {
  const configuredOrigin = import.meta.env.VITE_CAEMBLE_RUNNER_ORIGIN?.trim()
  if (!configuredOrigin) {
    if (import.meta.env.PROD) {
      throw new Error('VITE_CAEMBLE_RUNNER_ORIGIN must identify a separate runner origin in production.')
    }
    return new URL('/runner.html', window.location.origin)
  }
  const url = new URL('/runner.html', configuredOrigin)
  if (import.meta.env.PROD && url.origin === window.location.origin) {
    throw new Error('The production CAD runner must use an origin different from the host application.')
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
    frame.src = url.href
    frame.addEventListener('load', () => resolve(Object.freeze({ frame, origin: url.origin })), { once: true })
    frame.addEventListener('error', () => reject(new Error('The isolated CAD runner could not be loaded.')), { once: true })
    document.body.append(frame)
  }).catch((error) => {
    runnerFrame = null
    throw error
  })
  return runnerFrame
}

export function evaluateInIsolatedRunner(
  request: CadEvaluationRequestV2,
  callbacks: EvaluationCallbacks,
) {
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

  void loadRunnerFrame().then(({ frame, origin }) => {
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
          typeof event.data === 'object'
          && event.data !== null
          && 'type' in event.data
          && event.data.type === 'caemble-runner-started-v2'
        ) {
          assertRunnerEvaluationStartedEnvelopeV2(event.data)
          if (
            started
            || event.data.nonce !== nonce
            || event.data.requestId !== request.requestId
            || event.data.revision !== request.revision
            || event.data.documentType !== request.document.kind
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
          event.data.nonce !== nonce
          || event.data.response.requestId !== request.requestId
          || event.data.response.revision !== request.revision
          || event.data.response.documentType !== request.document.kind
          || (
            event.data.response.type === 'document-success'
            && (
              event.data.response.snapshot.sourceHash !== request.compiledProject.sourceHash
              || event.data.response.snapshot.seed !== request.document.realizationSeed
            )
          )
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
  }).catch((error: unknown) => {
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
