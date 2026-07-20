import { describe, expect, it } from 'vitest'
import { measurements } from '@jscad/modeling'
import { h } from '../cad/evaluation/jsx'
import {
  Material,
  type RecordedData,
} from '../cad/model/core'
import { experiment, structure } from '../cad/model/v2'
import { evaluateDocumentEntry } from '../cad/execution/userModule'
import { serializeEvaluatedDocumentSnapshotV2 } from '../cad/execution/snapshot'
import { SolverController } from './controller'
import type { SolverSpec } from './spec'
import type { SolverModule } from './types'

function createPair(name = 'test-solver', version = '1.0.0') {
  const structureDefinition = structure({
    lengthUnit: 'mm',
    geometry: ({ vars }) => {
      function Conductor() {
        return h('box', { size: [vars.length, 2, 2] })
      }
      return h(Conductor, {
        id: 'conductor',
        materials: [new Material('Test', {
          'general.mass_density': {
            dtype: 'float64', value: vars.materialValue, errorRate: 0.1,
            unit: 'kg.m-3',
          },
          color: '#2563eb',
        })],
      })
    },
    varsSchema: {
      length: { min: 10, max: 12 },
      materialValue: { min: 3, max: 4 },
    },
    geometryGroup: { conductor: ['conductor'] },
  })
  const experimentDefinition = experiment({
    lengthUnit: 'mm',
    solver: {
      name,
      version,
      parameters: ({ vars }) => ({
        scale: {
          dtype: 'float64', value: vars.scale,
          unit: '{fraction}', quantityKind: 'DimensionlessRatio',
        },
      }),
    },
    geometry: () => {
      function Probe() {
        return h('box', { size: [1, 1, 1] })
      }
      return h(Probe, { id: 'probe' })
    },
    varsSchema: { scale: { min: 2, max: 5 } },
    recordedData: () => [{
      target: ['structure.geometry.conductor'],
      label: 'Value',
      methodId: 'test.value',
      parameters: {},
      result: {
        dtype: 'float64',
        unit: '{fraction}', quantityKind: 'DimensionlessRatio',
      },
    }],
  })
  return {
    structureSnapshot: serializeEvaluatedDocumentSnapshotV2(evaluateDocumentEntry(
      structureDefinition,
      'structure',
      '1'.repeat(64),
      11,
      { length: 12, materialValue: 4 },
    )),
    experimentSnapshot: serializeEvaluatedDocumentSnapshotV2(evaluateDocumentEntry(
      experimentDefinition,
      'experiment',
      '2'.repeat(64),
      13,
      { scale: 5 },
    )),
  }
}

function valueModule(
  solve?: SolverModule['solve'],
  name = 'test-solver',
  referenceUnit: '{fraction}' | '%' = '{fraction}',
): SolverModule {
  const spec = Object.freeze({
    name,
    version: '1.0.0',
    description: 'Test solver contract.',
    referenceLengthUnit: 'm',
    parameters: {
      scale: {
        description: 'Result scale.',
        value: { dtype: 'float64', quantityKind: 'DimensionlessRatio', referenceUnit },
      },
    },
    materials: [],
    methods: {
      initializations: [],
      boundaryConditions: [],
      recordedData: [{
        methodId: 'test.value',
        description: 'Records one scalar value.',
        minimumOccurrences: 1,
        maximumOccurrences: 1,
        target: {
          source: 'structure',
          kind: 'geometry',
          minimumTargets: 1,
          maximumTargets: 1,
          minimumResolved: 1,
          maximumResolved: 1,
        },
        parameters: {},
        result: {
          dtype: 'float64',
          quantityKind: 'DimensionlessRatio',
          referenceUnit,
        },
      }],
    },
  } as const satisfies SolverSpec)
  return {
    spec,
    solve: solve ?? (async (input) => ({
      Value: { value: (input.structure.vars.materialValue as number) * (input.experiment.vars.scale as number) },
    })),
  }
}

describe('SolverController', () => {
  it('dispatches the exact preview snapshots and publishes process states', async () => {
    const { structureSnapshot, experimentSnapshot } = createPair()
    const previewScene = structureSnapshot.scene
    const originalStructureSnapshot = JSON.stringify(structureSnapshot)
    const states: string[] = []
    const controller = new SolverController([valueModule(async (input) => {
      expect(Object.isFrozen(input)).toBe(true)
      expect(Object.isFrozen(input.structure)).toBe(true)
      expect(Object.isFrozen(input.structure.scene)).toBe(true)
      expect(Object.isFrozen(input.structure.scene.parts)).toBe(true)
      expect(Object.isFrozen(input.structure.scene.parts[0].geometry)).toBe(true)
      expect(Object.isFrozen(input.structure.scene.parts[0].material?.variables)).toBe(true)
      expect(input.structure).not.toHaveProperty('model')
      expect(input.experiment).not.toHaveProperty('model')
      expect(input.structure.provenance.sourceHash).toBe('1'.repeat(64))
      expect(input.experiment.provenance.sourceHash).toBe('2'.repeat(64))
      expect(input.structure.scene.geometryGroups[0].geometryIds).toEqual(['conductor'])
      expect(input.structure.scene.lengthUnit).toBe('m')
      expect(input.experiment.scene.lengthUnit).toBe('m')
      const bounds = measurements.measureBoundingBox(input.structure.scene.parts[0].geometry as never)
      expect(bounds[1][0] - bounds[0][0]).toBeCloseTo(0.012, 12)
      expect(input.structure.scene.parts[0].material?.variables).toEqual(
        previewScene.parts[0].material?.variables,
      )
      const appliedMaterialValue = input.structure.scene.parts[0].material
        ?.variables['general.mass_density'] as { value: number }
      expect(appliedMaterialValue.value).toBeGreaterThanOrEqual(3.6)
      expect(appliedMaterialValue.value).toBeLessThanOrEqual(4.4)
      expect(appliedMaterialValue).not.toHaveProperty('errorRate')
      expect(input.experiment.solver.parameters).toEqual({
        scale: {
          dtype: 'float64', value: 5, unit: '{fraction}', quantityKind: 'DimensionlessRatio',
        },
      })
      return { Value: { value: 20 } }
    })])
    controller.subscribe((process) => states.push(process.status))

    await expect(controller.run(structureSnapshot, experimentSnapshot)).resolves.toEqual({
      Value: { value: 20 },
    })
    expect(states).toEqual(['idle', 'preparing', 'running', 'succeeded'])
    expect(controller.getProcess()).toMatchObject({ status: 'succeeded', error: null })
    expect(structureSnapshot.scene.lengthUnit).toBe('mm')
    expect(JSON.stringify(structureSnapshot)).toBe(originalStructureSnapshot)
  })

  it('converts the same authoring value to each solver spec reference unit', async () => {
    const fractionPair = createPair('solver-fraction')
    const percentPair = createPair('solver-percent')
    let fractionInput: unknown
    let percentInput: unknown
    const fractionSolver = valueModule(async (input) => {
      fractionInput = input.experiment.solver.parameters.scale
      return { Value: { value: 5 } }
    }, 'solver-fraction', '{fraction}')
    const percentSolver = valueModule(async (input) => {
      percentInput = input.experiment.solver.parameters.scale
      return { Value: { value: 500 } }
    }, 'solver-percent', '%')

    const fractionResult = await new SolverController([fractionSolver]).run(
      fractionPair.structureSnapshot,
      fractionPair.experimentSnapshot,
    )
    const percentResult = await new SolverController([percentSolver]).run(
      percentPair.structureSnapshot,
      percentPair.experimentSnapshot,
    )

    expect(fractionInput).toMatchObject({ value: 5, unit: '{fraction}' })
    expect(percentInput).toMatchObject({ value: 500, unit: '%' })
    expect(fractionResult.Value.value).toBe(5)
    expect(percentResult.Value.value).toBe(5)
  })

  it('rejects duplicate and unsupported exact solver identities', async () => {
    expect(() => new SolverController([valueModule(), valueModule()])).toThrow(
      'test-solver@1.0.0 is registered more than once',
    )
    const controller = new SolverController([valueModule()])
    const unsupported = createPair('test-solver', '2.0.0')
    await expect(controller.run(unsupported.structureSnapshot, unsupported.experimentSnapshot)).rejects.toThrow(
      'No solver module is registered for test-solver@2.0.0',
    )
    expect(controller.getProcess().status).toBe('failed')
  })

  it('enforces one active run and cancels through AbortSignal', async () => {
    const { structureSnapshot, experimentSnapshot } = createPair()
    const controller = new SolverController([valueModule((_input, signal) => new Promise<RecordedData>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true })
    }))])

    const active = controller.run(structureSnapshot, experimentSnapshot)
    await expect(controller.run(structureSnapshot, experimentSnapshot)).rejects.toThrow('already active')
    controller.cancel()
    await expect(active).rejects.toThrow()
    expect(controller.getProcess()).toMatchObject({ status: 'cancelled', error: 'Solver run was cancelled.' })
  })

  it('strictly rejects missing, unknown, and invalid RecordedData values', async () => {
    const { structureSnapshot, experimentSnapshot } = createPair()
    for (const result of [
      {},
      { Value: { value: 1 }, Extra: { value: 2 } },
      { Value: { value: [1] } },
    ]) {
      const controller = new SolverController([valueModule(async () => result as RecordedData)])
      await expect(controller.run(structureSnapshot, experimentSnapshot)).rejects.toThrow()
      expect(controller.getProcess().status).toBe('failed')
    }
  })

  it('validates deferred structure targets against the paired Structure scene', async () => {
    const { structureSnapshot } = createPair()
    const experimentDefinition = experiment({ lengthUnit: 'mm',
      solver: {
        name: 'test-solver',
        version: '1.0.0',
        parameters: () => ({
          scale: {
            dtype: 'float64', value: 1,
            unit: '{fraction}', quantityKind: 'DimensionlessRatio',
          },
        }),
      },
      geometry: () => {
        function Probe() {
          return h('box', { size: [1, 1, 1] })
        }
        return h(Probe, { id: 'probe' })
      },
      varsSchema: {},
      recordedData: () => [{
        target: ['structure.geometry.missing'],
        label: 'Value',
        methodId: 'test.value',
        parameters: {},
        result: {
          dtype: 'float64',
          unit: '{fraction}', quantityKind: 'DimensionlessRatio',
        },
      }],
    })
    const controller = new SolverController([valueModule()])
    const experimentSnapshot = serializeEvaluatedDocumentSnapshotV2(evaluateDocumentEntry(
      experimentDefinition,
      'experiment',
      '3'.repeat(64),
      17,
    ))

    await expect(controller.run(structureSnapshot, experimentSnapshot)).rejects.toThrow(
      'references missing structure.geometry.missing',
    )
  })
})
