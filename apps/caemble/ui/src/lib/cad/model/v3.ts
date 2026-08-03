import type { StructureGroupMap } from './structure'
import { Structure } from './structure'
import type { Tensor, Vars } from './types'
import type { UcumUnit } from './units'
import type { VarsSchemaEntry } from './vars'
import type {
  DefinedKernelTaskV3,
  ResolvedKernelTaskV3,
  SimulationOutputSpecV3,
  SimulationStateDataV3,
  SimulationStateRefV3,
  SimulationWorldV3,
} from '../../simulation/types'
import type { SimulationScriptApiV3, SimulationProgramRuntimeDefinitionV3 } from '../../simulation/runtime'
import { simulationProgramManifestV3 } from '../../simulation/authoring'

export type VarsSchemaDefinitionV3 = Readonly<Record<string, Readonly<VarsSchemaEntry>>>

type ShapeSource<Entry extends VarsSchemaEntry> = Entry['min'] extends readonly unknown[]
  ? Entry['min']
  : Entry['max']

type WidenTensor<Value> = Value extends number
  ? number
  : Value extends readonly unknown[]
    ? { readonly [Index in keyof Value]: WidenTensor<Value[Index]> }
    : never

export type InferVarsV3<Schema extends VarsSchemaDefinitionV3> = Readonly<{
  [Key in keyof Schema]: WidenTensor<ShapeSource<Schema[Key]>>
}>

export type ModelContextV3<Schema extends VarsSchemaDefinitionV3> = Readonly<{
  vars: InferVarsV3<Schema>
}>

type ResolvedTasks<TTasks extends Readonly<Record<string, DefinedKernelTaskV3>>> = Readonly<{
  [Key in keyof TTasks]: TTasks[Key] extends DefinedKernelTaskV3<
    infer Config,
    infer Artifacts,
    infer Observations
  >
    ? ResolvedKernelTaskV3<Config, Artifacts, Observations>
    : never
}>

export type ExperimentProgramOptionsV3<
  Schema extends VarsSchemaDefinitionV3,
  Tasks extends Readonly<Record<string, DefinedKernelTaskV3>>,
  Outputs extends Readonly<Record<string, SimulationOutputSpecV3>>,
> = Readonly<{
  geometry: (context: ModelContextV3<Schema>) => unknown
  lengthUnit: UcumUnit
  varsSchema: Schema
  geometryGroup?: StructureGroupMap
  surfaceGroup?: StructureGroupMap
  tasks: Tasks
  outputs: Outputs
  initialState?: (context: Readonly<{
    vars: InferVarsV3<Schema>
    world: SimulationWorldV3
  }>) => SimulationStateDataV3
  simulate: (context: Readonly<{
    sim: SimulationScriptApiV3
    tasks: ResolvedTasks<Tasks>
    initialState: SimulationStateRefV3
    vars: InferVarsV3<Schema>
    world: SimulationWorldV3
  }>) => Promise<SimulationStateRefV3> | SimulationStateRefV3
}>

function defaultInitialState(world: SimulationWorldV3): SimulationStateDataV3 {
  return Object.freeze({
    bodies: Object.freeze(world.bodies.map((body) => Object.freeze({
      body: body.id,
      pose: body.referencePose,
      velocity: Object.freeze([0, 0, 0] as const),
    }))),
  })
}

function assertProgramOptions(
  tasks: Readonly<Record<string, DefinedKernelTaskV3>>,
  outputs: Readonly<Record<string, SimulationOutputSpecV3>>,
) {
  if (!tasks || typeof tasks !== 'object' || Array.isArray(tasks) || Object.keys(tasks).length === 0) {
    throw new Error('v3 Experiment tasks must be a non-empty object.')
  }
  Object.entries(tasks).forEach(([name, task]) => {
    if (!name.trim() || task.kind !== 'caemble-kernel-task-v3') {
      throw new Error(`v3 Experiment task "${name}" is invalid.`)
    }
  })
  if (!outputs || typeof outputs !== 'object' || Array.isArray(outputs)) {
    throw new Error('v3 Experiment outputs must be an object.')
  }
}

export class ExperimentProgramDefinitionV3<
  Schema extends VarsSchemaDefinitionV3 = VarsSchemaDefinitionV3,
  Tasks extends Readonly<Record<string, DefinedKernelTaskV3>> = Readonly<Record<string, DefinedKernelTaskV3>>,
  Outputs extends Readonly<Record<string, SimulationOutputSpecV3>> = Readonly<Record<string, SimulationOutputSpecV3>>,
> extends Structure {
  readonly apiVersion = 3 as const
  readonly documentType = 'experiment' as const
  readonly geometryFactory: (context: ModelContextV3<Schema>) => unknown
  readonly tasks: Tasks
  readonly outputs: Outputs
  readonly initialStateFactory: NonNullable<ExperimentProgramOptionsV3<Schema, Tasks, Outputs>['initialState']>
  readonly simulateFactory: ExperimentProgramOptionsV3<Schema, Tasks, Outputs>['simulate']
  readonly manifest

  constructor(options: ExperimentProgramOptionsV3<Schema, Tasks, Outputs>) {
    super({
      geometry: () => null,
      lengthUnit: options.lengthUnit,
      varsSchema: options.varsSchema as Record<string, VarsSchemaEntry>,
      geometryGroup: options.geometryGroup,
      surfaceGroup: options.surfaceGroup,
    })
    assertProgramOptions(options.tasks, options.outputs)
    if (typeof options.geometry !== 'function') throw new Error('v3 Experiment geometry must be a function.')
    if (typeof options.simulate !== 'function') throw new Error('v3 Experiment simulate must be a function.')
    if (options.initialState !== undefined && typeof options.initialState !== 'function') {
      throw new Error('v3 Experiment initialState must be a function.')
    }
    this.geometryFactory = options.geometry
    this.tasks = Object.freeze({ ...options.tasks }) as Tasks
    this.outputs = Object.freeze(Object.fromEntries(Object.entries(options.outputs).map(([name, spec]) => [
      name,
      Object.freeze({
        ...spec,
        ...(spec.basis === undefined
          ? {}
          : { basis: Object.freeze(spec.basis.map((axis) => Object.freeze([...axis]))) }),
        ...(spec.axes === undefined
          ? {}
          : {
              axes: Object.freeze(spec.axes.map((axis) => Object.freeze({
                ...axis,
                ...(axis.ticks === undefined ? {} : { ticks: Object.freeze([...axis.ticks]) }),
              }))),
            }),
        ...(spec.seriesAxis === undefined ? {} : { seriesAxis: Object.freeze({ ...spec.seriesAxis }) }),
      }),
    ]))) as Outputs
    this.initialStateFactory = options.initialState ?? (({ world }) => defaultInitialState(world))
    this.simulateFactory = options.simulate
    this.manifest = simulationProgramManifestV3(this.tasks, this.outputs)
    Object.freeze(this)
  }

  resolve(partialVars: Partial<InferVarsV3<Schema>> = {}, seed?: number) {
    return this.resolveVars(partialVars as Partial<Vars>, seed, 'Experiment') as InferVarsV3<Schema>
  }

  resolveExternal(partialVars: Partial<Vars> = {}, seed?: number) {
    return this.resolveVars(partialVars, seed, 'Experiment')
  }

  evaluateResolvedGeometry(vars: Readonly<Vars>) {
    return this.geometryFactory(Object.freeze({ vars: vars as InferVarsV3<Schema> }))
  }

  createProgramRuntime(vars: Readonly<Vars>): SimulationProgramRuntimeDefinitionV3 {
    const typedVars = vars as InferVarsV3<Schema>
    return Object.freeze({
      tasks: this.tasks,
      outputs: this.outputs,
      manifest: this.manifest,
      initialState: ({ world }) => this.initialStateFactory({ vars: typedVars, world }),
      simulate: (context) => this.simulateFactory({
        ...context,
        vars: typedVars,
        tasks: context.tasks as ResolvedTasks<Tasks>,
      }),
    })
  }
}

export function experiment<
  const Schema extends VarsSchemaDefinitionV3,
  const Tasks extends Readonly<Record<string, DefinedKernelTaskV3>>,
  const Outputs extends Readonly<Record<string, SimulationOutputSpecV3>>,
>(options: ExperimentProgramOptionsV3<Schema, Tasks, Outputs>) {
  return new ExperimentProgramDefinitionV3(options)
}

export type ExperimentProgramEntryV3 = Pick<
  ExperimentProgramDefinitionV3,
  | 'apiVersion'
  | 'createProgramRuntime'
  | 'documentType'
  | 'evaluateResolvedGeometry'
  | 'geometryGroup'
  | 'lengthUnit'
  | 'manifest'
  | 'resolveExternal'
  | 'surfaceGroup'
  | 'varsSchema'
>

export type ExternalVarsV3 = Readonly<Record<string, Tensor>>
