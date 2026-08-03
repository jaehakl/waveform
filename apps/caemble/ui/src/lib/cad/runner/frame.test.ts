import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CAD_COMPILER_VERSION } from '../compiler/types'
import type {
  RunnerEvaluationEnvelopeV2,
  RunnerPreparedEvaluationEnvelopeV2,
  RunnerPreparedSessionEnvelopeV2,
} from './protocol'

type WorkerMessageHandler = (event: MessageEvent<unknown>) => void

const windowMessageHandlers: WorkerMessageHandler[] = []
const frameReadyMessages: Array<Readonly<{ message: unknown; origin: string }>> = []

class FakeWorker {
  static instances: FakeWorker[] = []
  readonly messages: unknown[] = []
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessage: WorkerMessageHandler | null = null
  terminated = false

  constructor() {
    FakeWorker.instances.push(this)
  }

  postMessage(message: unknown) {
    this.messages.push(message)
  }

  terminate() {
    this.terminated = true
  }
}

const request: RunnerEvaluationEnvelopeV2 = {
  type: 'caemble-runner-evaluate-v2',
  nonce: '12345678-1234-1234-1234-123456789abc',
  request: {
    type: 'evaluate-document',
    requestId: 'request-1',
    revision: 2,
    document: { apiVersion: 2, kind: 'structure', realizationSeed: 7 },
    compiledProject: {
      apiVersion: 2,
      compilerVersion: CAD_COMPILER_VERSION,
      entryFile: 'structure.tsx',
      modules: { 'structure.tsx': { code: 'module.exports.default = {}' } },
      sourceHash: 'b'.repeat(64),
    },
  },
}
const preparedSession: RunnerPreparedSessionEnvelopeV2 = {
  type: 'caemble-runner-prepare-v2',
  nonce: '87654321-4321-4321-4321-cba987654321',
  document: { apiVersion: 2, kind: 'structure' },
  compiledProject: request.request.compiledProject,
}

describe('isolated runner frame', () => {
  beforeAll(async () => {
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal('window', {
      location: { origin: 'http://127.0.0.1:5174', protocol: 'http:', port: '5174' },
      parent: {
        postMessage(message: unknown, origin: string) {
          frameReadyMessages.push({ message, origin })
        },
      },
      addEventListener(type: string, handler: WorkerMessageHandler) {
        if (type === 'message') windowMessageHandlers.push(handler)
      },
    })
    await import('./frame')
  })

  beforeEach(() => {
    FakeWorker.instances = []
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('starts the model timeout phase only after the disposable Worker is ready', () => {
    expect(frameReadyMessages).toEqual([
      { message: { type: 'caemble-runner-frame-ready-v2' }, origin: 'http://127.0.0.1:5173' },
      { message: { type: 'caemble-runner-frame-ready-v2' }, origin: 'http://localhost:5173' },
      { message: { type: 'caemble-runner-frame-ready-v2' }, origin: 'http://[::1]:5173' },
    ])
    const messages: unknown[] = []
    const port = {
      closed: false,
      onmessage: null as WorkerMessageHandler | null,
      postMessage(message: unknown) {
        messages.push(message)
      },
      start: vi.fn(),
      close() {
        this.closed = true
      },
    }

    windowMessageHandlers[0]({
      data: request,
      origin: 'http://127.0.0.1:5172',
      ports: [port],
    } as unknown as MessageEvent<unknown>)

    expect(FakeWorker.instances).toEqual([])

    windowMessageHandlers[0]({
      data: request,
      origin: 'http://127.0.0.1:5173',
      ports: [port],
    } as unknown as MessageEvent<unknown>)

    const worker = FakeWorker.instances[0]
    expect(worker.messages).toEqual([])

    worker.onmessage?.({
      data: { type: 'caemble-runner-worker-ready-v2' },
    } as MessageEvent<unknown>)

    expect(messages).toEqual([
      {
        type: 'caemble-runner-started-v2',
        nonce: request.nonce,
        requestId: request.request.requestId,
        revision: request.request.revision,
        documentType: request.request.document.kind,
      },
    ])
    expect(worker.messages).toEqual([request])

    worker.onmessage?.({
      data: {
        type: 'caemble-runner-result-v2',
        nonce: request.nonce,
        response: {
          type: 'document-error',
          requestId: request.request.requestId,
          revision: request.request.revision,
          documentType: request.request.document.kind,
          errorType: 'runtime',
          message: 'test failure',
        },
      },
    } as MessageEvent<unknown>)

    expect(messages).toHaveLength(2)
    expect(worker.terminated).toBe(true)
    expect(port.closed).toBe(true)
  })

  it('keeps one prepared Worker alive while vars and reroll seeds change', () => {
    const messages: unknown[] = []
    const port = {
      closed: false,
      onmessage: null as WorkerMessageHandler | null,
      postMessage(message: unknown) {
        messages.push(message)
      },
      start: vi.fn(),
      close() {
        this.closed = true
      },
    }

    windowMessageHandlers[0]({
      data: preparedSession,
      origin: 'http://127.0.0.1:5173',
      ports: [port],
    } as unknown as MessageEvent<unknown>)

    const worker = FakeWorker.instances[0]
    worker.onmessage?.({
      data: { type: 'caemble-runner-worker-ready-v2' },
    } as MessageEvent<unknown>)
    expect(worker.messages).toEqual([preparedSession])

    worker.onmessage?.({
      data: {
        type: 'caemble-runner-prepared-v2',
        nonce: preparedSession.nonce,
        documentType: 'structure',
        sourceHash: preparedSession.compiledProject.sourceHash,
      },
    } as MessageEvent<unknown>)
    expect(messages).toHaveLength(1)

    const firstEvaluation: RunnerPreparedEvaluationEnvelopeV2 = {
      type: 'caemble-runner-evaluate-prepared-v2',
      nonce: preparedSession.nonce,
      request: {
        requestId: 'prepared-1',
        revision: 3,
        realizationSeed: 7,
        vars: { width: 2 },
      },
    }
    port.onmessage?.({ data: firstEvaluation } as MessageEvent<unknown>)
    expect(worker.messages).toEqual([preparedSession, firstEvaluation])

    worker.onmessage?.({
      data: {
        type: 'caemble-runner-result-v2',
        nonce: preparedSession.nonce,
        response: {
          type: 'document-error',
          requestId: firstEvaluation.request.requestId,
          revision: firstEvaluation.request.revision,
          documentType: 'structure',
          errorType: 'model',
          message: 'first value rejected',
        },
      },
    } as MessageEvent<unknown>)
    expect(worker.terminated).toBe(false)
    expect(port.closed).toBe(false)

    const rerollEvaluation: RunnerPreparedEvaluationEnvelopeV2 = {
      type: 'caemble-runner-evaluate-prepared-v2',
      nonce: preparedSession.nonce,
      request: {
        requestId: 'prepared-reroll',
        revision: 4,
        realizationSeed: 11,
        vars: { width: 3 },
      },
    }
    port.onmessage?.({ data: rerollEvaluation } as MessageEvent<unknown>)
    expect(FakeWorker.instances).toHaveLength(1)
    expect(worker.messages).toEqual([preparedSession, firstEvaluation, rerollEvaluation])

    port.onmessage?.({
      data: { type: 'caemble-runner-cancel-v2', nonce: preparedSession.nonce },
    } as MessageEvent<unknown>)
    expect(worker.terminated).toBe(true)
    expect(port.closed).toBe(true)
  })
})
