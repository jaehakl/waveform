import { describe, expect, it } from 'vitest'
import { evaluateCadScene } from '../cad/evaluation/evaluator'
import { h } from '../cad/evaluation/jsx'
import {
  evaluateWithVars,
  Experiment,
  Material,
  Sample,
  Setup,
  Structure,
  vars,
  type RecordedData,
} from '../cad/model/core'
import { SolverController } from './controller'
import type { SolverModule } from './types'

function createPair(name = 'test-solver', version = '1.0.0') {
  function Conductor() {
    return h('box', { size: [vars.length as number, 2, 2] })
  }
  function Probe() {
    return h('box', { size: [1, 1, 1] })
  }
  const structure = new Structure({
    lengthUnit: 'mm',
    geometry: () => h(Conductor, {
      id: 'conductor',
      materials: [new Material('Test', {
        value: { type: 'float', value: vars.materialValue as number, errorRate: 0.1 },
        color: '#2563eb',
      })],
    }),
    varsSchema: {
      length: { min: 10, max: 12 },
      materialValue: { min: 3, max: 4 },
    },
    geometryGroup: { conductor: ['conductor'] },
  })
  const experiment = new Experiment({
    lengthUnit: 'mm',
    solver: {
      name,
      version,
      parameters: () => ({ scale: { type: 'float', value: vars.scale as number } }),
    },
    geometry: () => h(Probe, { id: 'probe' }),
    varsSchema: { scale: { min: 2, max: 5 } },
    recordedData: () => [{
      target: ['structure.geometry.conductor'],
      label: 'Value',
      methodId: 'test.value',
      parameters: {},
      result: { type: 'tensor', dimension: 0, shape: [], dtype: 'float64' },
    }],
  })
  return {
    sample: new Sample(structure, { length: 12, materialValue: 4 }),
    setup: new Setup(experiment, { scale: 5 }),
  }
}

function valueModule(solve?: SolverModule['solve']): SolverModule {
  return {
    name: 'test-solver',
    version: '1.0.0',
    solve: solve ?? (async (input) => ({
      Value: { value: (input.structure.vars.materialValue as number) * (input.experiment.vars.scale as number) },
    })),
  }
}

describe('SolverController', () => {
  it('prepares actual Sample and Setup models, dispatches exactly, and publishes process states', async () => {
    const { sample, setup } = createPair()
    const previewScene = evaluateWithVars(sample.vars, () => evaluateCadScene(sample.structure.geometry(), {
      geometryGroup: sample.structure.geometryGroup,
      surfaceGroup: sample.structure.surfaceGroup,
    }, 'Structure', sample.structure.lengthUnit))
    const states: string[] = []
    const controller = new SolverController([valueModule(async (input) => {
      expect(input.structure.model).toBe(sample.structure)
      expect(input.experiment.model).toBe(setup.experiment)
      expect(input.structure.scene.geometryGroups[0].geometryIds).toEqual(['conductor'])
      expect(input.structure.scene.lengthUnit).toBe('mm')
      expect(input.experiment.scene.lengthUnit).toBe('mm')
      expect(input.structure.scene.parts[0].material?.variables).toEqual(
        previewScene.parts[0].material?.variables,
      )
      const appliedMaterialValue = input.structure.scene.parts[0].material?.variables.value as { value: number }
      expect(appliedMaterialValue.value).toBeGreaterThanOrEqual(3.6)
      expect(appliedMaterialValue.value).toBeLessThanOrEqual(4.4)
      expect(appliedMaterialValue).not.toHaveProperty('errorRate')
      expect(input.experiment.solver.parameters).toEqual({ scale: { type: 'float', value: 5 } })
      return { Value: { value: 20 } }
    })])
    controller.subscribe((process) => states.push(process.status))

    await expect(controller.run(sample, setup)).resolves.toEqual({
      Value: { value: 20, axes: [] },
    })
    expect(states).toEqual(['idle', 'preparing', 'running', 'succeeded'])
    expect(controller.getProcess()).toMatchObject({ status: 'succeeded', error: null })
  })

  it('rejects duplicate and unsupported exact solver identities', async () => {
    expect(() => new SolverController([valueModule(), valueModule()])).toThrow(
      'test-solver@1.0.0 is registered more than once',
    )
    const controller = new SolverController([valueModule()])
    const unsupported = createPair('test-solver', '2.0.0')
    await expect(controller.run(unsupported.sample, unsupported.setup)).rejects.toThrow(
      'No solver module is registered for test-solver@2.0.0',
    )
    expect(controller.getProcess().status).toBe('failed')
  })

  it('enforces one active run and cancels through AbortSignal', async () => {
    const { sample, setup } = createPair()
    const controller = new SolverController([valueModule((_input, signal) => new Promise<RecordedData>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true })
    }))])

    const active = controller.run(sample, setup)
    await expect(controller.run(sample, setup)).rejects.toThrow('already active')
    controller.cancel()
    await expect(active).rejects.toThrow()
    expect(controller.getProcess()).toMatchObject({ status: 'cancelled', error: 'Solver run was cancelled.' })
  })

  it('strictly rejects missing, unknown, and invalid RecordedData values', async () => {
    const { sample, setup } = createPair()
    for (const result of [
      {},
      { Value: { value: 1 }, Extra: { value: 2 } },
      { Value: { value: [1] } },
    ]) {
      const controller = new SolverController([valueModule(async () => result as RecordedData)])
      await expect(controller.run(sample, setup)).rejects.toThrow()
      expect(controller.getProcess().status).toBe('failed')
    }
  })

  it('validates deferred structure targets against the paired Structure scene', async () => {
    const { sample } = createPair()
    function Probe() {
      return h('box', { size: [1, 1, 1] })
    }
    const experiment = new Experiment({ lengthUnit: 'mm',
      solver: { name: 'test-solver', version: '1.0.0', parameters: () => ({}) },
      geometry: () => h(Probe, { id: 'probe' }),
      varsSchema: {},
      recordedData: () => [{
        target: ['structure.geometry.missing'],
        label: 'Value',
        methodId: 'test.value',
        parameters: {},
        result: { type: 'tensor', dimension: 0, shape: [], dtype: 'float64' },
      }],
    })
    const controller = new SolverController([valueModule()])

    await expect(controller.run(sample, new Setup(experiment))).rejects.toThrow(
      'structure.geometry.missing references a missing structure geometry group',
    )
  })
})
