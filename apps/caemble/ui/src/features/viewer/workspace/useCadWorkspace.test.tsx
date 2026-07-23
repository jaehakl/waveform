// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  compileCadDocument,
  createCadSourceDocumentV2,
  createPreparedEvaluationSession,
  updateCadEntrySource,
  type CadEvaluationResponseV2,
} from '@/lib/cad'
import { useCadWorkspace } from './useCadWorkspace'

vi.mock('@/lib/cad', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cad')>()
  return {
    ...actual,
    compileCadDocument: vi.fn(),
    createPreparedEvaluationSession: vi.fn(),
  }
})

class FakeSolverWorker {
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null

  postMessage() {
    // Solver messages are outside this prepared-evaluation test.
  }

  terminate() {
    // No resources are allocated by the fake Worker.
  }
}

const compiledProject = {
  apiVersion: 2,
  compilerVersion: 'test-compiler',
  entryFile: 'structure.tsx',
  modules: { 'structure.tsx': { code: 'module.exports.default = {}' } },
  sourceHash: 'd'.repeat(64),
} as unknown as Awaited<ReturnType<typeof compileCadDocument>>

describe('useCadWorkspace prepared Structure evaluation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('Worker', FakeSolverWorker)
    vi.mocked(compileCadDocument).mockReset().mockResolvedValue(compiledProject)
    vi.mocked(createPreparedEvaluationSession).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('coalesces vars, reuses the session for Reroll, and replaces it for Source changes', async () => {
    const sessions: Array<{
      callbacks: Parameters<typeof createPreparedEvaluationSession>[2]
      dispose: ReturnType<typeof vi.fn>
      evaluate: ReturnType<typeof vi.fn>
    }> = []
    vi.mocked(createPreparedEvaluationSession).mockImplementation((_project, _documentType, callbacks) => {
      const session = {
        callbacks,
        dispose: vi.fn(),
        evaluate: vi.fn(),
      }
      sessions.push(session)
      queueMicrotask(callbacks.onReady)
      return session
    })

    const document = createCadSourceDocumentV2(
      'structure',
      `export default structure({ lengthUnit: 'mm', varsSchema: {}, geometry: () => null })`,
      7,
    )
    const handleStructureChange = vi.fn()
    const resolveMaterials = vi.fn()
    const initialProps: {
      activeDocument: typeof document
      vars?: { width: number }
    } = { activeDocument: document }
    const render = renderHook(
      ({ activeDocument, vars }: { activeDocument: typeof document; vars?: { width: number } }) =>
        useCadWorkspace(
          activeDocument,
          null,
          handleStructureChange,
          undefined,
          vars,
          undefined,
          resolveMaterials,
          'prepared-vars',
        ),
      { initialProps },
    )
    expect(render.result.current.simulation.run()).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(compileCadDocument).toHaveBeenCalledTimes(1)
    expect(createPreparedEvaluationSession).toHaveBeenCalledTimes(1)
    expect(sessions[0].evaluate).toHaveBeenCalledTimes(1)

    const respondWithError = (callIndex: number) => {
      const request = sessions[0].evaluate.mock.calls[callIndex][0] as {
        requestId: string
        realizationSeed: number
        revision: number
      }
      const response: CadEvaluationResponseV2 = {
        type: 'document-error',
        requestId: request.requestId,
        revision: request.revision,
        documentType: 'structure',
        errorType: 'model',
        message: 'test response',
      }
      act(() => sessions[0].callbacks.onResponse(response))
      return request
    }
    respondWithError(0)

    render.rerender({ activeDocument: document, vars: { width: 2 } })
    await act(async () => Promise.resolve())
    expect(sessions[0].evaluate).toHaveBeenCalledTimes(2)

    render.rerender({ activeDocument: document, vars: { width: 3 } })
    render.rerender({ activeDocument: document, vars: { width: 4 } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(75)
    })
    expect(sessions[0].evaluate).toHaveBeenCalledTimes(2)

    respondWithError(1)
    expect(sessions[0].evaluate).toHaveBeenCalledTimes(3)
    expect(sessions[0].evaluate.mock.calls[2][0]).toMatchObject({ vars: { width: 4 } })
    respondWithError(2)

    const rerolledDocument = Object.freeze({ ...document, realizationSeed: 11 })
    render.rerender({ activeDocument: rerolledDocument, vars: undefined })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(75)
    })
    expect(compileCadDocument).toHaveBeenCalledTimes(1)
    expect(createPreparedEvaluationSession).toHaveBeenCalledTimes(1)
    expect(sessions[0].evaluate).toHaveBeenCalledTimes(4)
    expect(sessions[0].evaluate.mock.calls[3][0]).toMatchObject({ realizationSeed: 11 })
    respondWithError(3)

    const changedSource = updateCadEntrySource(document, `${document.files[document.entryFile]}\n// changed`)
    render.rerender({ activeDocument: changedSource, vars: undefined })
    expect(sessions[0].dispose).toHaveBeenCalledOnce()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(compileCadDocument).toHaveBeenCalledTimes(2)
    expect(createPreparedEvaluationSession).toHaveBeenCalledTimes(2)

    render.unmount()
    expect(sessions[1].dispose).toHaveBeenCalledOnce()
  })
})
