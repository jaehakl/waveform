import {
  CadModelError,
  normalizeExperimentTensorElement,
  type ExperimentTensorDType,
  type RecordedData,
  type RecordedDataRule,
  type RecordedDataTensor,
} from './core'

export type ResolvedRecordedTensor = Readonly<{
  value: boolean | string | number | readonly unknown[]
  shape: readonly number[]
  dtype: ExperimentTensorDType
  axes: readonly Readonly<{
    name: string
    ticks: readonly (number | string)[]
  }>[]
}>

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value))
}

function describeTensorShape(value: unknown, ancestors = new Set<unknown>()): string {
  if (!Array.isArray(value)) return '[]'
  if (ancestors.has(value)) return '[circular]'
  if (value.length === 0) return '[0]'

  ancestors.add(value)
  const childShapes = value.map((item) => describeTensorShape(item, ancestors))
  ancestors.delete(value)
  const uniqueShapes = [...new Set(childShapes)]
  if (uniqueShapes.length !== 1) return `[${value.length}, ragged ${uniqueShapes.join(' | ')}]`
  const child = uniqueShapes[0]
  return child === '[]' ? `[${value.length}]` : `[${value.length}, ${child.slice(1, -1)}]`
}

function recordedShapeError(path: string, value: unknown, expectedShape: readonly number[]) {
  return new CadModelError(
    `${path} has actual shape ${describeTensorShape(value)}; expected shape ${JSON.stringify(expectedShape)}.`,
  )
}

function resolveActualShape(
  value: unknown,
  expectedShape: readonly number[],
  path: string,
  rootValue = value,
  depth = 0,
  ancestors = new Set<unknown>(),
): readonly number[] {
  if (depth === expectedShape.length) {
    if (Array.isArray(value)) throw recordedShapeError(path, rootValue, expectedShape)
    return Object.freeze([])
  }
  if (!Array.isArray(value) || ancestors.has(value)) {
    throw recordedShapeError(path, rootValue, expectedShape)
  }

  const expectedSize = expectedShape[depth]
  if (expectedSize !== -1 && value.length !== expectedSize) {
    throw recordedShapeError(path, rootValue, expectedShape)
  }
  if (value.length === 0) {
    return Object.freeze([
      0,
      ...expectedShape.slice(depth + 1).map((size) => size === -1 ? 0 : size),
    ])
  }

  ancestors.add(value)
  const childShapes = value.map((item) => resolveActualShape(
    item,
    expectedShape,
    path,
    rootValue,
    depth + 1,
    ancestors,
  ))
  ancestors.delete(value)
  const firstShape = childShapes[0]
  if (childShapes.some((shape) => JSON.stringify(shape) !== JSON.stringify(firstShape))) {
    throw recordedShapeError(path, rootValue, expectedShape)
  }
  return Object.freeze([value.length, ...firstShape])
}

function normalizeRecordedValue(
  value: unknown,
  shape: readonly number[],
  dtype: ExperimentTensorDType,
  path: string,
  depth = 0,
): boolean | string | number | readonly unknown[] {
  if (depth === shape.length) return normalizeExperimentTensorElement(value, dtype, path)
  const values = value as readonly unknown[]
  return Object.freeze(values.map((item, index) => normalizeRecordedValue(
    item,
    shape,
    dtype,
    `${path}[${index}]`,
    depth + 1,
  )))
}

function normalizePayloadAxes(
  value: unknown,
  rule: RecordedDataRule,
  actualShape: readonly number[],
  path: string,
) {
  if (value !== undefined && !Array.isArray(value)) {
    throw new CadModelError(`${path}.axes must be an array.`)
  }
  const rawAxes = value ?? Array.from({ length: rule.result.dimension }, () => ({}))
  if ((rawAxes as readonly unknown[]).length !== rule.result.dimension) {
    throw new CadModelError(
      `${path}.axes has length ${(rawAxes as readonly unknown[]).length}; expected ${rule.result.dimension}.`,
    )
  }

  return Object.freeze(Array.from(rawAxes as readonly unknown[], (rawAxis, axisIndex) => {
    const axisPath = `${path}.axes[${axisIndex}]`
    if (!isPlainObject(rawAxis)) throw new CadModelError(`${axisPath} must be a plain object.`)
    const keys = Reflect.ownKeys(rawAxis)
    if (keys.some((key) => key !== 'ticks')) {
      throw new CadModelError(`${axisPath} may contain only ticks.`)
    }

    const schemaAxis = rule.result.axes?.[axisIndex]
    const schemaTicks = schemaAxis?.ticks
      ?? (rule.result.shape[axisIndex] === -1
        ? undefined
        : Array.from({ length: actualShape[axisIndex] }, (_, index) => index))
    const rawTicks = rawAxis.ticks ?? schemaTicks
      ?? Array.from({ length: actualShape[axisIndex] }, (_, index) => index)
    if (!Array.isArray(rawTicks)) throw new CadModelError(`${axisPath}.ticks must be an array.`)
    if (rawTicks.length !== actualShape[axisIndex]) {
      throw new CadModelError(
        `${axisPath}.ticks has length ${rawTicks.length}; expected ${actualShape[axisIndex]} for actual shape[${axisIndex}].`,
      )
    }
    const ticks = Object.freeze(Array.from(rawTicks, (tick, tickIndex) => {
      if (typeof tick === 'string' || (typeof tick === 'number' && Number.isFinite(tick))) return tick
      throw new CadModelError(`${axisPath}.ticks[${tickIndex}] must be a string or finite number.`)
    }))
    if (
      rule.result.shape[axisIndex] !== -1
      && rawAxis.ticks !== undefined
      && JSON.stringify(ticks) !== JSON.stringify(schemaTicks)
    ) {
      throw new CadModelError(
        `${axisPath}.ticks ${JSON.stringify(ticks)} does not match Experiment schema ticks ${JSON.stringify(schemaTicks)}.`,
      )
    }

    return Object.freeze({
      name: schemaAxis?.name ?? `axis ${axisIndex}`,
      ticks,
    })
  }))
}

export function normalizeRecordedDataTensor(
  rule: RecordedDataRule,
  value: unknown,
): ResolvedRecordedTensor {
  const path = `recordedData[${JSON.stringify(rule.label)}]`
  if (!isPlainObject(value)) throw new CadModelError(`${path} must be a plain object containing value.`)
  const keys = Reflect.ownKeys(value)
  if (
    !Object.prototype.hasOwnProperty.call(value, 'value')
    || keys.some((key) => key !== 'value' && key !== 'axes')
  ) {
    throw new CadModelError(`${path} must contain value and optional axes only.`)
  }

  const actualShape = resolveActualShape(value.value, rule.result.shape, `${path}.value`)
  return Object.freeze({
    axes: normalizePayloadAxes(value.axes, rule, actualShape, path),
    dtype: rule.result.dtype,
    shape: actualShape,
    value: normalizeRecordedValue(value.value, actualShape, rule.result.dtype, `${path}.value`),
  })
}

export function normalizeRecordedData(
  rules: readonly RecordedDataRule[],
  value: unknown,
): RecordedData {
  if (!isPlainObject(value)) {
    throw new CadModelError('recordedData must be a plain object keyed by recorded rule label.')
  }

  const labels = new Set(rules.map((rule) => rule.label))
  const unknownLabels = Reflect.ownKeys(value).filter((label) => typeof label !== 'string' || !labels.has(label))
  if (unknownLabels.length > 0) {
    throw new CadModelError(`recordedData contains unknown labels: ${unknownLabels.map(String).join(', ')}.`)
  }
  const missingLabels = rules.filter((rule) => !Object.prototype.hasOwnProperty.call(value, rule.label))
  if (missingLabels.length > 0) {
    throw new CadModelError(`recordedData is missing labels: ${missingLabels.map((rule) => rule.label).join(', ')}.`)
  }

  const normalized: Record<string, RecordedDataTensor> = {}
  rules.forEach((rule) => {
    const tensor = normalizeRecordedDataTensor(rule, value[rule.label])
    normalized[rule.label] = Object.freeze({
      value: tensor.value,
      axes: Object.freeze(tensor.axes.map((axis) => Object.freeze({ ticks: axis.ticks }))),
    })
  })
  return Object.freeze(normalized)
}
