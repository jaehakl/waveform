import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { CadWorkerRequest, CadWorkerResponse } from './protocol'

const esbuild = vi.hoisted(() => ({
  initialize: vi.fn(async () => undefined),
  transform: vi.fn(async (source: string) => {
    if (source.startsWith('/* slow */')) {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    return { code: source }
  }),
}))

vi.mock('esbuild-wasm', () => esbuild)

const responses: CadWorkerResponse[] = []
const workerScope = {
  onmessage: null as ((event: MessageEvent<CadWorkerRequest>) => void) | null,
  postMessage: (response: CadWorkerResponse) => responses.push(response),
}

const structureSource = `
const { Material, Sample, Structure } = require('@caemble/core')
function Conductor() { return h('box', { size: [100, 5, 5] }) }
const structure = new Structure({
  geometry: () => h(Conductor, {
    id: 'conductor',
    materials: [new Material('Copper', { electricalConductivity: 5.96e7 })],
  }),
  varsSchema: {},
  geometryGroup: { conductor: ['conductor'] },
  surfaceGroup: {
    sourceTerminal: ['conductor/surface-1'],
    referenceTerminal: ['conductor/surface-2'],
  },
})
module.exports.default = new Sample(structure)
`

const experimentSource = `
const { Experiment, Setup } = require('@caemble/core')
function Probe() { return h('box', { size: [1, 1, 1] }) }
const experiment = new Experiment({
  solver: {
    name: 'dc-current-density',
    version: '1.0.0',
    parameters: () => ({
      lengthScaleToMeters: 0.001,
      conductivityVariable: 'electricalConductivity',
      gridShape: [20, 11, 11],
      crossSectionPosition: 0.5,
      relativeTolerance: 1e-10,
      maxIterations: 1000,
    }),
  },
  geometry: () => h(Probe, { id: 'probe' }),
  varsSchema: {},
  boundaryConditions: () => [
    {
      target: ['structure.surface.sourceTerminal'],
      label: 'Source',
      methodId: 'dc.source-potential',
      parameters: { voltage: 0.001 },
    },
    {
      target: ['structure.surface.referenceTerminal'],
      label: 'Reference',
      methodId: 'dc.reference-potential',
      parameters: { voltage: 0 },
    },
  ],
  recordedData: () => [
    {
      target: ['structure.geometry.conductor'],
      label: 'Current density',
      methodId: 'dc.current-density',
      parameters: {},
      result: {
        type: 'tensor',
        dimension: 2,
        shape: [-1, -1],
        dtype: 'float64',
        axes: [
          { name: 'cross-section v (m)' },
          { name: 'cross-section u (m)' },
        ],
      },
    },
    {
      target: ['structure.geometry.conductor'],
      label: 'Total current',
      methodId: 'dc.total-current',
      parameters: {},
      result: { type: 'tensor', dimension: 0, shape: [], dtype: 'float64' },
    },
  ],
})
module.exports.default = new Setup(experiment)
`

function dispatch(request: CadWorkerRequest) {
  workerScope.onmessage?.({ data: request } as MessageEvent<CadWorkerRequest>)
}

async function waitForResponse(type: CadWorkerResponse['type'], requestId: string) {
  await vi.waitFor(() => {
    expect(responses.some((response) => response.type === type && response.requestId === requestId)).toBe(true)
  })
  return responses.find((response) => response.type === type && response.requestId === requestId)!
}

describe('persistent CAD Worker', () => {
  beforeAll(async () => {
    vi.stubGlobal('self', workerScope)
    await import('./cad.worker')
  })

  afterAll(() => vi.unstubAllGlobals())

  it('caches only the latest revisions, combines both instances, rejects stale runs, and cancels', async () => {
    dispatch({
      type: 'evaluate-document',
      requestId: 'structure-1',
      revision: 1,
      source: `/* slow */${structureSource}`,
      documentType: 'structure',
    })
    dispatch({
      type: 'evaluate-document',
      requestId: 'structure-2',
      revision: 2,
      source: structureSource,
      documentType: 'structure',
    })
    dispatch({
      type: 'evaluate-document',
      requestId: 'experiment-2',
      revision: 2,
      source: experimentSource,
      documentType: 'experiment',
    })

    await waitForResponse('document-success', 'structure-2')
    await waitForResponse('document-success', 'experiment-2')
    expect(esbuild.initialize).toHaveBeenCalledTimes(1)
    expect(responses.some((response) => response.requestId === 'structure-1')).toBe(false)

    dispatch({
      type: 'run-solver',
      requestId: 'stale-run',
      structureRevision: 1,
      experimentRevision: 2,
    })
    await waitForResponse('solver-error', 'stale-run')

    dispatch({
      type: 'run-solver',
      requestId: 'valid-run',
      structureRevision: 2,
      experimentRevision: 2,
    })
    const success = await waitForResponse('solver-success', 'valid-run')
    if (success.type !== 'solver-success') throw new Error('Expected a solver-success response.')
    const heatmap = success.recordedData['Current density'].value as number[][]
    expect(heatmap).toHaveLength(11)
    expect(heatmap.every((row) => row.length === 11)).toBe(true)
    expect(heatmap.flat().every((value) => Math.abs(value - 596000) < 1e-6)).toBe(true)
    expect(success.recordedData['Current density'].axes?.[0].ticks).toHaveLength(11)
    expect(success.recordedData['Current density'].axes?.[1].ticks).toHaveLength(11)
    expect(success.recordedData['Total current'].value).toBeCloseTo(14.9, 9)

    dispatch({
      type: 'run-solver',
      requestId: 'cancelled-run',
      structureRevision: 2,
      experimentRevision: 2,
    })
    dispatch({ type: 'cancel-solver', requestId: 'cancelled-run' })
    await vi.waitFor(() => {
      expect(responses.some((response) => (
        response.type === 'solver-process'
        && response.requestId === 'cancelled-run'
        && response.process.status === 'cancelled'
      ))).toBe(true)
    })
    expect(responses.some((response) => (
      response.type === 'solver-success' && response.requestId === 'cancelled-run'
    ))).toBe(false)
  })
})
