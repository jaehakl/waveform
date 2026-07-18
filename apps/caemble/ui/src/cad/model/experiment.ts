import type {
  ExperimentParameters,
  ExperimentRule,
  ExperimentSolver,
  RecordedDataRule,
} from './descriptor'
import { CadModelError } from './errors'
import { Structure, type StructureOptions } from './structure'

export type ExperimentOptions<
  TInitializationParameters extends ExperimentParameters,
  TBoundaryConditionParameters extends ExperimentParameters,
  TRecordedDataParameters extends ExperimentParameters,
> = StructureOptions & {
  solver: ExperimentSolver
  initializations?: () => readonly ExperimentRule<TInitializationParameters>[]
  boundaryConditions?: () => readonly ExperimentRule<TBoundaryConditionParameters>[]
  recordedData?: () => readonly RecordedDataRule<TRecordedDataParameters>[]
}

const emptyExperimentRules = Object.freeze([]) as readonly never[]

function emptyRuleFactory<TRule>() {
  return emptyExperimentRules as readonly TRule[]
}

export class Experiment<
  TInitializationParameters extends ExperimentParameters = ExperimentParameters,
  TBoundaryConditionParameters extends ExperimentParameters = ExperimentParameters,
  TRecordedDataParameters extends ExperimentParameters = ExperimentParameters,
> extends Structure {
  readonly solver: ExperimentSolver
  readonly initializations: () => readonly ExperimentRule<TInitializationParameters>[]
  readonly boundaryConditions: () => readonly ExperimentRule<TBoundaryConditionParameters>[]
  readonly recordedData: () => readonly RecordedDataRule<TRecordedDataParameters>[]

  constructor(options: ExperimentOptions<
    TInitializationParameters,
    TBoundaryConditionParameters,
    TRecordedDataParameters
  >) {
    super(options)
    if (Object.prototype.hasOwnProperty.call(options, 'initialConditions')) {
      throw new CadModelError('Experiment initialConditions was renamed to initializations.')
    }
    if (
      typeof options.solver !== 'object'
      || options.solver === null
      || Array.isArray(options.solver)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(options.solver))
    ) {
      throw new CadModelError('Experiment solver must be a plain object.')
    }
    if (typeof options.solver.name !== 'string' || !options.solver.name.trim()) {
      throw new CadModelError('Experiment solver name must be a non-empty string.')
    }
    if (typeof options.solver.version !== 'string' || !options.solver.version.trim()) {
      throw new CadModelError('Experiment solver version must be a non-empty string.')
    }
    if (typeof options.solver.parameters !== 'function') {
      throw new CadModelError('Experiment solver parameters must be a function.')
    }
    if (options.initializations !== undefined && typeof options.initializations !== 'function') {
      throw new CadModelError('Experiment initializations must be a function.')
    }
    if (options.boundaryConditions !== undefined && typeof options.boundaryConditions !== 'function') {
      throw new CadModelError('Experiment boundaryConditions must be a function.')
    }
    if (options.recordedData !== undefined && typeof options.recordedData !== 'function') {
      throw new CadModelError('Experiment recordedData must be a function.')
    }
    this.solver = Object.freeze({
      name: options.solver.name.trim(),
      version: options.solver.version.trim(),
      parameters: options.solver.parameters,
    })
    this.initializations = options.initializations ?? emptyRuleFactory
    this.boundaryConditions = options.boundaryConditions ?? emptyRuleFactory
    this.recordedData = options.recordedData ?? emptyRuleFactory
    if (new.target === Experiment) Object.freeze(this)
  }
}
