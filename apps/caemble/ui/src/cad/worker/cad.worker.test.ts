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
  lengthUnit: 'mm',
  geometry: () => h(Conductor, {
    id: 'conductor',
    materials: [new Material('Copper', {
      electricalConductivity: {
        dtype: 'float64',
        value: [[5.96e7, 0, 0], [0, 5.96e7, 0], [0, 0, 5.96e7]], errorRate: 0,
        unit: 'S.m-1', quantityKind: 'ElectricConductivity',
      },
    })],
  }),
  varsSchema: { realization: { min: 90, max: 110 } },
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
  lengthUnit: 'mm',
  solver: {
    name: 'dc-current-density',
    version: '2.0.0',
    parameters: () => ({
      conductivityVariable: 'electricalConductivity',
      relativeTolerance: {
        dtype: 'float64', value: 1e-10,
        unit: '{fraction}', quantityKind: 'DimensionlessRatio',
      },
      maxIterations: 1000,
    }),
  },
  geometry: () => h(Probe, { id: 'probe' }),
  varsSchema: { realization: { min: 1, max: 2 } },
  initializations: () => [
    {
      target: ['structure.geometry.conductor'],
      label: 'Voxel grid',
      methodId: 'dc.voxel-grid',
      parameters: {
        gridShape: {
          dtype: 'int32',
          axes: [{ length: 3 }],
          value: [20, 11, 11],
        },
      },
    },
  ],
  boundaryConditions: () => [
    {
      target: ['structure.surface.sourceTerminal'],
      label: 'Source',
      methodId: 'dc.source-potential',
      parameters: {
        voltage: { dtype: 'float64', value: 1, unit: 'mV', quantityKind: 'Voltage' },
      },
    },
    {
      target: ['structure.surface.referenceTerminal'],
      label: 'Reference',
      methodId: 'dc.reference-potential',
      parameters: {
        voltage: { dtype: 'float64', value: 0, unit: 'mV', quantityKind: 'Voltage' },
      },
    },
  ],
  recordedData: () => [
    {
      target: ['structure.geometry.conductor'],
      label: 'Current density',
      methodId: 'dc.current-density',
      parameters: {
        crossSectionPosition: {
          dtype: 'float64', value: 0.5,
          unit: '{fraction}', quantityKind: 'DimensionlessRatio',
        },
      },
      result: {
        dtype: 'float64',
        unit: 'A.m-2',
        quantityKind: 'ElectricCurrentDensity',
        axes: [
          { name: 'cross-section v', unit: 'm', quantityKind: 'Length' },
          { name: 'cross-section u', unit: 'm', quantityKind: 'Length' },
        ],
      },
    },
    {
      target: ['structure.geometry.conductor'],
      label: 'Total current',
      methodId: 'dc.total-current',
      parameters: {
        crossSectionPosition: {
          dtype: 'float64', value: 0.5,
          unit: '{fraction}', quantityKind: 'DimensionlessRatio',
        },
      },
      result: {
        dtype: 'float64',
        unit: 'A', quantityKind: 'ElectricCurrent',
      },
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
      requestId: 'experiment-2',
      revision: 2,
      source: experimentSource,
      documentType: 'experiment',
    })
    const experimentSuccess = await waitForResponse('document-success', 'experiment-2')
    const partialPreflight = await waitForResponse('solver-preflight', 'preflight-none-2')
    if (partialPreflight.type !== 'solver-preflight') throw new Error('Expected a solver-preflight response.')
    expect(partialPreflight.result).toMatchObject({ complete: false, issues: [] })

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
    const structureSuccess = await waitForResponse('document-success', 'structure-2')
    const fullPreflight = await waitForResponse('solver-preflight', 'preflight-2-2')
    if (structureSuccess.type !== 'document-success' || experimentSuccess.type !== 'document-success') {
      throw new Error('Expected document-success responses.')
    }
    if (fullPreflight.type !== 'solver-preflight') throw new Error('Expected a solver-preflight response.')
    expect(fullPreflight.result).toMatchObject({ complete: true, issues: [] })
    expect(fullPreflight.result.spec).toMatchObject({ name: 'dc-current-density', version: '2.0.0' })
    expect(structureSuccess.scene.lengthUnit).toBe('mm')
    expect(experimentSuccess.scene.lengthUnit).toBe('mm')
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
    const heatmap = success.recordedData['Current density'].value as [number, number, number][][]
    expect(heatmap).toHaveLength(11)
    expect(heatmap.every((row) => row.length === 11 && row.every((value) => value.length === 3))).toBe(true)
    expect(heatmap.flat().every((value) => Math.abs(Math.hypot(...value) - 596000) < 1e-6)).toBe(true)
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

  it('creates new Structure and Experiment vars for every document evaluation', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.25)
    try {
      dispatch({
        type: 'evaluate-document',
        requestId: 'structure-3',
        revision: 3,
        source: structureSource,
        documentType: 'structure',
      })
      dispatch({
        type: 'evaluate-document',
        requestId: 'experiment-3',
        revision: 3,
        source: experimentSource,
        documentType: 'experiment',
      })
      const firstStructure = await waitForResponse('document-success', 'structure-3')
      const firstExperiment = await waitForResponse('document-success', 'experiment-3')

      random.mockReturnValue(0.75)
      dispatch({
        type: 'evaluate-document',
        requestId: 'structure-4',
        revision: 4,
        source: structureSource,
        documentType: 'structure',
      })
      dispatch({
        type: 'evaluate-document',
        requestId: 'experiment-4',
        revision: 4,
        source: experimentSource,
        documentType: 'experiment',
      })
      const secondStructure = await waitForResponse('document-success', 'structure-4')
      const secondExperiment = await waitForResponse('document-success', 'experiment-4')

      if (
        firstStructure.type !== 'document-success'
        || firstExperiment.type !== 'document-success'
        || secondStructure.type !== 'document-success'
        || secondExperiment.type !== 'document-success'
      ) throw new Error('Expected document-success responses.')
      expect(firstStructure.variables.realization).toBe(95)
      expect(secondStructure.variables.realization).toBe(105)
      expect(firstExperiment.variables.realization).toBe(1.25)
      expect(secondExperiment.variables.realization).toBe(1.75)
    } finally {
      random.mockRestore()
    }
  })
})
