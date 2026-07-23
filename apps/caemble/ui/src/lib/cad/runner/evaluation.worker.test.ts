import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { CAD_COMPILER_VERSION } from '../compiler/types'
import type { RunnerPreparedEvaluationEnvelopeV2, RunnerPreparedSessionEnvelopeV2 } from './protocol'

const responses: unknown[] = []
const workerScope = {
  onmessage: null as ((event: MessageEvent<unknown>) => void) | null,
  postMessage(message: unknown) {
    responses.push(message)
  },
}
const nonce = '12345678-90ab-cdef-1234-567890abcdef'
const preparedSession: RunnerPreparedSessionEnvelopeV2 = {
  type: 'caemble-runner-prepare-v2',
  nonce,
  document: { apiVersion: 2, kind: 'structure' },
  compiledProject: {
    apiVersion: 2,
    compilerVersion: CAD_COMPILER_VERSION,
    entryFile: 'structure.tsx',
    modules: {
      'structure.tsx': {
        code: `
globalThis.__caemblePreparedLoads = (globalThis.__caemblePreparedLoads ?? 0) + 1
const { structure } = require('@caemble/core/v2')
function Body({ width }) {
  return h('box', { size: [width, 1, 1] })
}
module.exports.default = structure({
  lengthUnit: 'mm',
  varsSchema: { width: { min: 1, max: 10 } },
  geometry: ({ vars }) => h(Body, { id: 'body', width: vars.width }),
})
`,
      },
    },
    sourceHash: 'c'.repeat(64),
  },
}

function dispatch(data: RunnerPreparedSessionEnvelopeV2 | RunnerPreparedEvaluationEnvelopeV2) {
  workerScope.onmessage?.({ data } as MessageEvent<unknown>)
}

describe('prepared evaluation Worker', () => {
  beforeAll(async () => {
    vi.stubGlobal('self', workerScope)
    await import('./evaluation.worker')
  })

  afterAll(() => {
    delete (globalThis as { __caemblePreparedLoads?: number }).__caemblePreparedLoads
    vi.unstubAllGlobals()
  })

  it('loads the compiled module once while vars and reroll seeds change', () => {
    dispatch(preparedSession)
    expect(responses).toContainEqual({
      type: 'caemble-runner-prepared-v2',
      nonce,
      documentType: 'structure',
      sourceHash: preparedSession.compiledProject.sourceHash,
    })

    dispatch({
      type: 'caemble-runner-evaluate-prepared-v2',
      nonce,
      request: {
        requestId: 'prepared-1',
        revision: 1,
        realizationSeed: 7,
        vars: { width: 2 },
      },
    })
    dispatch({
      type: 'caemble-runner-evaluate-prepared-v2',
      nonce,
      request: {
        requestId: 'prepared-reroll',
        revision: 2,
        realizationSeed: 11,
        vars: { width: 4 },
      },
    })

    expect((globalThis as { __caemblePreparedLoads?: number }).__caemblePreparedLoads).toBe(1)
    const results = responses.flatMap((response) =>
      typeof response === 'object' &&
      response !== null &&
      'type' in response &&
      response.type === 'caemble-runner-result-v2' &&
      'response' in response &&
      typeof response.response === 'object' &&
      response.response !== null
        ? [response.response]
        : [],
    )
    expect(results.filter((response) => 'type' in response && response.type === 'document-error')).toEqual([])
    const successes = results.filter((response) => 'type' in response && response.type === 'document-success')
    expect(successes).toHaveLength(2)
    expect(successes[0]).toMatchObject({ revision: 1, snapshot: { seed: 7, variables: { width: 2 } } })
    expect(successes[1]).toMatchObject({ revision: 2, snapshot: { seed: 11, variables: { width: 4 } } })
  })
})
