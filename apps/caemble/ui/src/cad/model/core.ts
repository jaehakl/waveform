import type { Rotation, Tensor, Vars, Vec3 } from './types'
import { CadModelError } from './errors'
import {
  assertUcumUnitComparable,
  normalizeUcumUnit,
  type UcumUnit,
} from './units'
import {
  getQuantityKindComponentShape,
  normalizeQuantityMetadata,
  type QuantityMetadata,
  type ScalarQuantityKindName,
  type TensorQuantityKindName,
} from '../../quantitykind/runtime'

export type { Rotation, Tensor, Vars, Vec3 } from './types'
export { CadModelError } from './errors'
export type { UcumUnit } from './units'
export type {
  CartesianBasis,
  QuantityKindName,
  QuantityMetadata,
  ScalarQuantityKindName,
  TensorQuantityKindName,
} from '../../quantitykind/runtime'
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
  min: Tensor
  max: Tensor
}

type NormalizedVarsSchemaEntry = Readonly<VarsSchemaEntry & { shape: readonly number[] }>
type NormalizedVarsSchema = Readonly<Record<string, NormalizedVarsSchemaEntry>>

export type StructureGroupMap = Readonly<Record<string, readonly string[]>>
export type ExperimentTarget = `${'experiment' | 'structure'}.${'geometry' | 'surface'}.${string}`
export type DataDType =
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
export type FloatDataDType = Extract<DataDType, `float${number}`>
export type NonFloatDataDType = Exclude<DataDType, FloatDataDType>
export type IntegerDataDType = Exclude<NonFloatDataDType, 'bool' | 'string'>
type DataAxisBase = Readonly<{
  length: number
  name?: string
  ticks?: readonly (number | string)[]
}>
export type DataAxis = DataAxisBase & Readonly<
  | { unit: UcumUnit; quantityKind: ScalarQuantityKindName }
  | { unit?: never; quantityKind?: never }
>
type DataValueDescriptorBase = Readonly<{
  axes?: readonly DataAxis[]
  value: boolean | string | number | readonly unknown[]
}>
export type MatrixValue = readonly (readonly number[])[]
export type DataValueDescriptor = DataValueDescriptorBase & Readonly<
  | ({
    dtype: FloatDataDType
  } & (
    QuantityMetadata<ScalarQuantityKindName>
    | QuantityMetadata<TensorQuantityKindName>
  ))
  | {
    dtype: NonFloatDataDType
    unit?: never
    quantityKind?: never
    basis?: never
  }
>
export type MaterialDataValueDescriptor = Readonly<
  | (DataValueDescriptorBase & {
    dtype: FloatDataDType
    errorRate: number
  } & (
    QuantityMetadata<ScalarQuantityKindName>
    | QuantityMetadata<TensorQuantityKindName>
  ))
  | (DataValueDescriptorBase & {
    dtype: NonFloatDataDType
    errorRate?: never
    unit?: never
    quantityKind?: never
    basis?: never
  })
>
export type ScalarValue = boolean | string | number
export type MaterialVariable = ScalarValue | MaterialDataValueDescriptor
export type MaterialVariables = Readonly<
  Record<string, MaterialVariable> & { color?: string }
>
export type ResolvedMaterialVariables = Readonly<
  Record<string, ScalarValue | DataValueDescriptor> & { color?: string }
>
export type SolverParameterValue = ScalarValue | DataValueDescriptor
export type SolverParameters = Readonly<Record<string, SolverParameterValue>>
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
export type ExperimentParameter = ScalarValue | DataValueDescriptor
export type ExperimentParameters = Readonly<Record<string, ExperimentParameter>>
type RecordedDataResultAxisBase = Readonly<{
  length?: number
  name?: string
  ticks?: readonly (number | string)[]
}>
export type RecordedDataResultAxis = RecordedDataResultAxisBase & Readonly<
  | { unit: UcumUnit; quantityKind: ScalarQuantityKindName }
  | { unit?: never; quantityKind?: never }
>
type RecordedDataResultBase = Readonly<{
  axes?: readonly RecordedDataResultAxis[]
}>
export type RecordedDataResult = RecordedDataResultBase & Readonly<
  | ({
    dtype: FloatDataDType
  } & (
    QuantityMetadata<ScalarQuantityKindName>
    | QuantityMetadata<TensorQuantityKindName>
  ))
  | {
    dtype: NonFloatDataDType
    unit?: never
    quantityKind?: never
    basis?: never
  }
>
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
  TInitializationParameters extends ExperimentParameters = ExperimentParameters,
  TBoundaryConditionParameters extends ExperimentParameters = ExperimentParameters,
  TRecordedDataParameters extends ExperimentParameters = ExperimentParameters,
> = Readonly<{
  initializations: readonly ExperimentRule<TInitializationParameters>[]
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
  TInitializationParameters extends ExperimentParameters,
  TBoundaryConditionParameters extends ExperimentParameters,
  TRecordedDataParameters extends ExperimentParameters,
> = StructureOptions & {
  solver: ExperimentSolver
  initializations?: () => readonly ExperimentRule<TInitializationParameters>[]
  boundaryConditions?: () => readonly ExperimentRule<TBoundaryConditionParameters>[]
  recordedData?: () => readonly RecordedDataRule<TRecordedDataParameters>[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))
}

export function Mat(diagonal: number, offDiagonal = 0, size = 3): MatrixValue {
  if (typeof diagonal !== 'number' || !Number.isFinite(diagonal)) {
    throw new CadModelError('Mat diagonal must be a finite number.')
  }
  if (typeof offDiagonal !== 'number' || !Number.isFinite(offDiagonal)) {
    throw new CadModelError('Mat offDiagonal must be a finite number.')
  }
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new CadModelError('Mat size must be a positive safe integer.')
  }

  const matrix = Object.freeze(Array.from({ length: size }, (_, row) => Object.freeze(
    Array.from({ length: size }, (_item, column) => row === column ? diagonal : offDiagonal),
  )))
  return matrix
}

function normalizeRawScalar(value: unknown, path: string): ScalarValue {
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new CadModelError(`${path} must be a finite number.`)
    if (!Number.isSafeInteger(value)) {
      throw new CadModelError(`${path} raw numbers must be safe integers; use a dtype descriptor for float values.`)
    }
    return value
  }
  if (value === null) throw new CadModelError(`${path} must not be null.`)
  if (Array.isArray(value)) {
    throw new CadModelError(`${path} raw arrays are not allowed; use a dtype descriptor with axes.`)
  }
  throw new CadModelError(`${path} must be a raw boolean, string, safe integer, or dtype descriptor.`)
}

function normalizeSolverParameterValue(
  value: unknown,
  path: string,
): SolverParameterValue {
  if (isPlainObject(value)) return normalizeDataValueDescriptor(value, path)
  return normalizeRawScalar(value, path)
}

function normalizeSolverParameters(value: unknown, path: string): SolverParameters {
  if (!isPlainObject(value)) throw new CadModelError(`${path} must be a plain object.`)
  const normalized: Record<string, SolverParameterValue> = {}
  Object.entries(value).forEach(([key, parameter]) => {
    if (!key.trim()) throw new CadModelError(`${path} parameter names must not be empty.`)
    normalized[key] = normalizeSolverParameterValue(parameter, `${path}.${key}`)
  })
  return Object.freeze(normalized)
}

function cloneTensor(value: Tensor): Tensor {
  return Array.isArray(value) ? value.map(cloneTensor) : value
}

function freezeTensor(value: Tensor): Tensor {
  if (!Array.isArray(value)) return value

  value.forEach(freezeTensor)
  return Object.freeze(value)
}

function inferTensorShape(value: unknown, path: string): readonly number[] {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new CadModelError(`${path} must contain only finite numbers.`)
    return Object.freeze([])
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new CadModelError(`${path} must be a finite number or a non-empty rectangular tensor.`)
  }

  const childShape = inferTensorShape(value[0], `${path}[0]`)
  value.slice(1).forEach((item, index) => {
    const itemShape = inferTensorShape(item, `${path}[${index + 1}]`)
    if (itemShape.length !== childShape.length || itemShape.some((size, axis) => size !== childShape[axis])) {
      throw new CadModelError(`${path} must be a rectangular tensor.`)
    }
  })
  return Object.freeze([value.length, ...childShape])
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
  min: Tensor,
  max: Tensor,
  shape: readonly number[],
  path: string,
) {
  if (shape.length === 0) {
    const scalar = value as number
    const minimum = min as number
    const maximum = max as number

    if (minimum > maximum) {
      throw new CadModelError(`${path} has min greater than max.`)
    }

    if (scalar < minimum) {
      throw new CadModelError(`${path} must be greater than or equal to ${minimum}.`)
    }

    if (scalar > maximum) {
      throw new CadModelError(`${path} must be less than or equal to ${maximum}.`)
    }

    return
  }

  ;(value as readonly Tensor[]).forEach((item, index) => {
    validateRange(
      item,
      boundAt(min, index),
      boundAt(max, index),
      shape.slice(1),
      `${path}[${index}]`,
    )
  })
}

function validateBounds(min: Tensor, max: Tensor, shape: readonly number[], path: string) {
  if (shape.length === 0) {
    if ((min as number) > (max as number)) throw new CadModelError(`${path} has min greater than max.`)
    return
  }

  Array.from({ length: shape[0] }, (_, index) => {
    validateBounds(boundAt(min, index), boundAt(max, index), shape.slice(1), `${path}[${index}]`)
  })
}

function normalizeVarsSchema(rawSchema: unknown, objectName: string) {
  if (!isRecord(rawSchema)) {
    throw new CadModelError(`${objectName} varsSchema must be an object.`)
  }

  const schema: Record<string, VarsSchemaEntry> = {}
  const normalized: Record<string, NormalizedVarsSchemaEntry> = {}

  Object.entries(rawSchema).forEach(([key, rawEntry]) => {
    if (!key.trim()) {
      throw new CadModelError('varsSchema keys must not be empty.')
    }

    if (!isRecord(rawEntry)) {
      throw new CadModelError(`varsSchema.${key} must be an object.`)
    }

    const unsupportedKey = Object.keys(rawEntry).find((entryKey) => entryKey !== 'min' && entryKey !== 'max')
    if (unsupportedKey) {
      throw new CadModelError(`varsSchema.${key}.${unsupportedKey} is not supported; define only min and max.`)
    }
    if (rawEntry.min === undefined || rawEntry.max === undefined) {
      throw new CadModelError(`varsSchema.${key} must define both min and max.`)
    }

    const minShape = inferTensorShape(rawEntry.min, `varsSchema.${key}.min`)
    const maxShape = inferTensorShape(rawEntry.max, `varsSchema.${key}.max`)
    const shape = minShape.length === 0 ? maxShape : minShape
    if (minShape.length > 0 && maxShape.length > 0) {
      validateTensor(rawEntry.max, minShape, `varsSchema.${key}.max`)
    }
    validateBound(rawEntry.min, shape, `varsSchema.${key}.min`)
    validateBound(rawEntry.max, shape, `varsSchema.${key}.max`)

    const min = freezeTensor(cloneTensor(rawEntry.min as Tensor))
    const max = freezeTensor(cloneTensor(rawEntry.max as Tensor))
    validateBounds(min, max, shape, `varsSchema.${key}`)

    schema[key] = Object.freeze({ min, max })
    normalized[key] = Object.freeze({ shape, min, max })
  })

  return Object.freeze({
    schema: Object.freeze(schema),
    normalized: Object.freeze(normalized),
  })
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
  schema: NormalizedVarsSchema,
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
    const rawValue = rawVars[key]

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
    if (minimum === maximum) return minimum
    return minimum + random() * (maximum - minimum)
  }

  return Array.from({ length: shape[0] }, (_, index) =>
    randomTensor(shape.slice(1), boundAt(min, index), boundAt(max, index), random),
  )
}

const normalizedVarsSchemas = new WeakMap<object, NormalizedVarsSchema>()

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
      const path = `Material ${symbol} variables.${key}`
      normalizedVariables[key] = isPlainObject(value)
        ? normalizeMaterialDataValueDescriptor(value, path)
        : normalizeRawScalar(value, path)
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

    const varsSchema = normalizeVarsSchema(options.varsSchema, objectName)
    this.geometry = options.geometry
    this.lengthUnit = lengthUnit
    this.varsSchema = varsSchema.schema
    normalizedVarsSchemas.set(this, varsSchema.normalized)
    this.geometryGroup = normalizeStructureGroup(options.geometryGroup, 'geometryGroup', objectName)
    this.surfaceGroup = normalizeStructureGroup(options.surfaceGroup, 'surfaceGroup', objectName)
    if (new.target === Structure) Object.freeze(this)
  }

  randomVars(seed?: number) {
    const random = createRandom(seed)
    const generated: Vars = {}
    const schema = normalizedVarsSchemas.get(this)!

    Object.entries(schema).forEach(([key, entry]) => {
      generated[key] = randomTensor(entry.shape, entry.min, entry.max, random)
    })

    return normalizeVars(schema, generated, this.constructor.name || 'Structure')
  }
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
    Object.freeze(this)
  }
}

export function evaluateExperimentSolver(experiment: Experiment): ResolvedExperimentSolver {
  return Object.freeze({
    name: experiment.solver.name,
    version: experiment.solver.version,
    parameters: normalizeSolverParameters(experiment.solver.parameters(), 'Experiment solver parameters'),
  })
}

const dataDTypes = new Set<DataDType>([
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
const integerDataRanges: Partial<Record<DataDType, readonly [number, number]>> = {
  int8: [-128, 127],
  int16: [-32768, 32767],
  int32: [-2147483648, 2147483647],
  int64: [-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  uint8: [0, 255],
  uint16: [0, 65535],
  uint32: [0, 4294967295],
  uint64: [0, Number.MAX_SAFE_INTEGER],
}

export function isFloatDType(dtype: DataDType) {
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

function assertNoLegacyDataKeys(value: Record<string, unknown>, path: string) {
  const replacements = [
    ['type', 'use dtype'],
    ['shape', 'move every outer dimension to axes with a length'],
    ['dimension', 'omit it; outer dimension is axes.length'],
    ['sampleDimension', 'omit it; outer dimension is axes.length'],
    ['sampleShape', 'move every outer dimension to axes with a length'],
    ['sampleAxes', 'use axes'],
  ] as const
  const legacy = replacements.find(([key]) => Object.prototype.hasOwnProperty.call(value, key))
  if (legacy) {
    throw new CadModelError(`${path}.${legacy[0]} is obsolete in the dtype/axes contract; ${legacy[1]}.`)
  }
}

function normalizeDataAxes(
  value: unknown,
  path: string,
) {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) throw new CadModelError(`${path}.axes must be an array.`)
  if (value.length === 0) {
    throw new CadModelError(`${path}.axes must be omitted for a single value; axes cannot be empty.`)
  }

  return Object.freeze(Array.from(value, (rawAxis, axisIndex) => {
    const axisPath = `${path}.axes[${axisIndex}]`
    if (!isPlainObject(rawAxis)) {
      throw new CadModelError(`${axisPath} must be a plain object.`)
    }
    const axisKeys = ['length', 'name', 'ticks', 'unit', 'quantityKind']
      .filter((key) => Object.prototype.hasOwnProperty.call(rawAxis, key))
    assertDescriptorKeys(rawAxis, axisKeys, axisPath)

    if (!Number.isSafeInteger(rawAxis.length) || (rawAxis.length as number) <= 0) {
      throw new CadModelError(`${axisPath}.length must be a positive safe integer.`)
    }
    const length = rawAxis.length as number

    const name = rawAxis.name === undefined ? `axis ${axisIndex}` : rawAxis.name
    if (typeof name !== 'string' || !name.trim()) {
      throw new CadModelError(`${axisPath}.name must be a non-empty string.`)
    }
    const hasUnit = Object.prototype.hasOwnProperty.call(rawAxis, 'unit')
    const hasQuantityKind = Object.prototype.hasOwnProperty.call(rawAxis, 'quantityKind')
    if (hasUnit !== hasQuantityKind) {
      throw new CadModelError(`${axisPath} must specify both unit and quantityKind or neither.`)
    }
    const metadata = hasUnit ? normalizeQuantityMetadata(rawAxis, axisPath, true) : undefined

    const rawTicks = rawAxis.ticks === undefined
      ? Array.from({ length }, (_, tickIndex) => tickIndex)
      : rawAxis.ticks
    if (!Array.isArray(rawTicks)) {
      throw new CadModelError(`${axisPath}.ticks must be an array.`)
    }
    if (rawTicks.length !== length) {
      throw new CadModelError(
        `${axisPath}.ticks has length ${rawTicks.length}; expected ${length} to match ${axisPath}.length.`,
      )
    }
    const ticks = Object.freeze(Array.from(rawTicks, (tick, tickIndex) => {
      if (typeof tick === 'string' || (typeof tick === 'number' && Number.isFinite(tick))) return tick
      throw new CadModelError(`${axisPath}.ticks[${tickIndex}] must be a string or finite number.`)
    }))

    return Object.freeze({ length, name: name.trim(), ticks, ...metadata })
  }))
}

function normalizeDataSchema(
  value: Record<string, unknown>,
  path: string,
) {
  assertNoLegacyDataKeys(value, path)
  if (typeof value.dtype !== 'string' || !dataDTypes.has(value.dtype as DataDType)) {
    throw new CadModelError(`${path}.dtype must be a supported data dtype.`)
  }
  const dtype = value.dtype as DataDType
  const hasUnit = Object.prototype.hasOwnProperty.call(value, 'unit')
  const hasQuantityKind = Object.prototype.hasOwnProperty.call(value, 'quantityKind')
  const hasBasis = Object.prototype.hasOwnProperty.call(value, 'basis')
  if (isFloatDType(dtype)) {
    if (!hasUnit || !hasQuantityKind) {
      throw new CadModelError(`${path} must specify both unit and quantityKind for a float dtype.`)
    }
  } else if (hasUnit || hasQuantityKind || hasBasis) {
    throw new CadModelError(
      `${path}.unit, ${path}.quantityKind, and ${path}.basis are allowed only for float dtypes.`,
    )
  }
  const metadata = isFloatDType(dtype)
    ? normalizeQuantityMetadata(value, path)
    : undefined
  const componentShape = metadata === undefined
    ? []
    : getQuantityKindComponentShape(metadata.quantityKind)
  const axes = normalizeDataAxes(value.axes, path)
  const outerShape = axes?.map((axis) => axis.length) ?? []
  return {
    ...(axes === undefined ? {} : { axes }),
    dtype,
    storageShape: Object.freeze([...outerShape, ...componentShape]),
    ...metadata,
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

export function normalizeDataElement(
  value: unknown,
  dtype: DataDType,
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

  const range = integerDataRanges[dtype]
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

export function normalizeDataValue(
  value: unknown,
  shape: readonly number[],
  dtype: DataDType,
  path: string,
  rootValue = value,
  rootPath = path,
  depth = 0,
  ancestors = new Set<unknown>(),
): boolean | string | number | readonly unknown[] {
  if (depth === shape.length) {
    if (Array.isArray(value)) throw tensorShapeError(rootPath, rootValue, shape)
    return normalizeDataElement(value, dtype, path)
  }
  if (!Array.isArray(value) || value.length !== shape[depth] || ancestors.has(value)) {
    throw tensorShapeError(rootPath, rootValue, shape)
  }

  ancestors.add(value)
  const normalized = value.map((item, index) => normalizeDataValue(
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

export function normalizeDataValueDescriptor(
  value: unknown,
  path = 'Data value descriptor',
): DataValueDescriptor {
  if (!isPlainObject(value)) {
    throw new CadModelError(`${path} must be a dtype descriptor.`)
  }
  assertNoLegacyDataKeys(value, path)
  const descriptorKeys = ['dtype', 'value']
  if (Object.prototype.hasOwnProperty.call(value, 'axes')) descriptorKeys.push('axes')
  if (Object.prototype.hasOwnProperty.call(value, 'unit')) descriptorKeys.push('unit')
  if (Object.prototype.hasOwnProperty.call(value, 'quantityKind')) descriptorKeys.push('quantityKind')
  if (Object.prototype.hasOwnProperty.call(value, 'basis')) descriptorKeys.push('basis')
  assertDescriptorKeys(value, descriptorKeys, path)
  const { storageShape, ...schema } = normalizeDataSchema(value, path)
  return Object.freeze({
    ...schema,
    value: normalizeDataValue(value.value, storageShape, schema.dtype, `${path}.value`),
  }) as DataValueDescriptor
}

function normalizeMaterialDataValueDescriptor(
  value: Record<string, unknown>,
  path: string,
): MaterialDataValueDescriptor {
  assertNoLegacyDataKeys(value, path)
  const dtype = value.dtype
  if (typeof dtype !== 'string' || !dataDTypes.has(dtype as DataDType)) {
    throw new CadModelError(`${path}.dtype must be a supported data dtype.`)
  }
  const float = isFloatDType(dtype as DataDType)
  const descriptorKeys = ['dtype', 'value']
  if (Object.prototype.hasOwnProperty.call(value, 'axes')) descriptorKeys.push('axes')
  if (Object.prototype.hasOwnProperty.call(value, 'unit')) descriptorKeys.push('unit')
  if (Object.prototype.hasOwnProperty.call(value, 'quantityKind')) descriptorKeys.push('quantityKind')
  if (Object.prototype.hasOwnProperty.call(value, 'basis')) descriptorKeys.push('basis')
  if (Object.prototype.hasOwnProperty.call(value, 'errorRate')) descriptorKeys.push('errorRate')
  assertDescriptorKeys(value, descriptorKeys, path)
  if (float && !Object.prototype.hasOwnProperty.call(value, 'errorRate')) {
    throw new CadModelError(`${path}.errorRate is required for a float Material descriptor.`)
  }
  if (!float && Object.prototype.hasOwnProperty.call(value, 'errorRate')) {
    throw new CadModelError(`${path}.errorRate is allowed only for a float Material descriptor.`)
  }
  if (float && (
    typeof value.errorRate !== 'number'
    || !Number.isFinite(value.errorRate)
    || value.errorRate < 0
    || value.errorRate >= 1
  )) {
    throw new CadModelError(`${path}.errorRate must be a finite number in [0, 1).`)
  }
  const { storageShape, ...schema } = normalizeDataSchema(value, path)
  return Object.freeze({
    ...schema,
    value: normalizeDataValue(value.value, storageShape, schema.dtype, `${path}.value`),
    ...(float ? { errorRate: value.errorRate as number } : {}),
  }) as MaterialDataValueDescriptor
}

function normalizeExperimentParameter(value: unknown, path: string): ExperimentParameter {
  if (isPlainObject(value)) return normalizeDataValueDescriptor(value, path)
  return normalizeRawScalar(value, path)
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

function normalizeRecordedDataResultAxes(value: unknown, path: string) {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) throw new CadModelError(`${path}.axes must be an array.`)
  if (value.length === 0) {
    throw new CadModelError(`${path}.axes must be omitted for a single value; axes cannot be empty.`)
  }

  return Object.freeze(Array.from(value, (rawAxis, axisIndex) => {
    const axisPath = `${path}.axes[${axisIndex}]`
    if (!isPlainObject(rawAxis)) throw new CadModelError(`${axisPath} must be a plain object.`)
    const keys = ['length', 'name', 'ticks', 'unit', 'quantityKind']
      .filter((key) => Object.prototype.hasOwnProperty.call(rawAxis, key))
    assertDescriptorKeys(rawAxis, keys, axisPath)
    const name = rawAxis.name === undefined ? `axis ${axisIndex}` : rawAxis.name
    if (typeof name !== 'string' || !name.trim()) {
      throw new CadModelError(`${axisPath}.name must be a non-empty string.`)
    }
    const hasUnit = Object.prototype.hasOwnProperty.call(rawAxis, 'unit')
    const hasQuantityKind = Object.prototype.hasOwnProperty.call(rawAxis, 'quantityKind')
    if (hasUnit !== hasQuantityKind) {
      throw new CadModelError(`${axisPath} must specify both unit and quantityKind or neither.`)
    }
    const metadata = hasUnit ? normalizeQuantityMetadata(rawAxis, axisPath, true) : undefined
    if (rawAxis.length === undefined) {
      if (Object.prototype.hasOwnProperty.call(rawAxis, 'ticks')) {
        throw new CadModelError(`${axisPath}.ticks must be omitted when ${axisPath}.length is dynamic.`)
      }
      return Object.freeze({ name: name.trim(), ...metadata })
    }
    if (!Number.isSafeInteger(rawAxis.length) || (rawAxis.length as number) <= 0) {
      throw new CadModelError(`${axisPath}.length must be a positive safe integer when specified.`)
    }
    const length = rawAxis.length as number
    const rawTicks = rawAxis.ticks ?? Array.from({ length }, (_, index) => index)
    if (!Array.isArray(rawTicks)) throw new CadModelError(`${axisPath}.ticks must be an array.`)
    if (rawTicks.length !== length) {
      throw new CadModelError(`${axisPath}.ticks has length ${rawTicks.length}; expected ${length} to match ${axisPath}.length.`)
    }
    const ticks = Object.freeze(Array.from(rawTicks, (tick, tickIndex) => {
      if (typeof tick === 'string' || (typeof tick === 'number' && Number.isFinite(tick))) return tick
      throw new CadModelError(`${axisPath}.ticks[${tickIndex}] must be a string or finite number.`)
    }))
    return Object.freeze({ length, name: name.trim(), ticks, ...metadata })
  }))
}

function normalizeRecordedDataResult(value: unknown, path: string): RecordedDataResult {
  if (!isPlainObject(value)) throw new CadModelError(`${path} must be a dtype result descriptor.`)
  assertNoLegacyDataKeys(value, path)
  const descriptorKeys = ['dtype']
  if (Object.prototype.hasOwnProperty.call(value, 'axes')) descriptorKeys.push('axes')
  if (Object.prototype.hasOwnProperty.call(value, 'unit')) descriptorKeys.push('unit')
  if (Object.prototype.hasOwnProperty.call(value, 'quantityKind')) descriptorKeys.push('quantityKind')
  if (Object.prototype.hasOwnProperty.call(value, 'basis')) descriptorKeys.push('basis')
  assertDescriptorKeys(value, descriptorKeys, path)
  if (typeof value.dtype !== 'string' || !dataDTypes.has(value.dtype as DataDType)) {
    throw new CadModelError(`${path}.dtype must be a supported data dtype.`)
  }
  const dtype = value.dtype as DataDType
  const hasUnit = Object.prototype.hasOwnProperty.call(value, 'unit')
  const hasQuantityKind = Object.prototype.hasOwnProperty.call(value, 'quantityKind')
  const hasBasis = Object.prototype.hasOwnProperty.call(value, 'basis')
  if (isFloatDType(dtype)) {
    if (!hasUnit || !hasQuantityKind) {
      throw new CadModelError(`${path} must specify both unit and quantityKind for a float dtype.`)
    }
  } else if (hasUnit || hasQuantityKind || hasBasis) {
    throw new CadModelError(`${path} quantity metadata is allowed only for float dtypes.`)
  }
  const metadata = isFloatDType(dtype) ? normalizeQuantityMetadata(value, path) : undefined
  const axes = normalizeRecordedDataResultAxes(value.axes, path)
  return Object.freeze({
    ...(axes === undefined ? {} : { axes }),
    dtype,
    ...metadata,
  }) as RecordedDataResult
}

function normalizeExperimentTarget(
  rawTarget: unknown,
  propertyName: 'initializations' | 'boundaryConditions' | 'recordedData',
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
  propertyName: 'initializations' | 'boundaryConditions' | 'recordedData',
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
  TInitializationParameters extends ExperimentParameters,
  TBoundaryConditionParameters extends ExperimentParameters,
  TRecordedDataParameters extends ExperimentParameters,
>(
  experiment: Experiment<
    TInitializationParameters,
    TBoundaryConditionParameters,
    TRecordedDataParameters
  >,
): EvaluatedExperimentRules<
  TInitializationParameters,
  TBoundaryConditionParameters,
  TRecordedDataParameters
> {
  return Object.freeze({
    initializations: normalizeExperimentRuleList<TInitializationParameters>(
      experiment.initializations(),
      'initializations',
      experiment,
    ) as readonly ExperimentRule<TInitializationParameters>[],
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

const materialRandomSeeds = new WeakMap<Readonly<Vars>, number>()

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
    if (!isRecord(partialVars)) throw new CadModelError(`${variableObjectName} vars must be an object.`)
    const extraKey = Object.keys(partialVars).find((key) => !(key in object.varsSchema))
    if (extraKey) throw new CadModelError(`Unknown ${variableObjectName} var: ${extraKey}.`)
    const generated = { ...object.randomVars() }
    Object.entries(partialVars).forEach(([key, value]) => {
      if (value !== undefined) generated[key] = value as Tensor
    })
    this.vars = normalizeVars(normalizedVarsSchemas.get(object)!, generated, variableObjectName)
    materialRandomSeeds.set(this.vars, Math.floor(Math.random() * 0x1_0000_0000))
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
  TInitializationParameters extends ExperimentParameters = ExperimentParameters,
  TBoundaryConditionParameters extends ExperimentParameters = ExperimentParameters,
  TRecordedDataParameters extends ExperimentParameters = ExperimentParameters,
> extends VariableObject<Experiment<
    TInitializationParameters,
    TBoundaryConditionParameters,
    TRecordedDataParameters
  >> {
  get experiment() {
    return this.object
  }

  constructor(
    experiment: Experiment<
      TInitializationParameters,
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
let activeMaterialRandom: (() => number) | null = null

function applyMaterialErrorMultiplier(
  value: number | readonly unknown[],
  dtype: FloatDataDType,
  multiplier: number,
  path: string,
): number | readonly unknown[] {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item, index) => applyMaterialErrorMultiplier(
      item as number | readonly unknown[],
      dtype,
      multiplier,
      `${path}[${index}]`,
    )))
  }

  return normalizeDataElement((value as number) * multiplier, dtype, path) as number
}

export function resolveMaterialVariables(material: Material): ResolvedMaterialVariables {
  const resolved: Record<string, ScalarValue | DataValueDescriptor> = {}

  Object.entries(material.variables).forEach(([key, value]) => {
    const path = `Material ${material.symbol} variables.${key}`
    if (isPlainObject(value)
      && typeof value.dtype === 'string'
      && isFloatDType(value.dtype as DataDType)
      && Object.prototype.hasOwnProperty.call(value, 'errorRate')) {
      const parameter = value as MaterialDataValueDescriptor & {
        dtype: FloatDataDType
        errorRate: number
      }
      const multiplier = activeMaterialRandom === null || parameter.errorRate === 0
        ? 1
        : 1 - parameter.errorRate + 2 * parameter.errorRate * activeMaterialRandom()
      resolved[key] = Object.freeze({
        dtype: parameter.dtype,
        ...(parameter.axes === undefined ? {} : { axes: parameter.axes }),
        unit: parameter.unit,
        quantityKind: parameter.quantityKind,
        ...(parameter.basis === undefined ? {} : { basis: parameter.basis }),
        value: applyMaterialErrorMultiplier(
          parameter.value as number | readonly unknown[],
          parameter.dtype,
          multiplier,
          `${path}.value`,
        ),
      }) as DataValueDescriptor
      return
    }

    resolved[key] = value
  })

  return Object.freeze(resolved)
}

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
  const previousMaterialRandom = activeMaterialRandom
  activeVars = sampleVars
  const materialSeed = materialRandomSeeds.get(sampleVars)
  activeMaterialRandom = materialSeed === undefined ? null : createRandom(materialSeed)

  try {
    return evaluate()
  } finally {
    activeVars = previousVars
    activeMaterialRandom = previousMaterialRandom
  }
}


