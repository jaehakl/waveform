import type { Rotation, Tensor, Vars, Vec3 } from './types'

export type { Rotation, Tensor, Vars, Vec3 } from './types'
export type MaterialVariable =
  | string
  | number
  | boolean
  | null
  | readonly MaterialVariable[]
  | Readonly<{ [key: string]: MaterialVariable }>
export type MaterialVariables = Readonly<Record<string, MaterialVariable> & { color?: string }>
export type SolverParameters = Readonly<Record<string, MaterialVariable>>
export type ExperimentSolver = Readonly<{
  name: string
  version: string
  parameters: () => SolverParameters
}>
export type GeometryAttributes<P extends object = object> = Readonly<
  P & {
    id: string
    materials?: readonly Material[]
    pos?: Vec3
    rotate?: Rotation
    scale?: Vec3
    children?: unknown
  }
>
export type Geometry<P extends object = object> = (props: GeometryAttributes<P>) => unknown

export type VarsSchemaEntry = {
  shape: readonly number[]
  default: Tensor
  min?: Tensor
  max?: Tensor
}

export type StructureGroupMap = Readonly<Record<string, readonly string[]>>
export type ExperimentTarget = `${'experiment' | 'structure'}.${'geometry' | 'surface'}.${string}`
export type ExperimentRule<TParameters extends object = Record<string, unknown>> = Readonly<{
  target: readonly ExperimentTarget[]
  label: string
  methodId: string
  parameters: TParameters
}>

type StructureOptions = {
  geometry: () => unknown
  varsSchema: Record<string, VarsSchemaEntry>
  geometryGroup?: StructureGroupMap
  surfaceGroup?: StructureGroupMap
}

type ExperimentOptions<
  TInitialConditionParameters extends object,
  TBoundaryConditionParameters extends object,
  TRecordedDataParameters extends object,
> = StructureOptions & {
  solver: ExperimentSolver
  initialConditions?: () => readonly ExperimentRule<TInitialConditionParameters>[]
  boundaryConditions?: () => readonly ExperimentRule<TBoundaryConditionParameters>[]
  recordedData?: () => readonly ExperimentRule<TRecordedDataParameters>[]
}

export class CadModelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CadModelError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))
}

function normalizeJsonValue(
  value: unknown,
  path: string,
  ancestors = new Set<object>(),
): MaterialVariable {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new CadModelError(`${path} must be a finite number.`)
    return value
  }
  if (typeof value !== 'object') {
    throw new CadModelError(`${path} must be JSON-compatible.`)
  }
  if (ancestors.has(value)) throw new CadModelError(`${path} must not contain circular references.`)

  ancestors.add(value)
  if (Array.isArray(value)) {
    const normalized = Array.from(value, (item, index) =>
      normalizeJsonValue(item, `${path}[${index}]`, ancestors))
    ancestors.delete(value)
    return Object.freeze(normalized)
  }
  if (!isPlainObject(value)) {
    ancestors.delete(value)
    throw new CadModelError(`${path} must contain only plain objects.`)
  }

  const normalized: Record<string, MaterialVariable> = {}
  Object.entries(value).forEach(([key, item]) => {
    if (!key.trim()) throw new CadModelError(`${path} property names must not be empty.`)
    normalized[key] = normalizeJsonValue(item, `${path}.${key}`, ancestors)
  })
  ancestors.delete(value)
  return Object.freeze(normalized)
}

function normalizeJsonObject(value: unknown, path: string): Readonly<Record<string, MaterialVariable>> {
  if (!isPlainObject(value)) {
    throw new CadModelError(`${path} must be a plain object.`)
  }

  return normalizeJsonValue(value, path) as Readonly<Record<string, MaterialVariable>>
}

function cloneTensor(value: Tensor): Tensor {
  return Array.isArray(value) ? value.map(cloneTensor) : value
}

function freezeTensor(value: Tensor): Tensor {
  if (!Array.isArray(value)) return value

  value.forEach(freezeTensor)
  return Object.freeze(value)
}

function validateShape(shape: unknown, key: string): readonly number[] {
  if (!Array.isArray(shape)) {
    throw new CadModelError(`varsSchema.${key}.shape must be an array of positive integers.`)
  }

  const normalized = shape.map((size) => {
    if (!Number.isInteger(size) || size <= 0) {
      throw new CadModelError(`varsSchema.${key}.shape must contain only positive integers.`)
    }

    return size
  })

  return Object.freeze(normalized)
}

function validateTensor(value: unknown, shape: readonly number[], path: string): asserts value is Tensor {
  if (shape.length === 0) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new CadModelError(`${path} must be a finite number.`)
    }

    return
  }

  if (!Array.isArray(value) || value.length !== shape[0]) {
    throw new CadModelError(`${path} must have shape [${shape.join(', ')}].`)
  }

  value.forEach((item, index) => {
    validateTensor(item, shape.slice(1), `${path}[${index}]`)
  })
}

function validateBound(value: unknown, shape: readonly number[], path: string): asserts value is Tensor {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new CadModelError(`${path} must be a finite number.`)
    }

    return
  }

  validateTensor(value, shape, path)
}

function boundAt(bound: Tensor, index: number): Tensor {
  return Array.isArray(bound) ? bound[index] : bound
}

function validateRange(
  value: Tensor,
  min: Tensor | undefined,
  max: Tensor | undefined,
  shape: readonly number[],
  path: string,
) {
  if (shape.length === 0) {
    const scalar = value as number
    const minimum = min as number | undefined
    const maximum = max as number | undefined

    if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
      throw new CadModelError(`${path} has min greater than max.`)
    }

    if (minimum !== undefined && scalar < minimum) {
      throw new CadModelError(`${path} must be greater than or equal to ${minimum}.`)
    }

    if (maximum !== undefined && scalar > maximum) {
      throw new CadModelError(`${path} must be less than or equal to ${maximum}.`)
    }

    return
  }

  ;(value as readonly Tensor[]).forEach((item, index) => {
    validateRange(
      item,
      min === undefined ? undefined : boundAt(min, index),
      max === undefined ? undefined : boundAt(max, index),
      shape.slice(1),
      `${path}[${index}]`,
    )
  })
}

function normalizeVarsSchema(rawSchema: unknown, objectName: string) {
  if (!isRecord(rawSchema)) {
    throw new CadModelError(`${objectName} varsSchema must be an object.`)
  }

  const normalized: Record<string, VarsSchemaEntry> = {}

  Object.entries(rawSchema).forEach(([key, rawEntry]) => {
    if (!key.trim()) {
      throw new CadModelError('varsSchema keys must not be empty.')
    }

    if (!isRecord(rawEntry)) {
      throw new CadModelError(`varsSchema.${key} must be an object.`)
    }

    const shape = validateShape(rawEntry.shape, key)
    validateTensor(rawEntry.default, shape, `varsSchema.${key}.default`)

    const hasMin = rawEntry.min !== undefined
    const hasMax = rawEntry.max !== undefined

    if (hasMin !== hasMax) {
      throw new CadModelError(`varsSchema.${key} must define both min and max or neither.`)
    }

    if (hasMin) {
      validateBound(rawEntry.min, shape, `varsSchema.${key}.min`)
      validateBound(rawEntry.max, shape, `varsSchema.${key}.max`)
    }

    const defaultValue = freezeTensor(cloneTensor(rawEntry.default))
    const min = hasMin ? freezeTensor(cloneTensor(rawEntry.min as Tensor)) : undefined
    const max = hasMax ? freezeTensor(cloneTensor(rawEntry.max as Tensor)) : undefined

    validateRange(defaultValue, min, max, shape, `varsSchema.${key}.default`)

    normalized[key] = Object.freeze({
      shape,
      default: defaultValue,
      ...(min === undefined ? {} : { min }),
      ...(max === undefined ? {} : { max }),
    })
  })

  return Object.freeze(normalized)
}

function normalizeStructureGroup(
  rawGroup: unknown,
  propertyName: 'geometryGroup' | 'surfaceGroup',
  objectName: string,
) {
  if (rawGroup === undefined) return Object.freeze({}) as StructureGroupMap
  if (!isRecord(rawGroup)) {
    throw new CadModelError(`${objectName} ${propertyName} must be an object.`)
  }

  const names = new Set<string>()
  const entries = Object.entries(rawGroup).map(([rawName, rawMembers]) => {
    const name = rawName.trim()
    if (!name) {
      throw new CadModelError(`${objectName} ${propertyName} group names must not be empty.`)
    }
    if (names.has(name)) {
      throw new CadModelError(`${objectName} ${propertyName} group name "${name}" is duplicated after trimming.`)
    }
    names.add(name)

    if (!Array.isArray(rawMembers)) {
      throw new CadModelError(`${objectName} ${propertyName}.${name} must be an array of global IDs.`)
    }

    const memberIds: string[] = []
    const seenMemberIds = new Set<string>()
    rawMembers.forEach((rawMember, index) => {
      if (typeof rawMember !== 'string' || !rawMember.trim()) {
        throw new CadModelError(
          `${objectName} ${propertyName}.${name}[${index}] must be a non-empty string global ID.`,
        )
      }
      const memberId = rawMember.trim()
      if (seenMemberIds.has(memberId)) return
      seenMemberIds.add(memberId)
      memberIds.push(memberId)
    })

    return [name, Object.freeze(memberIds)] as const
  })

  return Object.freeze(Object.fromEntries(entries)) as StructureGroupMap
}

function normalizeVars(
  schema: Readonly<Record<string, VarsSchemaEntry>>,
  rawVars: unknown,
  variableObjectName: string,
) {
  if (!isRecord(rawVars)) {
    throw new CadModelError(`${variableObjectName} vars must be an object.`)
  }

  const schemaKeys = Object.keys(schema)
  const extraKey = Object.keys(rawVars).find((key) => !(key in schema))

  if (extraKey) {
    throw new CadModelError(`Unknown ${variableObjectName} var: ${extraKey}.`)
  }

  const normalized: Vars = {}

  schemaKeys.forEach((key) => {
    const entry = schema[key]
    const rawValue = rawVars[key] === undefined ? entry.default : rawVars[key]

    validateTensor(rawValue, entry.shape, `vars.${key}`)

    const value = freezeTensor(cloneTensor(rawValue))
    validateRange(value, entry.min, entry.max, entry.shape, `vars.${key}`)
    normalized[key] = value
  })

  return Object.freeze(normalized)
}

function createRandom(seed?: number) {
  if (seed === undefined) return Math.random

  if (!Number.isInteger(seed) || !Number.isSafeInteger(seed)) {
    throw new CadModelError('randomVars seed must be a safe integer.')
  }

  let state = seed >>> 0

  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function randomTensor(
  shape: readonly number[],
  min: Tensor,
  max: Tensor,
  random: () => number,
): Tensor {
  if (shape.length === 0) {
    const minimum = min as number
    const maximum = max as number
    return minimum + random() * (maximum - minimum)
  }

  return Array.from({ length: shape[0] }, (_, index) =>
    randomTensor(shape.slice(1), boundAt(min, index), boundAt(max, index), random),
  )
}

export class Material {
  readonly symbol: string
  readonly version?: string
  readonly variables: MaterialVariables

  constructor(symbol: string)
  constructor(symbol: string, variables: MaterialVariables)
  constructor(symbol: string, version: string)
  constructor(symbol: string, version: string, variables: MaterialVariables)
  constructor(
    symbol: string,
    versionOrVariables?: string | MaterialVariables,
    versionVariables?: MaterialVariables,
  ) {
    if (typeof symbol !== 'string' || !symbol.trim()) {
      throw new CadModelError('Material symbol must be a non-empty string.')
    }
    if (typeof versionOrVariables !== 'string' && arguments.length === 3) {
      throw new CadModelError('Material variables must follow a string version when a third argument is supplied.')
    }

    const version = typeof versionOrVariables === 'string' ? versionOrVariables.trim() : undefined
    if (typeof versionOrVariables === 'string' && !version) {
      throw new CadModelError(`Material ${symbol} version must be a non-empty string.`)
    }

    const rawVariables = typeof versionOrVariables === 'string'
      ? versionVariables === undefined ? {} : versionVariables
      : versionOrVariables === undefined ? {} : versionOrVariables
    if (!isPlainObject(rawVariables)) {
      throw new CadModelError(`Material ${symbol} variables must be a plain object.`)
    }

    const normalizedVariables: Record<string, MaterialVariable> = {}
    Object.entries(rawVariables).forEach(([key, value]) => {
      if (!key.trim()) throw new CadModelError(`Material ${symbol} variable names must not be empty.`)
      normalizedVariables[key] = normalizeJsonValue(value, `Material ${symbol} variables.${key}`)
    })
    if (normalizedVariables.color !== undefined) {
      if (typeof normalizedVariables.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(normalizedVariables.color)) {
        throw new CadModelError(`Material ${symbol} variables.color must use #RRGGBB format.`)
      }
      normalizedVariables.color = normalizedVariables.color.toLowerCase()
    }

    this.symbol = symbol.trim()
    if (version !== undefined) this.version = version
    this.variables = Object.freeze(normalizedVariables)
  }
}

export class Structure {
  readonly geometry: () => unknown
  readonly varsSchema: Readonly<Record<string, VarsSchemaEntry>>
  readonly geometryGroup: StructureGroupMap
  readonly surfaceGroup: StructureGroupMap

  constructor(options: StructureOptions) {
    const objectName = new.target.name || 'Structure'
    if (!isRecord(options) || typeof options.geometry !== 'function') {
      throw new CadModelError(`${objectName} geometry must be a function.`)
    }

    this.geometry = options.geometry
    this.varsSchema = normalizeVarsSchema(options.varsSchema, objectName)
    this.geometryGroup = normalizeStructureGroup(options.geometryGroup, 'geometryGroup', objectName)
    this.surfaceGroup = normalizeStructureGroup(options.surfaceGroup, 'surfaceGroup', objectName)
    if (new.target === Structure) Object.freeze(this)
  }

  randomVars(seed?: number) {
    const random = createRandom(seed)
    const generated: Vars = {}

    Object.entries(this.varsSchema).forEach(([key, entry]) => {
      generated[key] =
        entry.min === undefined || entry.max === undefined
          ? cloneTensor(entry.default)
          : randomTensor(entry.shape, entry.min, entry.max, random)
    })

    return normalizeVars(this.varsSchema, generated, this.constructor.name || 'Structure')
  }
}

const emptyExperimentRules = Object.freeze([]) as readonly ExperimentRule<never>[]

function emptyRuleFactory() {
  return emptyExperimentRules
}

export class Experiment<
  TInitialConditionParameters extends object = Record<string, unknown>,
  TBoundaryConditionParameters extends object = Record<string, unknown>,
  TRecordedDataParameters extends object = Record<string, unknown>,
> extends Structure {
  readonly solver: ExperimentSolver
  readonly initialConditions: () => readonly ExperimentRule<TInitialConditionParameters>[]
  readonly boundaryConditions: () => readonly ExperimentRule<TBoundaryConditionParameters>[]
  readonly recordedData: () => readonly ExperimentRule<TRecordedDataParameters>[]

  constructor(options: ExperimentOptions<
    TInitialConditionParameters,
    TBoundaryConditionParameters,
    TRecordedDataParameters
  >) {
    super(options)

    if (!isPlainObject(options.solver)) {
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
    if (options.initialConditions !== undefined && typeof options.initialConditions !== 'function') {
      throw new CadModelError('Experiment initialConditions must be a function.')
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
    this.initialConditions = options.initialConditions ?? emptyRuleFactory
    this.boundaryConditions = options.boundaryConditions ?? emptyRuleFactory
    this.recordedData = options.recordedData ?? emptyRuleFactory
    Object.freeze(this)
  }
}

export function evaluateExperimentSolver(experiment: Experiment<object, object, object>) {
  return Object.freeze({
    name: experiment.solver.name,
    version: experiment.solver.version,
    parameters: normalizeJsonObject(experiment.solver.parameters(), 'Experiment solver parameters'),
  })
}

function normalizeExperimentTarget(
  rawTarget: unknown,
  propertyName: 'initialConditions' | 'boundaryConditions' | 'recordedData',
  ruleIndex: number,
  targetIndex: number,
  experiment: Experiment<object, object, object>,
) {
  const targetPath = `Experiment ${propertyName}[${ruleIndex}].target[${targetIndex}]`
  if (typeof rawTarget !== 'string') {
    throw new CadModelError(`${targetPath} must be a string.`)
  }

  const target = rawTarget.trim()
  const firstSeparator = target.indexOf('.')
  const secondSeparator = target.indexOf('.', firstSeparator + 1)
  if (firstSeparator <= 0 || secondSeparator <= firstSeparator + 1) {
    throw new CadModelError(
      `${targetPath} must use source.kind.group format.`,
    )
  }

  const source = target.slice(0, firstSeparator)
  const kind = target.slice(firstSeparator + 1, secondSeparator)
  const group = target.slice(secondSeparator + 1).trim()
  if ((source !== 'experiment' && source !== 'structure') || (kind !== 'geometry' && kind !== 'surface') || !group) {
    throw new CadModelError(
      `${targetPath} must use source.kind.group format.`,
    )
  }

  if (source === 'experiment') {
    const groups = kind === 'geometry' ? experiment.geometryGroup : experiment.surfaceGroup
    if (!Object.prototype.hasOwnProperty.call(groups, group)) {
      throw new CadModelError(
        `${targetPath} references missing ${kind} group "${group}".`,
      )
    }
  }

  return `${source}.${kind}.${group}` as ExperimentTarget
}

function normalizeExperimentRuleList<TParameters extends object>(
  rawRules: unknown,
  propertyName: 'initialConditions' | 'boundaryConditions' | 'recordedData',
  experiment: Experiment<object, object, object>,
) {
  if (!Array.isArray(rawRules)) {
    throw new CadModelError(`Experiment ${propertyName} must return an array.`)
  }

  const labels = new Set<string>()
  return Object.freeze(rawRules.map((rawRule, index): ExperimentRule<TParameters> => {
    if (
      !isRecord(rawRule)
      || !Object.prototype.hasOwnProperty.call(rawRule, 'target')
      || !Object.prototype.hasOwnProperty.call(rawRule, 'label')
      || !Object.prototype.hasOwnProperty.call(rawRule, 'methodId')
      || !Object.prototype.hasOwnProperty.call(rawRule, 'parameters')
    ) {
      throw new CadModelError(
        `Experiment ${propertyName}[${index}] must contain target, label, methodId, and parameters.`,
      )
    }
    if (!Array.isArray(rawRule.target) || rawRule.target.length === 0) {
      throw new CadModelError(`Experiment ${propertyName}[${index}].target must be a non-empty array.`)
    }
    if (typeof rawRule.label !== 'string' || !rawRule.label.trim()) {
      throw new CadModelError(`Experiment ${propertyName}[${index}].label must be a non-empty string.`)
    }
    const label = rawRule.label.trim()
    if (labels.has(label)) {
      throw new CadModelError(`Experiment ${propertyName} label "${label}" is duplicated.`)
    }
    labels.add(label)
    if (typeof rawRule.methodId !== 'string' || !rawRule.methodId.trim()) {
      throw new CadModelError(`Experiment ${propertyName}[${index}].methodId must be a non-empty string.`)
    }
    if (!isRecord(rawRule.parameters)) {
      throw new CadModelError(`Experiment ${propertyName}[${index}].parameters must be an object.`)
    }

    return Object.freeze({
      target: Object.freeze(rawRule.target.map((target, targetIndex) =>
        normalizeExperimentTarget(target, propertyName, index, targetIndex, experiment))),
      label,
      methodId: rawRule.methodId.trim(),
      parameters: rawRule.parameters as TParameters,
    })
  }))
}

export function evaluateExperimentRules<
  TInitialConditionParameters extends object,
  TBoundaryConditionParameters extends object,
  TRecordedDataParameters extends object,
>(
  experiment: Experiment<
    TInitialConditionParameters,
    TBoundaryConditionParameters,
    TRecordedDataParameters
  >,
) {
  return Object.freeze({
    initialConditions: normalizeExperimentRuleList<TInitialConditionParameters>(
      experiment.initialConditions(),
      'initialConditions',
      experiment,
    ),
    boundaryConditions: normalizeExperimentRuleList<TBoundaryConditionParameters>(
      experiment.boundaryConditions(),
      'boundaryConditions',
      experiment,
    ),
    recordedData: normalizeExperimentRuleList<TRecordedDataParameters>(
      experiment.recordedData(),
      'recordedData',
      experiment,
    ),
  })
}

export abstract class VariableObject<TObject extends Structure> {
  readonly object: TObject
  readonly vars: Readonly<Vars>

  protected constructor(object: TObject, partialVars: Partial<Vars> = {}) {
    const variableObjectName = new.target.name || 'VariableObject'
    if (new.target === VariableObject) {
      throw new CadModelError('VariableObject is abstract and cannot be instantiated directly.')
    }
    if (!(object instanceof Structure)) {
      throw new CadModelError(`${variableObjectName} requires a Structure-derived object.`)
    }

    this.object = object
    this.vars = normalizeVars(object.varsSchema, partialVars, variableObjectName)
  }
}

export class Sample extends VariableObject<Structure> {
  get structure() {
    return this.object
  }

  constructor(structure: Structure, partialVars: Partial<Vars> = {}) {
    if (!(structure instanceof Structure)) {
      throw new CadModelError('Sample requires a Structure instance.')
    }
    if (structure instanceof Experiment) {
      throw new CadModelError('Sample cannot wrap an Experiment. Use Setup instead.')
    }

    super(structure, partialVars)
    Object.freeze(this)
  }
}

export class Setup<
  TInitialConditionParameters extends object = Record<string, unknown>,
  TBoundaryConditionParameters extends object = Record<string, unknown>,
  TRecordedDataParameters extends object = Record<string, unknown>,
> extends VariableObject<Experiment<
    TInitialConditionParameters,
    TBoundaryConditionParameters,
    TRecordedDataParameters
  >> {
  get experiment() {
    return this.object
  }

  constructor(
    experiment: Experiment<
      TInitialConditionParameters,
      TBoundaryConditionParameters,
      TRecordedDataParameters
    >,
    partialVars: Partial<Vars> = {},
  ) {
    if (!(experiment instanceof Experiment)) {
      throw new CadModelError('Setup requires an Experiment instance.')
    }

    super(experiment, partialVars)
    Object.freeze(this)
  }
}

let activeVars: Readonly<Vars> | null = null

export const vars = new Proxy<Record<string, Tensor>>(
  {},
  {
    deleteProperty() {
      throw new CadModelError('Global vars is read-only.')
    },
    get(_target, key) {
      if (activeVars === null) {
        throw new CadModelError('Global vars is only available while a Sample is being evaluated.')
      }

      if (typeof key === 'symbol') return undefined
      return activeVars[key]
    },
    getOwnPropertyDescriptor(_target, key) {
      if (activeVars === null || typeof key === 'symbol' || !(key in activeVars)) return undefined

      return {
        configurable: true,
        enumerable: true,
        value: activeVars[key],
        writable: false,
      }
    },
    has(_target, key) {
      return activeVars !== null && typeof key === 'string' && key in activeVars
    },
    ownKeys() {
      return activeVars === null ? [] : Reflect.ownKeys(activeVars)
    },
    set() {
      throw new CadModelError('Global vars is read-only.')
    },
  },
)

export function evaluateWithVars<T>(sampleVars: Readonly<Vars>, evaluate: () => T) {
  const previousVars = activeVars
  activeVars = sampleVars

  try {
    return evaluate()
  } finally {
    activeVars = previousVars
  }
}


