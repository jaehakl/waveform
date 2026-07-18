import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from '../evaluation/jsx'
import { evaluateDocumentEntry } from '../execution/userModule'
import type { EvaluatedDocumentSnapshotV2 } from '../execution/snapshot'
import { serializeEvaluatedDocumentSnapshotV2 } from '../execution/snapshot'
import { Material } from '../model/core'
import { experiment, structure } from '../model/v2'
import type { CadWorkerRequest, CadWorkerResponse } from './protocol'

const responses: CadWorkerResponse[] = []
const workerScope = {
  onmessage: null as ((event: MessageEvent<CadWorkerRequest>) => void) | null,
  postMessage: (response: CadWorkerResponse) => responses.push(response),
}

function createSnapshots() {
  function Conductor() {
    return h('box', { size: [100, 5, 5] })
  }
  function Probe() {
    return h('box', { size: [1, 1, 1] })
  }
  const structureDefinition = structure({
    lengthUnit: 'mm',
    geometry: () => h(Conductor, {
      id: 'conductor',
      materials: [new Material('Copper', {
        electricalConductivity: {
          dtype: 'float64',
          value: [[5.96e7, 0, 0], [0, 5.96e7, 0], [0, 0, 5.96e7]],
          errorRate: 0,
          unit: 'S.m-1',
          quantityKind: 'ElectricConductivity',
        },
      })],
    }),
    varsSchema: {},
    geometryGroup: { conductor: ['conductor'] },
    surfaceGroup: {
      sourceTerminal: ['conductor/surface-1'],
      referenceTerminal: ['conductor/surface-2'],
    },
  })
  const experimentDefinition = experiment({
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
    varsSchema: {},
    initializations: () => [{
      target: ['structure.geometry.conductor'],
      label: 'Voxel grid',
      methodId: 'dc.voxel-grid',
      parameters: { gridShape: { dtype: 'int32', axes: [{ length: 3 }], value: [20, 11, 11] } },
    }],
    boundaryConditions: () => [{
      target: ['structure.surface.sourceTerminal'],
      label: 'Source',
      methodId: 'dc.source-potential',
      parameters: { voltage: { dtype: 'float64', value: 1, unit: 'mV', quantityKind: 'Voltage' } },
    }, {
      target: ['structure.surface.referenceTerminal'],
      label: 'Reference',
      methodId: 'dc.reference-potential',
      parameters: { voltage: { dtype: 'float64', value: 0, unit: 'mV', quantityKind: 'Voltage' } },
    }],
    recordedData: () => [{
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
        dtype: 'float64', unit: 'A.m-2', quantityKind: 'ElectricCurrentDensity',
        axes: [
          { name: 'cross-section v', unit: 'm', quantityKind: 'Length' },
          { name: 'cross-section u', unit: 'm', quantityKind: 'Length' },
        ],
      },
    }, {
      target: ['structure.geometry.conductor'],
      label: 'Total current',
      methodId: 'dc.total-current',
      parameters: {
        crossSectionPosition: {
          dtype: 'float64', value: 0.5,
          unit: '{fraction}', quantityKind: 'DimensionlessRatio',
        },
      },
      result: { dtype: 'float64', unit: 'A', quantityKind: 'ElectricCurrent' },
    }],
  })
  return {
    experiment: serializeEvaluatedDocumentSnapshotV2(
      evaluateDocumentEntry(experimentDefinition, 'experiment', '2'.repeat(64), 2),
    ),
    structure: serializeEvaluatedDocumentSnapshotV2(
      evaluateDocumentEntry(structureDefinition, 'structure', '1'.repeat(64), 1),
    ),
  }
}

function dispatch(request: CadWorkerRequest) {
  workerScope.onmessage?.({ data: request } as MessageEvent<CadWorkerRequest>)
}

async function waitForResponse(type: CadWorkerResponse['type'], requestId: string) {
  await vi.waitFor(() => {
    expect(responses.some((response) => response.type === type && response.requestId === requestId)).toBe(true)
  })
  return responses.find((response) => response.type === type && response.requestId === requestId)!
}

describe('snapshot-only Solver Worker', () => {
  beforeAll(async () => {
    vi.stubGlobal('self', workerScope)
    await import('./cad.worker')
  })

  beforeEach(() => responses.splice(0))
  afterAll(() => vi.unstubAllGlobals())

  it('preflights cached snapshots, rejects stale revisions, solves, and cancels', async () => {
    const snapshots = createSnapshots()
    dispatch({
      type: 'cache-snapshot', requestId: 'cache-experiment', revision: 2, snapshot: snapshots.experiment,
    })
    const partial = await waitForResponse('solver-preflight', 'preflight-none-2')
    if (partial.type !== 'solver-preflight') throw new Error('Expected solver preflight.')
    expect(partial.result).toMatchObject({ complete: false, issues: [] })

    dispatch({ type: 'cache-snapshot', requestId: 'cache-structure', revision: 2, snapshot: snapshots.structure })
    const full = await waitForResponse('solver-preflight', 'preflight-2-2')
    if (full.type !== 'solver-preflight') throw new Error('Expected solver preflight.')
    expect(full.result).toMatchObject({ complete: true, issues: [] })

    dispatch({ type: 'run-solver', requestId: 'stale-run', structureRevision: 1, experimentRevision: 2 })
    await waitForResponse('solver-error', 'stale-run')

    dispatch({ type: 'run-solver', requestId: 'valid-run', structureRevision: 2, experimentRevision: 2 })
    const success = await waitForResponse('solver-success', 'valid-run')
    if (success.type !== 'solver-success') throw new Error('Expected solver success.')
    expect(success.recordedData['Total current'].value).toBeCloseTo(14.9, 9)
    expect(success.provenance).toEqual({
      structure: { apiVersion: 2, sourceHash: '1'.repeat(64), seed: 1, vars: {} },
      experiment: { apiVersion: 2, sourceHash: '2'.repeat(64), seed: 2, vars: {} },
      solver: { name: 'dc-current-density', version: '2.0.0' },
    })

    dispatch({ type: 'run-solver', requestId: 'cancelled-run', structureRevision: 2, experimentRevision: 2 })
    dispatch({ type: 'cancel-solver', requestId: 'cancelled-run' })
    await vi.waitFor(() => {
      expect(responses.some((response) => (
        response.type === 'solver-process'
        && response.requestId === 'cancelled-run'
        && response.process.status === 'cancelled'
      ))).toBe(true)
    })
  })

  it('rejects snapshots with a forged prototype before they reach the Solver', async () => {
    const snapshot = createSnapshots().structure
    const forged = Object.assign(Object.create({ polluted: true }), snapshot) as EvaluatedDocumentSnapshotV2
    dispatch({ type: 'cache-snapshot', requestId: 'forged', revision: 3, snapshot: forged })
    const error = await waitForResponse('solver-error', 'forged')
    if (error.type !== 'solver-error') throw new Error('Expected solver error.')
    expect(error.message).toContain('plain objects')
  })
})
