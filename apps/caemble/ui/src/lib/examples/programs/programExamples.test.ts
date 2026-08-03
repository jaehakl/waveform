import { transform } from 'esbuild'
import { describe, expect, it } from 'vitest'
import { buildSourceOnlyRealizationV2, type BuiltSampleV2, type BuiltSetupV2 } from '../../cad/execution/realization'
import { serializeEvaluatedDocumentSnapshotV2 } from '../../cad/execution/snapshot'
import {
  evaluateDocumentEntry,
  loadCompiledCode,
} from '../../cad/execution/userModule'
import { ExperimentProgramDefinitionV3 } from '../../cad/model/v3'
import { analyzeCadSourceV2 } from '../../cad/source/sourceAnalysis'
import {
  dcCurrentDensityKernel,
  KernelRegistryV3,
  runSimulationProgramV3,
  type SimulationResultV3,
} from '../../simulation'
import type { CaembleProgramExample } from './types'
import { CAEMBLE_PROGRAM_EXAMPLE_SEED, caembleProgramExamples } from '.'

async function compileSource(source: string) {
  return (
    await transform(source, {
      format: 'cjs',
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
      loader: 'tsx',
      platform: 'browser',
      target: 'es2020',
    })
  ).code
}

async function prepareExample(example: CaembleProgramExample, seed = CAEMBLE_PROGRAM_EXAMPLE_SEED) {
  analyzeCadSourceV2(example.structureCode, 'structure')
  analyzeCadSourceV2(example.experimentCode, 'experiment')
  const [structureCode, experimentCode] = await Promise.all([
    compileSource(example.structureCode),
    compileSource(example.experimentCode),
  ])
  const structureEntry = loadCompiledCode(structureCode, 'structure')
  const experimentEntry = loadCompiledCode(experimentCode, 'experiment')
  expect(experimentEntry).toBeInstanceOf(ExperimentProgramDefinitionV3)
  if (!(experimentEntry instanceof ExperimentProgramDefinitionV3)) {
    throw new Error(`${example.id} did not compile to an Experiment Program v3 definition.`)
  }
  const structureSnapshot = serializeEvaluatedDocumentSnapshotV2(
    evaluateDocumentEntry(structureEntry, 'structure', '1'.repeat(64), seed),
  )
  const experimentSnapshot = serializeEvaluatedDocumentSnapshotV2(
    evaluateDocumentEntry(experimentEntry, 'experiment', '2'.repeat(64), seed),
  )
  return {
    definition: experimentEntry.createProgramRuntime(experimentSnapshot.variables),
    sample: buildSourceOnlyRealizationV2(structureSnapshot) as BuiltSampleV2,
    setup: buildSourceOnlyRealizationV2(experimentSnapshot) as BuiltSetupV2,
  }
}

async function runExample(example: CaembleProgramExample, runId: string): Promise<SimulationResultV3> {
  const prepared = await prepareExample(example)
  return runSimulationProgramV3(
    prepared.definition,
    prepared.sample,
    prepared.setup,
    new KernelRegistryV3([dcCurrentDensityKernel]),
    new AbortController().signal,
    runId,
  )
}

function scalarOutput(result: SimulationResultV3, name: string) {
  const data = result.outputs[name].samples[0]?.data
  if (!data || typeof data !== 'object' || !('value' in data) || typeof data.value !== 'number') {
    throw new Error(`${name} did not produce a scalar output.`)
  }
  return data.value
}

describe('verified Experiment Program v3 examples', () => {
  it('keeps unique immutable fixtures with matching declared tasks and outputs', async () => {
    expect(new Set(caembleProgramExamples.map((example) => example.id)).size).toBe(caembleProgramExamples.length)

    for (const [index, example] of caembleProgramExamples.entries()) {
      const { definition } = await prepareExample(example, 101 + index)
      expect(Object.keys(definition.tasks)).toEqual(example.verification.kernelTasks)
      expect(Object.keys(definition.outputs)).toEqual(example.verification.outputs)
      expect(Object.isFrozen(example)).toBe(true)
      expect(Object.isFrozen(example.verification)).toBe(true)
    }
  })

  it('runs the uniform bar to its analytic current without changing body identity', async () => {
    const example = caembleProgramExamples.find(({ id }) => id === 'dc-uniform-bar')!
    const result = await runExample(example, 'example-uniform')

    expect(scalarOutput(result, 'totalCurrent')).toBeCloseTo(14.9, 6)
    expect(result.trace.map(({ task, kernel, status }) => ({ task, kernel, status }))).toEqual([
      {
        task: 'solveCurrent',
        kernel: { name: 'dc-current-density', version: '0.0.0' },
        status: 'succeeded',
      },
    ])
    expect(result.finalState).toEqual({ revision: 1, bodyCount: 2 })
  })

  it('runs the notched conductor and records a finite 21 × 21 vector field', async () => {
    const example = caembleProgramExamples.find(({ id }) => id === 'dc-notched-current-density')!
    const result = await runExample(example, 'example-notched')
    const data = result.outputs.currentDensity.samples[0]?.data as
      | Readonly<{
          value: readonly (readonly (readonly number[])[])[]
          axes?: readonly Readonly<{ ticks?: readonly number[] }>[]
        }>
      | undefined

    expect(data?.value).toHaveLength(21)
    expect(data?.value.every((row) => row.length === 21 && row.every((vector) => vector.length === 3))).toBe(true)
    expect(data?.value.flat(2).every(Number.isFinite)).toBe(true)
    expect(data?.axes?.map((axis) => axis.ticks?.length)).toEqual([21, 21])
    expect(scalarOutput(result, 'totalCurrent')).toBeGreaterThan(0)
    expect(result.trace.map(({ task }) => task)).toEqual(['solveField'])
  })

  it('runs coarse then fine and reproduces task and output hashes', async () => {
    const example = caembleProgramExamples.find(({ id }) => id === 'dc-resolution-study')!
    const [first, second] = await Promise.all([
      runExample(example, 'example-resolution-a'),
      runExample(example, 'example-resolution-b'),
    ])

    expect(scalarOutput(first, 'coarseTotalCurrent')).toBeCloseTo(14.9, 6)
    expect(scalarOutput(first, 'fineTotalCurrent')).toBeCloseTo(14.9, 6)
    expect(first.trace.map(({ task, inputStateRevision, outputStateRevision }) => [
      task,
      inputStateRevision,
      outputStateRevision,
    ])).toEqual([
      ['solveCoarse', 0, 1],
      ['solveFine', 1, 2],
    ])
    expect(first.trace.map(({ inputHash }) => inputHash)).toEqual(second.trace.map(({ inputHash }) => inputHash))
    expect(first.trace.map(({ outputHash }) => outputHash)).toEqual(second.trace.map(({ outputHash }) => outputHash))
    expect(first.finalState).toEqual({ revision: 2, bodyCount: 2 })
  })
})
