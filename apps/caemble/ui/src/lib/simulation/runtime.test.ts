import { h } from '../cad/evaluation/jsx'
import { buildSourceOnlyRealizationV2, type BuiltSampleV2, type BuiltSetupV2 } from '../cad/execution/realization'
import { serializeEvaluatedDocumentSnapshotV2 } from '../cad/execution/snapshot'
import { evaluateDocumentEntry } from '../cad/execution/userModule'
import { structure } from '../cad/model/v2'
import { experiment } from '../cad/model/v3'
import { defineTask, kernelRefV3 } from './authoring'
import { SimulationKernelErrorV3 } from './errors'
import { KernelRegistryV3 } from './registry'
import { runSimulationProgramV3 } from './runtime'
import type {
  KernelModuleV3,
  KernelRefV3,
  SimulationObservationV3,
} from './types'
import { describe, expect, it } from 'vitest'

const rigidRef = kernelRefV3<Readonly<{ timeStep: number }>>(
  'test.rigid-step',
  '1.0.0',
) as KernelRefV3<
  Readonly<{ timeStep: number }>,
  Readonly<Record<string, never>>,
  Readonly<{ contact: SimulationObservationV3 }>
>
const projectionRef = kernelRefV3('test.rigid-to-elastic', '1.0.0') as KernelRefV3<
  Readonly<Record<string, never>>,
  Readonly<{ mesh: unknown }>
>
const failingRef = kernelRefV3('test.failing-fea', '1.0.0')
const elasticRef = kernelRefV3('test.elastic-step', '1.0.0') as KernelRefV3<
  Readonly<Record<string, never>>,
  Readonly<{ displacement: unknown }>
>
const corruptRef = kernelRefV3('test.corrupt-body-set', '1.0.0')
const invalidArtifactRef = kernelRefV3('test.invalid-artifact', '1.0.0') as KernelRefV3<
  Readonly<Record<string, never>>,
  Readonly<{ displacement: unknown }>
>

const rigidTask = defineTask(rigidRef, () => ({ timeStep: 0.1 }))
const projectionTask = defineTask(projectionRef, () => ({}))
const failingTask = defineTask(failingRef, () => ({}))
const elasticTask = defineTask(elasticRef, () => ({}))
const corruptTask = defineTask(corruptRef, () => ({}))
const invalidArtifactTask = defineTask(invalidArtifactRef, () => ({}))

function createRealizations(mode: 'normal' | 'corrupt-state' | 'invalid-output' = 'normal') {
  function Specimen() {
    return h('box', { size: [10, 2, 2] })
  }
  function Fixture() {
    return h('box', { size: [1, 1, 1] })
  }
  const structureDefinition = structure({
    lengthUnit: 'mm',
    geometry: () => h(Specimen, { id: 'specimen' }),
    geometryGroup: { specimen: ['specimen'] },
    varsSchema: {},
  })
  const experimentDefinition = experiment({
    lengthUnit: 'mm',
    geometry: () => h(Fixture, { id: 'fixture' }),
    varsSchema: {},
    tasks:
      mode === 'corrupt-state'
        ? { corrupt: corruptTask }
        : mode === 'invalid-output'
          ? { invalidArtifact: invalidArtifactTask }
          : {
          rigid: rigidTask,
          project: projectionTask,
          failing: failingTask,
          elastic: elasticTask,
        },
    outputs: {
      displacement: {
        dtype: 'float64',
        unit: '{fraction}',
        quantityKind: 'DimensionlessRatio',
        seriesAxis: { unit: 's', quantityKind: 'Time' },
      },
    },
    initialState: ({ world }) => ({
      bodies: world.bodies.map((body) => ({
        body,
        pose: body.referencePose,
        velocity: [0, 0, 0],
      })),
    }),
    simulate:
      mode === 'corrupt-state'
        ? async ({ sim, tasks, initialState }) => {
          const result = await sim.run(tasks.corrupt, { state: initialState })
          return result.state
        }
        : mode === 'invalid-output'
          ? async ({ sim, tasks, initialState }) => {
              const result = await sim.run(tasks.invalidArtifact, { state: initialState })
              try {
                sim.record('displacement', result.artifacts.displacement, { time: 0.1 })
              } catch {
                // Fatal orchestration errors remain latched even when user code catches them.
              }
              return result.state
            }
          : async ({ sim, tasks, initialState }) => {
          const rigid = await sim.run(tasks.rigid, { state: initialState })
          expect(rigid.observations.contact.value).toBe(true)
          const projected = await sim.run(tasks.project, { state: rigid.state })
          let elastic
          try {
            elastic = await sim.run(tasks.failing, { state: projected.state })
          } catch (error) {
            expect(error).toBeInstanceOf(SimulationKernelErrorV3)
            elastic = await sim.run(tasks.elastic, {
              state: projected.state,
              artifacts: { mesh: projected.artifacts.mesh },
            })
          }
          sim.record('displacement', elastic.artifacts.displacement, { time: 0.2 })
          return elastic.state
        },
  })
  const structureSnapshot = serializeEvaluatedDocumentSnapshotV2(
    evaluateDocumentEntry(structureDefinition, 'structure', '1'.repeat(64), 11),
  )
  const experimentSnapshot = serializeEvaluatedDocumentSnapshotV2(
    evaluateDocumentEntry(experimentDefinition, 'experiment', '2'.repeat(64), 13),
  )
  return {
    definition: experimentDefinition.createProgramRuntime(experimentSnapshot.variables),
    sample: buildSourceOnlyRealizationV2(structureSnapshot) as BuiltSampleV2,
    setup: buildSourceOnlyRealizationV2(experimentSnapshot) as BuiltSetupV2,
  }
}

const modules: readonly KernelModuleV3[] = [
  {
    ref: rigidRef,
    async execute(input) {
      return {
        state: {
          ...input.state,
          values: { mode: 'rigid' },
        },
        observations: {
          contact: { value: true },
        },
      }
    },
  },
  {
    ref: projectionRef,
    async execute(input) {
      return {
        state: {
          ...input.state,
          values: { mode: 'elastic' },
        },
        artifacts: {
          mesh: { bodyIds: input.state.bodies.map((body) => body.body) },
        },
      }
    },
  },
  {
    ref: failingRef,
    async execute(input) {
      const mutableValues = input.state.values as { mode: string }
      mutableValues.mode = 'corrupted'
      throw new SimulationKernelErrorV3('convergence', failingRef, 'Mock FEA did not converge.')
    },
  },
  {
    ref: elasticRef,
    async execute(input) {
      expect(input.state.values).toEqual({ mode: 'elastic' })
      expect(input.artifacts.mesh).toEqual({
        bodyIds: input.state.bodies.map((body) => body.body),
      })
      return {
        state: input.state,
        artifacts: {
          displacement: { value: 0.25 },
        },
      }
    },
  },
  {
    ref: corruptRef,
    async execute(input) {
      return {
        state: {
          ...input.state,
          bodies: input.state.bodies.slice(1),
        },
      }
    },
  },
  {
    ref: invalidArtifactRef,
    async execute(input) {
      return {
        state: input.state,
        artifacts: {
          displacement: { value: [0.1, 0.2] },
        },
      }
    },
  },
]

describe('Simulation Program v3 runtime', () => {
  it('runs deterministic branching, preserves atomic failure state, records output, and traces every call', async () => {
    const { definition, sample, setup } = createRealizations()
    const registry = new KernelRegistryV3(modules)
    const first = await runSimulationProgramV3(
      definition,
      sample,
      setup,
      registry,
      new AbortController().signal,
      'program-test-1',
    )
    const second = await runSimulationProgramV3(
      definition,
      sample,
      setup,
      registry,
      new AbortController().signal,
      'program-test-2',
    )

    expect(first.finalState).toEqual({ revision: 3, bodyCount: 2 })
    expect(first.trace.map((entry) => [entry.task, entry.status])).toEqual([
      ['rigid', 'succeeded'],
      ['project', 'succeeded'],
      ['failing', 'failed'],
      ['elastic', 'fallback'],
    ])
    expect(first.trace[2].outputStateRevision).toBeNull()
    expect(first.trace[2].inputStateRevision).toBe(2)
    expect(first.trace[3].inputStateRevision).toBe(2)
    expect(first.outputs.displacement.samples).toEqual([
      expect.objectContaining({ time: 0.2, data: { value: 0.25 } }),
    ])
    expect(first.trace.map((entry) => entry.inputHash)).toEqual(second.trace.map((entry) => entry.inputHash))
    expect(first.trace.map((entry) => entry.outputHash)).toEqual(second.trace.map((entry) => entry.outputHash))
  })

  it('rejects a kernel state that creates or removes stable bodies', async () => {
    const { definition, sample, setup } = createRealizations('corrupt-state')
    await expect(runSimulationProgramV3(
      definition,
      sample,
      setup,
      new KernelRegistryV3(modules),
      new AbortController().signal,
      'program-corrupt',
    )).rejects.toThrow('preserve the world body identities')
  })

  it('validates output dtype and shape when an artifact is recorded', async () => {
    const { definition, sample, setup } = createRealizations('invalid-output')
    await expect(runSimulationProgramV3(
      definition,
      sample,
      setup,
      new KernelRegistryV3(modules),
      new AbortController().signal,
      'program-invalid-output',
    )).rejects.toThrow('does not match its declared schema')
  })
})
