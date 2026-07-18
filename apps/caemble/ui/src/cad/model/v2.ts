import { Experiment } from './experiment'
import { Structure, type StructureGroupMap } from './structure'
import type {
  ExperimentParameters,
  ExperimentRule,
  RecordedDataRule,
  SolverParameters,
} from './descriptor'
import type { Tensor, Vars } from './types'
import type { UcumUnit } from './units'
import type { VarsSchemaEntry } from './vars'

export type VarsSchemaDefinition = Readonly<Record<string, Readonly<VarsSchemaEntry>>>

type ShapeSource<Entry extends VarsSchemaEntry> = Entry['min'] extends readonly unknown[]
  ? Entry['min']
  : Entry['max']

type WidenTensor<Value> = Value extends number
  ? number
  : Value extends readonly unknown[]
    ? { readonly [Index in keyof Value]: WidenTensor<Value[Index]> }
    : never

export type InferVars<Schema extends VarsSchemaDefinition> = Readonly<{
  [Key in keyof Schema]: WidenTensor<ShapeSource<Schema[Key]>>
}>

export type ModelContext<Schema extends VarsSchemaDefinition> = Readonly<{
  vars: InferVars<Schema>
}>

export type StructureDefinitionOptions<Schema extends VarsSchemaDefinition> = Readonly<{
  geometry: (context: ModelContext<Schema>) => unknown
  lengthUnit: UcumUnit
  varsSchema: Schema
  geometryGroup?: StructureGroupMap
  surfaceGroup?: StructureGroupMap
}>

export type ExperimentSolverDefinition<Schema extends VarsSchemaDefinition> = Readonly<{
  name: string
  version: string
  parameters: (context: ModelContext<Schema>) => SolverParameters
}>

export type ExperimentDefinitionOptions<
  Schema extends VarsSchemaDefinition,
  InitializationParameters extends ExperimentParameters = ExperimentParameters,
  BoundaryConditionParameters extends ExperimentParameters = ExperimentParameters,
  RecordedParameters extends ExperimentParameters = ExperimentParameters,
> = StructureDefinitionOptions<Schema> & Readonly<{
  solver: ExperimentSolverDefinition<Schema>
  initializations?: (context: ModelContext<Schema>) => readonly ExperimentRule<InitializationParameters>[]
  boundaryConditions?: (context: ModelContext<Schema>) => readonly ExperimentRule<BoundaryConditionParameters>[]
  recordedData?: (context: ModelContext<Schema>) => readonly RecordedDataRule<RecordedParameters>[]
}>

export class StructureDefinitionV2<Schema extends VarsSchemaDefinition = VarsSchemaDefinition> extends Structure {
  readonly apiVersion = 2 as const
  readonly documentType = 'structure' as const
  readonly geometryFactory: (context: ModelContext<Schema>) => unknown

  constructor(options: StructureDefinitionOptions<Schema>) {
    super({
      geometry: () => null,
      lengthUnit: options.lengthUnit,
      varsSchema: options.varsSchema as Record<string, VarsSchemaEntry>,
      geometryGroup: options.geometryGroup,
      surfaceGroup: options.surfaceGroup,
    })
    this.geometryFactory = options.geometry
    Object.freeze(this)
  }

  resolve(partialVars: Partial<InferVars<Schema>> = {}, seed?: number) {
    return this.resolveVars(partialVars as Partial<Vars>, seed, 'Structure') as InferVars<Schema>
  }

  resolveExternal(partialVars: Partial<Vars> = {}, seed?: number) {
    return this.resolveVars(partialVars, seed, 'Structure')
  }

  evaluateGeometry(vars: InferVars<Schema>) {
    return this.geometryFactory(Object.freeze({ vars }))
  }

  evaluateResolvedGeometry(vars: Readonly<Vars>) {
    return this.geometryFactory(Object.freeze({ vars: vars as InferVars<Schema> }))
  }
}

export class ExperimentDefinitionV2<
  Schema extends VarsSchemaDefinition = VarsSchemaDefinition,
  InitializationParameters extends ExperimentParameters = ExperimentParameters,
  BoundaryConditionParameters extends ExperimentParameters = ExperimentParameters,
  RecordedParameters extends ExperimentParameters = ExperimentParameters,
> extends Experiment<InitializationParameters, BoundaryConditionParameters, RecordedParameters> {
  readonly apiVersion = 2 as const
  readonly documentType = 'experiment' as const
  readonly geometryFactory: (context: ModelContext<Schema>) => unknown
  readonly solverFactory: ExperimentSolverDefinition<Schema>
  readonly initializationFactory: (context: ModelContext<Schema>) => readonly ExperimentRule<InitializationParameters>[]
  readonly boundaryConditionFactory: (context: ModelContext<Schema>) => readonly ExperimentRule<BoundaryConditionParameters>[]
  readonly recordedDataFactory: (context: ModelContext<Schema>) => readonly RecordedDataRule<RecordedParameters>[]

  constructor(options: ExperimentDefinitionOptions<
    Schema,
    InitializationParameters,
    BoundaryConditionParameters,
    RecordedParameters
  >) {
    super({
      geometry: () => null,
      lengthUnit: options.lengthUnit,
      varsSchema: options.varsSchema as Record<string, VarsSchemaEntry>,
      geometryGroup: options.geometryGroup,
      surfaceGroup: options.surfaceGroup,
      solver: {
        name: options.solver.name,
        version: options.solver.version,
        parameters: () => ({}),
      },
      initializations: () => [],
      boundaryConditions: () => [],
      recordedData: () => [],
    })
    this.geometryFactory = options.geometry
    this.solverFactory = Object.freeze({ ...options.solver })
    this.initializationFactory = options.initializations ?? (() => [])
    this.boundaryConditionFactory = options.boundaryConditions ?? (() => [])
    this.recordedDataFactory = options.recordedData ?? (() => [])
    Object.freeze(this)
  }

  resolve(partialVars: Partial<InferVars<Schema>> = {}, seed?: number) {
    return this.resolveVars(partialVars as Partial<Vars>, seed, 'Experiment') as InferVars<Schema>
  }

  resolveExternal(partialVars: Partial<Vars> = {}, seed?: number) {
    return this.resolveVars(partialVars, seed, 'Experiment')
  }

  createRuntime(vars: InferVars<Schema>) {
    const context = Object.freeze({ vars })
    return new Experiment<InitializationParameters, BoundaryConditionParameters, RecordedParameters>({
      geometry: () => this.geometryFactory(context),
      lengthUnit: this.lengthUnit,
      varsSchema: this.varsSchema as Record<string, VarsSchemaEntry>,
      geometryGroup: this.geometryGroup,
      surfaceGroup: this.surfaceGroup,
      solver: {
        name: this.solverFactory.name,
        version: this.solverFactory.version,
        parameters: () => this.solverFactory.parameters(context),
      },
      initializations: () => this.initializationFactory(context),
      boundaryConditions: () => this.boundaryConditionFactory(context),
      recordedData: () => this.recordedDataFactory(context),
    })
  }

  createRuntimeFromResolved(vars: Readonly<Vars>) {
    return this.createRuntime(vars as InferVars<Schema>)
  }
}

export function structure<const Schema extends VarsSchemaDefinition>(
  options: StructureDefinitionOptions<Schema>,
) {
  return new StructureDefinitionV2(options)
}

export function experiment<
  const Schema extends VarsSchemaDefinition,
  InitializationParameters extends ExperimentParameters = ExperimentParameters,
  BoundaryConditionParameters extends ExperimentParameters = ExperimentParameters,
  RecordedParameters extends ExperimentParameters = ExperimentParameters,
>(options: ExperimentDefinitionOptions<
  Schema,
  InitializationParameters,
  BoundaryConditionParameters,
  RecordedParameters
>) {
  return new ExperimentDefinitionV2(options)
}

export type CadDefinitionV2 = Readonly<{
  apiVersion: 2
  documentType: 'experiment' | 'structure'
  resolveVars(partialVars?: Partial<Vars>, seed?: number): Vars
  resolveExternal(partialVars?: Partial<Vars>, seed?: number): Vars
}>
export type ExternalVars = Readonly<Record<string, Tensor>>
