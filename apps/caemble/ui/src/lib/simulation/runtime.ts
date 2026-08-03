import { deserializeCadScene } from '../cad/execution/mesh'
import { applyFrozenMaterialParameters, type BuiltSampleV2, type BuiltSetupV2 } from '../cad/execution/realization'
import { normalizeRecordedDataTensor } from '../cad/model/recordedData'
import type { RecordedDataRule } from '../cad/model/descriptor'
import type { Vars } from '../cad/model/types'
import { SimulationFatalErrorV3, SimulationKernelErrorV3 } from './errors'
import { KernelRegistryV3 } from './registry'
import type {
  DefinedKernelTaskV3,
  KernelRunResultV3,
  ResolvedKernelTaskV3,
  SimulationArtifactRefV3,
  SimulationBodyStateV3,
  SimulationOutputSampleV3,
  SimulationOutputSpecV3,
  SimulationProgramManifestV3,
  SimulationProvenanceV3,
  SimulationResultV3,
  SimulationStateDataV3,
  SimulationStateRefV3,
  SimulationTraceEntryV3,
  SimulationWorldV3,
} from './types'

export type SimulationProgramRuntimeDefinitionV3 = Readonly<{
  tasks: Readonly<Record<string, DefinedKernelTaskV3>>
  outputs: Readonly<Record<string, SimulationOutputSpecV3>>
  manifest: SimulationProgramManifestV3
  initialState: (context: Readonly<{ vars: Readonly<Vars>; world: SimulationWorldV3 }>) => SimulationStateDataV3
  simulate: (context: Readonly<{
    sim: SimulationScriptApiV3
    tasks: Readonly<Record<string, ResolvedKernelTaskV3>>
    initialState: SimulationStateRefV3
    vars: Readonly<Vars>
    world: SimulationWorldV3
  }>) => Promise<SimulationStateRefV3> | SimulationStateRefV3
}>

export type SimulationScriptApiV3 = Readonly<{
  run: (
    task: ResolvedKernelTaskV3,
    input: Readonly<{
      state: SimulationStateRefV3
      artifacts?: Readonly<Record<string, SimulationArtifactRefV3>>
    }>,
  ) => Promise<KernelRunResultV3>
  record: (name: string, artifact: SimulationArtifactRefV3, coordinates?: Readonly<{ time?: number }>) => void
  random: () => number
}>

function createWorld(sample: BuiltSampleV2, setup: BuiltSetupV2): SimulationWorldV3 {
  const structure = applyFrozenMaterialParameters(
    deserializeCadScene(sample.structure.scene),
    sample.materialParameters,
  )
  const experiment = applyFrozenMaterialParameters(
    deserializeCadScene(setup.experiment.scene),
    setup.materialParameters,
  )
  const bodies = ([
    ['structure', structure],
    ['experiment', experiment],
  ] as const).flatMap(([source, scene]) => scene.parts.map((part) => Object.freeze({
    id: `${source}:${part.id}` as const,
    source,
    geometryId: part.id,
    referencePose: Object.freeze({ position: Object.freeze([0, 0, 0] as const) }),
  })))
  return Object.freeze({
    bodies: Object.freeze(bodies),
    scenes: Object.freeze({ structure, experiment }),
  })
}

function validateState(state: SimulationStateDataV3, world: SimulationWorldV3) {
  if (!state || typeof state !== 'object' || !Array.isArray(state.bodies)) {
    throw new SimulationFatalErrorV3('Simulation state must contain a body array.')
  }
  const expected = [...world.bodies.map((body) => body.id)].sort()
  const actual = [...state.bodies.map((body) => body.body)].sort()
  if (actual.length !== expected.length || actual.some((body, index) => body !== expected[index])) {
    throw new SimulationFatalErrorV3('Simulation state must preserve the world body identities.')
  }
  state.bodies.forEach((body) => {
    if (
      body.velocity.length !== 3 ||
      body.velocity.some((component: number) => !Number.isFinite(component)) ||
      body.pose.position.length !== 3 ||
      body.pose.position.some((component: number) => !Number.isFinite(component))
    ) {
      throw new SimulationFatalErrorV3(`Simulation body ${body.body} has an invalid pose or velocity.`)
    }
  })
}

function defaultState(world: SimulationWorldV3): SimulationStateDataV3 {
  return Object.freeze({
    bodies: Object.freeze(world.bodies.map((body): SimulationBodyStateV3 => Object.freeze({
      body: body.id,
      pose: body.referencePose,
      velocity: Object.freeze([0, 0, 0] as const),
    }))),
  })
}

function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(
      ([key, item]) => [key, stableValue(item)],
    ))
  }
  return value
}

async function valueHash(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(stableValue(value)))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function freezeState(state: SimulationStateDataV3): SimulationStateDataV3 {
  return Object.freeze({
    bodies: Object.freeze(state.bodies.map((body) => Object.freeze({
      body: typeof body.body === 'string' ? body.body : body.body.id,
      pose: Object.freeze({ position: Object.freeze([...body.pose.position] as [number, number, number]) }),
      velocity: Object.freeze([...body.velocity] as [number, number, number]),
    }))),
    ...(state.values === undefined ? {} : { values: Object.freeze(structuredClone(state.values)) }),
  })
}

function assertStateRef(value: SimulationStateRefV3, runId: string, states: Map<number, SimulationStateDataV3>) {
  if (value.runId !== runId || !Number.isSafeInteger(value.revision) || !states.has(value.revision)) {
    throw new SimulationFatalErrorV3('Simulation state reference is invalid or belongs to another run.')
  }
}

function assertArtifactRef(value: SimulationArtifactRefV3, runId: string, artifacts: Map<string, unknown>) {
  if (value.runId !== runId || !artifacts.has(value.id)) {
    throw new SimulationFatalErrorV3('Simulation artifact reference is invalid or belongs to another run.')
  }
}

export async function runSimulationProgramV3(
  definition: SimulationProgramRuntimeDefinitionV3,
  sample: BuiltSampleV2,
  setup: BuiltSetupV2,
  registry: KernelRegistryV3,
  signal: AbortSignal,
  requestedRunId = `simulation-${crypto.randomUUID()}`,
): Promise<SimulationResultV3> {
  const runId = requestedRunId
  const world = createWorld(sample, setup)
  const vars = setup.experiment.variables
  const configuredInitial = definition.initialState?.({ vars, world }) ?? defaultState(world)
  const initialState = freezeState(configuredInitial)
  validateState(initialState, world)

  const states = new Map<number, SimulationStateDataV3>([[0, initialState]])
  const artifacts = new Map<string, unknown>()
  const outputSamples = new Map<string, SimulationOutputSampleV3[]>()
  Object.keys(definition.outputs).forEach((name) => outputSamples.set(name, []))
  const trace: SimulationTraceEntryV3[] = []
  let artifactSequence = 0
  let stateSequence = 0
  let invocationSequence = 0
  let fatalError: SimulationFatalErrorV3 | null = null
  const raiseFatal = (error: unknown): never => {
    fatalError = error instanceof SimulationFatalErrorV3
      ? error
      : new SimulationFatalErrorV3(error instanceof Error ? error.message : String(error))
    throw fatalError
  }

  const resolvedTasks = Object.freeze(Object.fromEntries(Object.entries(definition.tasks).map(([taskName, task]) => {
    const config = task.configure({ vars, world })
    return [taskName, Object.freeze({
      kind: 'caemble-resolved-kernel-task-v3' as const,
      kernel: task.kernel,
      config,
      taskName,
    })]
  })))
  const allowedTasks = new Set(Object.values(resolvedTasks))

  const api: SimulationScriptApiV3 = Object.freeze({
    async run(task, input) {
      if (signal.aborted) throw new SimulationFatalErrorV3('Simulation run was cancelled.')
      if (fatalError) throw fatalError
      let module: ReturnType<KernelRegistryV3['require']> | null = null
      try {
        if (!allowedTasks.has(task)) {
          throw new SimulationFatalErrorV3('sim.run() only accepts a named task declared by this Experiment.')
        }
        assertStateRef(input.state, runId, states)
        Object.values(input.artifacts ?? {}).forEach((artifact) => assertArtifactRef(artifact, runId, artifacts))
        module = registry.require(task.kernel)
      } catch (error) {
        raiseFatal(error)
      }
      if (!module) raiseFatal('Simulation kernel resolution failed.')
      const inputState = states.get(input.state.revision)!
      const inputArtifacts = Object.freeze(Object.fromEntries(
        Object.entries(input.artifacts ?? {}).map(([name, artifact]) => [
          name,
          structuredClone(artifacts.get(artifact.id)),
        ]),
      ))
      const sequence = ++invocationSequence
      const startedAt = Date.now()
      const inputHash = await valueHash({
        artifacts: inputArtifacts,
        config: task.config,
        kernel: { name: task.kernel.name, version: task.kernel.version },
        state: inputState,
      })
      try {
        const result = await module!.execute({
          runId,
          world,
          state: structuredClone(inputState),
          artifacts: inputArtifacts,
          config: task.config,
          outputs: definition.outputs,
          sample,
          setup,
        }, signal)
        if (signal.aborted) throw new SimulationFatalErrorV3('Simulation run was cancelled.')
        const nextState = freezeState(result.state ?? inputState)
        validateState(nextState, world)
        const revision = ++stateSequence
        states.set(revision, nextState)
        const committedArtifacts = Object.fromEntries(Object.entries(result.artifacts ?? {}).map(
          ([name, value]) => [name, structuredClone(value)],
        ))
        const artifactRefs = Object.fromEntries(Object.entries(committedArtifacts).map(([name, value]) => {
          const id = `artifact-${++artifactSequence}`
          artifacts.set(id, value)
          return [name, Object.freeze({ runId, id }) as SimulationArtifactRefV3]
        }))
        const outputHash = await valueHash({ state: nextState, artifacts: committedArtifacts })
        trace.push(Object.freeze({
          sequence,
          task: task.taskName,
          kernel: Object.freeze({ name: task.kernel.name, version: task.kernel.version }),
          inputStateRevision: input.state.revision,
          outputStateRevision: revision,
          inputHash,
          outputHash,
          status: trace[trace.length - 1]?.status === 'failed'
            && trace[trace.length - 1]?.inputStateRevision === input.state.revision
            ? 'fallback' as const
            : 'succeeded' as const,
          startedAt,
          finishedAt: Date.now(),
        }))
        return Object.freeze({
          state: Object.freeze({ runId, revision }) as SimulationStateRefV3,
          artifacts: Object.freeze(artifactRefs),
          observations: Object.freeze({ ...(result.observations ?? {}) }),
        }) as KernelRunResultV3
      } catch (error) {
        trace.push(Object.freeze({
          sequence,
          task: task.taskName,
          kernel: Object.freeze({ name: task.kernel.name, version: task.kernel.version }),
          inputStateRevision: input.state.revision,
          outputStateRevision: null,
          inputHash,
          outputHash: null,
          status: 'failed' as const,
          error: error instanceof Error ? error.message : String(error),
          startedAt,
          finishedAt: Date.now(),
        }))
        if (error instanceof SimulationFatalErrorV3) raiseFatal(error)
        if (error instanceof SimulationKernelErrorV3) throw error
        throw new SimulationKernelErrorV3(
          'backend',
          { name: task.kernel.name, version: task.kernel.version },
          error instanceof Error ? error.message : String(error),
        )
      }
    },
    record(name, artifact, coordinates = {}) {
      const spec = definition.outputs[name]
      if (fatalError) throw fatalError
      if (!spec) raiseFatal(`Simulation output "${name}" is not declared.`)
      try {
        assertArtifactRef(artifact, runId, artifacts)
      } catch (error) {
        raiseFatal(error)
      }
      if (spec.seriesAxis && !Number.isFinite(coordinates.time)) {
        raiseFatal(`Simulation output "${name}" requires a finite time coordinate.`)
      }
      if (!spec.seriesAxis && coordinates.time !== undefined) {
        raiseFatal(`Simulation output "${name}" does not declare a series axis.`)
      }
      const artifactData = artifacts.get(artifact.id)
      const artifactAxes = artifactData
        && typeof artifactData === 'object'
        && 'axes' in artifactData
        && Array.isArray(artifactData.axes)
        ? artifactData.axes
        : undefined
      try {
        normalizeRecordedDataTensor(Object.freeze({
          target: Object.freeze([]),
          label: name,
          methodId: 'simulation.record',
          parameters: Object.freeze({}),
          result: Object.freeze({
            ...spec,
            ...(spec.axes === undefined && artifactAxes !== undefined
              ? { axes: Object.freeze(artifactAxes.map(() => Object.freeze({}))) }
              : {}),
          }),
        }) as RecordedDataRule, artifactData)
      } catch (error) {
        raiseFatal(
          `Simulation output "${name}" does not match its declared schema: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
      outputSamples.get(name)!.push(Object.freeze({
        artifact,
        data: artifactData,
        ...(coordinates.time === undefined ? {} : { time: coordinates.time }),
      }))
    },
    random: seededRandom(setup.experiment.seed),
  })

  const initialRef = Object.freeze({ runId, revision: 0 }) as SimulationStateRefV3
  const finalRef = await definition.simulate({
    sim: api,
    tasks: resolvedTasks,
    initialState: initialRef,
    vars,
    world,
  })
  if (fatalError) throw fatalError
  if (signal.aborted) throw new SimulationFatalErrorV3('Simulation run was cancelled.')
  assertStateRef(finalRef, runId, states)

  const kernels = Object.freeze([...new Map(trace.map((entry) => [
    `${entry.kernel.name}@${entry.kernel.version}`,
    entry.kernel,
  ])).values()])
  const provenance: SimulationProvenanceV3 = Object.freeze({
    sourceHash: setup.experiment.sourceHash,
    structureSourceHash: sample.structure.sourceHash,
    experimentSourceHash: setup.experiment.sourceHash,
    structureSeed: sample.structure.seed,
    experimentSeed: setup.experiment.seed,
    structureVars: sample.structure.variables,
    experimentVars: setup.experiment.variables,
    kernels,
  })
  return Object.freeze({
    format: 'caemble-run' as const,
    version: 3 as const,
    runId,
    status: 'succeeded' as const,
    finalState: Object.freeze({
      revision: finalRef.revision,
      bodyCount: states.get(finalRef.revision)!.bodies.length,
    }),
    outputs: Object.freeze(Object.fromEntries(Object.entries(definition.outputs).map(([name, spec]) => [
      name,
      Object.freeze({ spec, samples: Object.freeze(outputSamples.get(name)!) }),
    ]))),
    trace: Object.freeze(trace),
    provenance,
  })
}

export function exportSimulationResultV3(result: SimulationResultV3) {
  return JSON.stringify(result, null, 2)
}
