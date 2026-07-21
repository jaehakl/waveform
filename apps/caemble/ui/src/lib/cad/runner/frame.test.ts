import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { CAD_COMPILER_VERSION } from '../compiler/types'
import type { RunnerEvaluationEnvelopeV2 } from './protocol'

type WorkerMessageHandler = (event: MessageEvent<unknown>) => void

const windowMessageHandlers: WorkerMessageHandler[] = []

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

describe('isolated runner frame', () => {
  beforeAll(async () => {
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal('window', {
      location: { origin: 'http://127.0.0.1:5174', protocol: 'http:', port: '5174' },
      addEventListener(type: string, handler: WorkerMessageHandler) {
        if (type === 'message') windowMessageHandlers.push(handler)
      },
    })
    await import('./frame')
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('starts the model timeout phase only after the disposable Worker is ready', () => {
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
})
