import type { Rotation, Tensor, Vars, Vec3 } from './types'
import { CadModelError } from './errors'
import {
  assertUcumUnitComparable,
  normalizeUcumUnit,
  type UcumUnit,
} from './units'

export type { Rotation, Tensor, Vars, Vec3 } from './types'
export { CadModelError } from './errors'
export type { UcumUnit } from './units'
export type FloatValue = Readonly<{
  type: 'float'
  value: number
  unit?: UcumUnit
}>
export type MaterialVariable =
  | string
  | number
  | boolean
  | null
  | FloatValue
  | readonly MaterialVariable[]
  | Readonly<{ [key: string]: MaterialVariable }>
export type MaterialVariables = Readonly<Record<string, MaterialVariable> & { color?: string }>
export type SolverParameters = Readonly<Record<string, MaterialVariable>>
export type ExperimentSolver = Readonly<{
  name: string
  version: string
  parameters: () => SolverParameters
}>
export type ResolvedExperimentSolver = Readonly<{
  name: string
  version: string
  parameters: SolverParameters
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
export type ExperimentTensorDType =
  | 'bool'
  | 'string'
  | 'int8'
  | 'int16'
  | 'int32'
  | 'int64'
  | 'uint8'
  | 'uint16'
  | 'uint32'
  | 'uint64'
  | 'float16'
  | 'float32'
  | 'float64'
export type ExperimentScalarParameter =
  | boolean
  | string
  | number
  | Readonly<{ type: 'bool'; value: boolean }>
  | Readonly<{ type: 'string'; value: string }>
  | Readonly<{ type: 'int'; value: number }>
  | FloatValue
export type ExperimentTensorAxis = Readonly<{
  name?: string
  ticks?: readonly (number | string)[]
  unit?: UcumUnit
}>
export type ExperimentTensorParameter = Readonly<{
  type: 'tensor'
  dimension: number
  shape: readonly number[]
  dtype: ExperimentTensorDType
  axes?: readonly ExperimentTensorAxis[]
  unit?: UcumUnit
  value: boolean | string | number | readonly unknown[]
}>
export type ExperimentParameter = ExperimentScalarParameter | ExperimentTensorParameter
export type ExperimentParameters = Readonly<Record<string, ExperimentParameter>>
export type RecordedDataResult = Readonly<{
  type: 'tensor'
  dimension: number
  shape: readonly number[]
  dtype: ExperimentTensorDType
  axes?: readonly ExperimentTensorAxis[]
  unit?: UcumUnit
}>
export type ExperimentRule<TParameters extends ExperimentParameters = ExperimentParameters> = Readonly<{
  target: readonly ExperimentTarget[]
  label: string
  methodId: string
  parameters: TParameters
}>
export type RecordedDataRule<TParameters extends ExperimentParameters = ExperimentParameters> = Readonly<
  ExperimentRule<TParameters> & { result: RecordedDataResult }
>
export type RecordedDataAxis = Readonly<{
  ticks?: readonly (number | string)[]
}>
export type RecordedDataTensor = Readonly<{
  value: boolean | string | number | readonly unknown[]
  axes?: readonly RecordedDataAxis[]
}>
export type RecordedData = Readonly<Record<string, RecordedDataTensor>>
export type EvaluatedExperimentRules<
  TInitialConditionParameters extends ExperimentParameters = ExperimentParameters,
  TBoundaryConditionParameters extends ExperimentParameters = ExperimentParameters,
  TRecordedDataParameters extends ExperimentParameters = ExperimentParameters,
> = Readonly<{
  initialConditions: readonly ExperimentRule<TInitialConditionParameters>[]
  boundaryConditions: readonly ExperimentRule<TBoundaryConditionParameters>[]
  recordedData: readonly RecordedDataRule<TRecordedDataParameters>[]
}>

type StructureOptions = {
  geometry: () => unknown
  lengthUnit: UcumUnit
  varsSchema: Record<string, VarsSchemaEntry>
  geometryGroup?: StructureGroupMap
  surfaceGroup?: StructureGroupMap
}

type ExperimentOptions<
  TInitialConditionParameters extends ExperimentParameters,
  TBoundaryConditionParameters extends ExperimentParameters,
  TRecordedDataParameters extends ExperimentParameters,
> = StructureOptions & {
  solver: ExperimentSolver
  initialConditions?: () => readonly ExperimentRule<TInitialConditionParameters>[]
  boundaryConditions?: () => readonly ExperimentRule<TBoundaryConditionParameters>[]
  recordedData?: () => readonly RecordedDataRule<TRecordedDataParameters>[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))
}

function normalizeFloatValue(value: Record<string, unknown>, path: string): FloatValue {
  const descriptorKeys = ['type', 'value']
  if (Object.prototype.hasOwnProperty.call(value, 'unit')) descriptorKeys.push('unit')
  assertDescriptorKeys(value, descriptorKeys, path)
  if (value.type !== 'float') throw new CadModelError(`${path}.type must be float.`)
  if (typeof value.value !== 'number' || !Number.isFinite(value.value)) {
    throw new CadModelError(`${path}.value must be a finite number.`)
  }
  const unit = value.unit === undefined ? undefined : normalizeUcumUnit(value.unit, `${path}.unit`)
  return Object.freeze({
    type: 'float' as const,
    value: value.value,
    ...(unit === undefined ? {} : { unit }),
  })
}

function normalizeJsonValue(
  value: unknown,
  path: string,
  ancestors = new Set<object>(),
): MaterialVariable {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new CadModelError(`${path} must be a finite number.`)
    if (!Number.isSafeInteger(value)) {
      throw new CadModelError(`${path} raw numbers must be safe integers; use a float descriptor for float values.`)
    }
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
  if (value.type === 'float') {
    ancestors.delete(value)
    return normalizeFloatValue(value, path)
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
  readonly lengthUnit: UcumUnit
  readonly varsSchema: Readonly<Record<string, VarsSchemaEntry>>
  readonly geometryGroup: StructureGroupMap
  readonly surfaceGroup: StructureGroupMap

  constructor(options: StructureOptions) {
    const objectName = new.target.name || 'Structure'
    if (!isRecord(options) || typeof options.geometry !== 'function') {
      throw new CadModelError(`${objectName} geometry must be a function.`)
    }
    const lengthUnit = normalizeUcumUnit(options.lengthUnit, `${objectName} lengthUnit`)
    assertUcumUnitComparable(lengthUnit, 'm', `${objectName} lengthUnit`)

    this.geometry = options.geometry
    this.lengthUnit = lengthUnit
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

const emptyExperimentRules = Object.freeze([]) as readonly never[]

function emptyRuleFactory<TRule>() {
  return emptyExperimentRules as readonly TRule[]
}

export class Experiment<
  TInitialConditionParameters extends ExperimentParameters = ExperimentParameters,
  TBoundaryConditionParameters extends ExperimentParameters = ExperimentParameters,
  TRecordedDataParameters extends ExperimentParameters = ExperimentParameters,
> extends Structure {
  readonly solver: ExperimentSolver
  readonly initialConditions: () => readonly ExperimentRule<TInitialConditionParameters>[]
  readonly boundaryConditions: () => readonly ExperimentRule<TBoundaryConditionParameters>[]
  readonly recordedData: () => readonly RecordedDataRule<TRecordedDataParameters>[]

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

export function evaluateExperimentSolver(experiment: Experiment): ResolvedExperimentSolver {
  return Object.freeze({
    name: experiment.solver.name,
    version: experiment.solver.version,
    parameters: normalizeJsonObject(experiment.solver.parameters(), 'Experiment solver parameters'),
  })
}

const experimentTensorDTypes = new Set<ExperimentTensorDType>([
  'bool',
  'string',
  'int8',
  'int16',
  'int32',
  'int64',
  'uint8',
  'uint16',
  'uint32',
  'uint64',
  'float16',
  'float32',
  'float64',
])
const experimentIntegerRanges: Partial<Record<ExperimentTensorDType, readonly [number, number]>> = {
  int8: [-128, 127],
  int16: [-32768, 32767],
  int32: [-2147483648, 2147483647],
  int64: [-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  uint8: [0, 255],
  uint16: [0, 65535],
  uint32: [0, 4294967295],
  uint64: [0, Number.MAX_SAFE_INTEGER],
}

export function isExperimentFloatDType(dtype: ExperimentTensorDType) {
  return dtype === 'float16' || dtype === 'float32' || dtype === 'float64'
}

function assertDescriptorKeys(value: Record<string, unknown>, expected: readonly string[], path: string) {
  const keys = Reflect.ownKeys(value)
  const invalid = keys.filter((key) => typeof key !== 'string' || !expected.includes(key))
  const missing = expected.filter((key) => !Object.prototype.hasOwnProperty.call(value, key))
  if (invalid.length > 0 || missing.length > 0 || keys.length !== expected.length) {
    throw new CadModelError(`${path} must contain exactly ${expected.join(', ')}.`)
  }
}

function normalizeTensorAxes(
  value: unknown,
  shape: readonly number[],
  path: string,
  allowDynamicShape: boolean,
) {
  if (value !== undefined && !Array.isArray(value)) {
    throw new CadModelError(`${path}.axes must be an array.`)
  }
  const rawAxes = value ?? Array.from({ length: shape.length }, () => ({}))
  if ((rawAxes as readonly unknown[]).length !== shape.length) {
    throw new CadModelError(
      `${path}.axes has length ${(rawAxes as readonly unknown[]).length}; expected ${shape.length}.`,
    )
  }

  return Object.freeze(Array.from(rawAxes as readonly unknown[], (rawAxis, axisIndex) => {
    const axisPath = `${path}.axes[${axisIndex}]`
    if (!isPlainObject(rawAxis)) {
      throw new CadModelError(`${axisPath} must be a plain object.`)
    }
    const axisKeys = ['name', 'ticks', 'unit'].filter((key) => Object.prototype.hasOwnProperty.call(rawAxis, key))
    assertDescriptorKeys(rawAxis, axisKeys, axisPath)

    const name = rawAxis.name === undefined ? `axis ${axisIndex}` : rawAxis.name
    if (typeof name !== 'string' || !name.trim()) {
      throw new CadModelError(`${axisPath}.name must be a non-empty string.`)
    }
    const unit = rawAxis.unit === undefined ? undefined : normalizeUcumUnit(rawAxis.unit, `${axisPath}.unit`)

    if (allowDynamicShape && shape[axisIndex] === -1) {
      if (Object.prototype.hasOwnProperty.call(rawAxis, 'ticks')) {
        throw new CadModelError(`${axisPath}.ticks must be omitted when shape[${axisIndex}] is -1.`)
      }
      return Object.freeze({ name: name.trim(), ...(unit === undefined ? {} : { unit }) })
    }

    const rawTicks = rawAxis.ticks === undefined
      ? Array.from({ length: shape[axisIndex] }, (_, tickIndex) => tickIndex)
      : rawAxis.ticks
    if (!Array.isArray(rawTicks)) {
      throw new CadModelError(`${axisPath}.ticks must be an array.`)
    }
    if (rawTicks.length !== shape[axisIndex]) {
      throw new CadModelError(
        `${axisPath}.ticks has length ${rawTicks.length}; expected ${shape[axisIndex]} for shape[${axisIndex}].`,
      )
    }
    const ticks = Object.freeze(Array.from(rawTicks, (tick, tickIndex) => {
      if (typeof tick === 'string' || (typeof tick === 'number' && Number.isFinite(tick))) return tick
      throw new CadModelError(`${axisPath}.ticks[${tickIndex}] must be a string or finite number.`)
    }))

    return Object.freeze({ name: name.trim(), ticks, ...(unit === undefined ? {} : { unit }) })
  }))
}

function normalizeTensorSchema(
  value: Record<string, unknown>,
  path: string,
  minimumDimension: number,
  allowDynamicShape = false,
) {
  if (!Number.isSafeInteger(value.dimension) || (value.dimension as number) < minimumDimension) {
    throw new CadModelError(`${path}.dimension must be a safe integer greater than or equal to ${minimumDimension}.`)
  }
  if (!Array.isArray(value.shape)) {
    throw new CadModelError(`${path}.shape must be an array.`)
  }
  const shape = Array.from(value.shape, (size, index) => {
    if (!Number.isSafeInteger(size) || (size as number) <= 0) {
      if (allowDynamicShape && size === -1) return -1
      throw new CadModelError(
        allowDynamicShape
          ? `${path}.shape[${index}] must be -1 or a positive safe integer.`
          : `${path}.shape[${index}] must be a positive safe integer.`,
      )
    }
    return size as number
  })
  if (value.dimension !== shape.length) {
    throw new CadModelError(
      `${path}.dimension is ${String(value.dimension)}, but shape ${JSON.stringify(shape)} has dimension ${shape.length}.`,
    )
  }
  if (typeof value.dtype !== 'string' || !experimentTensorDTypes.has(value.dtype as ExperimentTensorDType)) {
    throw new CadModelError(`${path}.dtype must be a supported tensor dtype.`)
  }
  const dtype = value.dtype as ExperimentTensorDType
  if (value.unit !== undefined && !isExperimentFloatDType(dtype)) {
    throw new CadModelError(`${path}.unit is allowed only for float tensor dtypes.`)
  }
  const unit = value.unit === undefined ? undefined : normalizeUcumUnit(value.unit, `${path}.unit`)
  return {
    axes: normalizeTensorAxes(value.axes, shape, path, allowDynamicShape),
    dimension: value.dimension as number,
    dtype,
    shape: Object.freeze(shape),
    ...(unit === undefined ? {} : { unit }),
  }
}

function describeTensorShape(value: unknown, ancestors = new Set<unknown>()): string {
  if (!Array.isArray(value)) return '[]'
  if (ancestors.has(value)) return '[circular]'
  if (value.length === 0) return '[0]'

  ancestors.add(value)
  const childShapes = value.map((item) => describeTensorShape(item, ancestors))
  ancestors.delete(value)
  const uniqueShapes = [...new Set(childShapes)]
  if (uniqueShapes.length !== 1) {
    return `[${value.length}, ragged ${uniqueShapes.join(' | ')}]`
  }
  const child = uniqueShapes[0]
  return child === '[]'
    ? `[${value.length}]`
    : `[${value.length}, ${child.slice(1, -1)}]`
}

function tensorShapeError(path: string, value: unknown, shape: readonly number[]): CadModelError {
  return new CadModelError(
    `${path} has actual shape ${describeTensorShape(value)}; expected shape ${JSON.stringify(shape)}.`,
  )
}

export function normalizeExperimentTensorElement(
  value: unknown,
  dtype: ExperimentTensorDType,
  path: string,
) {
  if (dtype === 'bool') {
    if (typeof value !== 'boolean') throw new CadModelError(`${path} must be a bool element.`)
    return value
  }
  if (dtype === 'string') {
    if (typeof value !== 'string') throw new CadModelError(`${path} must be a string element.`)
    return value
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CadModelError(`${path} must be a finite ${dtype} element.`)
  }

  const range = experimentIntegerRanges[dtype]
  if (range) {
    if (!Number.isSafeInteger(value) || value < range[0] || value > range[1]) {
      throw new CadModelError(`${path} must be a ${dtype} safe integer in [${range[0]}, ${range[1]}].`)
    }
    return value
  }
  if (dtype === 'float16' && Math.abs(value) > 65504) {
    throw new CadModelError(`${path} must be a finite float16 value in [-65504, 65504].`)
  }
  if (dtype === 'float32' && !Number.isFinite(Math.fround(value))) {
    throw new CadModelError(`${path} must be representable as a finite float32 value.`)
  }
  return value
}

function normalizeTensorValue(
  value: unknown,
  shape: readonly number[],
  dtype: ExperimentTensorDType,
  path: string,
  rootValue = value,
  rootPath = path,
  depth = 0,
  ancestors = new Set<unknown>(),
): boolean | string | number | readonly unknown[] {
  if (depth === shape.length) {
    if (Array.isArray(value)) throw tensorShapeError(rootPath, rootValue, shape)
    return normalizeExperimentTensorElement(value, dtype, path)
  }
  if (!Array.isArray(value) || value.length !== shape[depth] || ancestors.has(value)) {
    throw tensorShapeError(rootPath, rootValue, shape)
  }

  ancestors.add(value)
  const normalized = value.map((item, index) => normalizeTensorValue(
    item,
    shape,
    dtype,
    `${path}[${index}]`,
    rootValue,
    rootPath,
    depth + 1,
    ancestors,
  ))
  ancestors.delete(value)
  return Object.freeze(normalized)
}

export function normalizeExperimentTensorParameter(
  value: unknown,
  path = 'Experiment tensor parameter',
): ExperimentTensorParameter {
  if (!isPlainObject(value) || value.type !== 'tensor') {
    throw new CadModelError(`${path} must be a tensor descriptor.`)
  }
  const descriptorKeys = ['type', 'dimension', 'shape', 'dtype', 'value']
  if (Object.prototype.hasOwnProperty.call(value, 'axes')) descriptorKeys.push('axes')
  if (Object.prototype.hasOwnProperty.call(value, 'unit')) descriptorKeys.push('unit')
  assertDescriptorKeys(value, descriptorKeys, path)
  const schema = normalizeTensorSchema(value, path, 1)
  return Object.freeze({
    type: 'tensor' as const,
    ...schema,
    value: normalizeTensorValue(value.value, schema.shape, schema.dtype, `${path}.value`),
  })
}

function normalizeScalarDescriptor(value: Record<string, unknown>, path: string): ExperimentScalarParameter {
  if (value.type === 'float') return normalizeFloatValue(value, path)
  assertDescriptorKeys(value, ['type', 'value'], path)
  if (value.type === 'bool') {
    if (typeof value.value !== 'boolean') throw new CadModelError(`${path}.value must be a boolean.`)
    return Object.freeze({ type: 'bool' as const, value: value.value })
  }
  if (value.type === 'string') {
    if (typeof value.value !== 'string') throw new CadModelError(`${path}.value must be a string.`)
    return Object.freeze({ type: 'string' as const, value: value.value })
  }
  if (value.type === 'int') {
    if (typeof value.value !== 'number' || !Number.isSafeInteger(value.value)) {
      throw new CadModelError(`${path}.value must be a safe integer.`)
    }
    return Object.freeze({ type: 'int' as const, value: value.value })
  }
  throw new CadModelError(`${path}.type must be bool, string, int, float, or tensor.`)
}

function normalizeExperimentParameter(value: unknown, path: string): ExperimentParameter {
  if (typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new CadModelError(`${path} must be finite.`)
    if (!Number.isSafeInteger(value)) {
      throw new CadModelError(`${path} raw numbers must be safe integers; use a float descriptor for float values.`)
    }
    return value
  }
  if (!isPlainObject(value)) {
    throw new CadModelError(`${path} must be a scalar or an explicit tensor descriptor.`)
  }
  return value.type === 'tensor'
    ? normalizeExperimentTensorParameter(value, path)
    : normalizeScalarDescriptor(value, path)
}

function normalizeExperimentParameters<TParameters extends ExperimentParameters>(
  value: unknown,
  path: string,
): TParameters {
  if (!isPlainObject(value)) throw new CadModelError(`${path} must be an object.`)
  const normalized: Record<string, ExperimentParameter> = {}
  Object.entries(value).forEach(([key, parameter]) => {
    normalized[key] = normalizeExperimentParameter(parameter, `${path}.${key}`)
  })
  return Object.freeze(normalized) as TParameters
}

function normalizeRecordedDataResult(value: unknown, path: string): RecordedDataResult {
  if (!isPlainObject(value) || value.type !== 'tensor') {
    throw new CadModelError(`${path} must be a tensor descriptor.`)
  }
  const descriptorKeys = ['type', 'dimension', 'shape', 'dtype']
  if (Object.prototype.hasOwnProperty.call(value, 'axes')) descriptorKeys.push('axes')
  if (Object.prototype.hasOwnProperty.call(value, 'unit')) descriptorKeys.push('unit')
  assertDescriptorKeys(value, descriptorKeys, path)
  return Object.freeze({
    type: 'tensor' as const,
    ...normalizeTensorSchema(value, path, 0, true),
  })
}

function normalizeExperimentTarget(
  rawTarget: unknown,
  propertyName: 'initialConditions' | 'boundaryConditions' | 'recordedData',
  ruleIndex: number,
  targetIndex: number,
  experiment: Pick<Structure, 'geometryGroup' | 'surfaceGroup'>,
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

function normalizeExperimentRuleList<TParameters extends ExperimentParameters>(
  rawRules: unknown,
  propertyName: 'initialConditions' | 'boundaryConditions' | 'recordedData',
  experiment: Pick<Structure, 'geometryGroup' | 'surfaceGroup'>,
) {
  if (!Array.isArray(rawRules)) {
    throw new CadModelError(`Experiment ${propertyName} must return an array.`)
  }

  const labels = new Set<string>()
  return Object.freeze(rawRules.map((rawRule, index): ExperimentRule<TParameters> | RecordedDataRule<TParameters> => {
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

    const rule = {
      target: Object.freeze(rawRule.target.map((target, targetIndex) =>
        normalizeExperimentTarget(target, propertyName, index, targetIndex, experiment))),
      label,
      methodId: rawRule.methodId.trim(),
      parameters: normalizeExperimentParameters<TParameters>(
        rawRule.parameters,
        `Experiment ${propertyName}[${index}].parameters`,
      ),
    }
    if (propertyName !== 'recordedData') return Object.freeze(rule)
    if (!Object.prototype.hasOwnProperty.call(rawRule, 'result')) {
      throw new CadModelError(`Experiment recordedData[${index}] must contain a result tensor descriptor.`)
    }
    return Object.freeze({
      ...rule,
      result: normalizeRecordedDataResult(rawRule.result, `Experiment recordedData[${index}].result`),
    })
  }))
}

export function evaluateExperimentRules<
  TInitialConditionParameters extends ExperimentParameters,
  TBoundaryConditionParameters extends ExperimentParameters,
  TRecordedDataParameters extends ExperimentParameters,
>(
  experiment: Experiment<
    TInitialConditionParameters,
    TBoundaryConditionParameters,
    TRecordedDataParameters
  >,
): EvaluatedExperimentRules<
  TInitialConditionParameters,
  TBoundaryConditionParameters,
  TRecordedDataParameters
> {
  return Object.freeze({
    initialConditions: normalizeExperimentRuleList<TInitialConditionParameters>(
      experiment.initialConditions(),
      'initialConditions',
      experiment,
    ) as readonly ExperimentRule<TInitialConditionParameters>[],
    boundaryConditions: normalizeExperimentRuleList<TBoundaryConditionParameters>(
      experiment.boundaryConditions(),
      'boundaryConditions',
      experiment,
    ) as readonly ExperimentRule<TBoundaryConditionParameters>[],
    recordedData: normalizeExperimentRuleList<TRecordedDataParameters>(
      experiment.recordedData(),
      'recordedData',
      experiment,
    ) as readonly RecordedDataRule<TRecordedDataParameters>[],
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
  TInitialConditionParameters extends ExperimentParameters = ExperimentParameters,
  TBoundaryConditionParameters extends ExperimentParameters = ExperimentParameters,
  TRecordedDataParameters extends ExperimentParameters = ExperimentParameters,
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


