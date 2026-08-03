import type { SimulationProgramManifestV3, SimulationResultV3 } from './types'
import { normalizeQuantityMetadata } from '../quantitykind/runtime'

const dataDTypes = new Set([
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function assertSimulationProgramManifestV3(value: unknown): asserts value is SimulationProgramManifestV3 {
  if (!isPlainObject(value) || value.version !== 3 || !isPlainObject(value.tasks) || !isPlainObject(value.outputs)) {
    throw new Error('Simulation Program manifest is invalid.')
  }
  Object.entries(value.tasks).forEach(([taskName, identity]) => {
    if (
      !taskName.trim()
      || !isPlainObject(identity)
      || typeof identity.name !== 'string'
      || !identity.name.trim()
      || typeof identity.version !== 'string'
      || !identity.version.trim()
    ) {
      throw new Error(`Simulation Program task "${taskName}" is invalid.`)
    }
  })
  Object.entries(value.outputs).forEach(([name, spec]) => {
    const path = `Simulation Program output "${name}"`
    if (!name.trim() || !isPlainObject(spec) || typeof spec.dtype !== 'string' || !dataDTypes.has(spec.dtype)) {
      throw new Error(`${path} must declare a supported dtype.`)
    }
    const floatDType = spec.dtype.startsWith('float')
    const hasUnit = Object.prototype.hasOwnProperty.call(spec, 'unit')
    const hasQuantityKind = Object.prototype.hasOwnProperty.call(spec, 'quantityKind')
    const hasBasis = Object.prototype.hasOwnProperty.call(spec, 'basis')
    if (floatDType) {
      normalizeQuantityMetadata(spec, path)
    } else if (hasUnit || hasQuantityKind || hasBasis) {
      throw new Error(`${path} quantity metadata is allowed only for float dtypes.`)
    }
    if (spec.axes !== undefined) {
      if (!Array.isArray(spec.axes)) throw new Error(`${path}.axes must be an array.`)
      spec.axes.forEach((axis, index) => {
        const axisPath = `${path}.axes[${index}]`
        if (!isPlainObject(axis)) throw new Error(`${axisPath} must be an object.`)
        if (axis.length !== undefined && (!Number.isSafeInteger(axis.length) || (axis.length as number) <= 0)) {
          throw new Error(`${axisPath}.length must be a positive safe integer.`)
        }
        if (axis.ticks !== undefined) {
          if (
            !Array.isArray(axis.ticks)
            || axis.ticks.some((tick) => typeof tick !== 'string' && (
              typeof tick !== 'number' || !Number.isFinite(tick)
            ))
          ) {
            throw new Error(`${axisPath}.ticks must contain only finite numbers or strings.`)
          }
          if (axis.length !== undefined && axis.ticks.length !== axis.length) {
            throw new Error(`${axisPath}.ticks must match the declared axis length.`)
          }
        }
        const axisHasUnit = Object.prototype.hasOwnProperty.call(axis, 'unit')
        const axisHasQuantityKind = Object.prototype.hasOwnProperty.call(axis, 'quantityKind')
        if (axisHasUnit !== axisHasQuantityKind) {
          throw new Error(`${axisPath} must specify unit and quantityKind together.`)
        }
        if (axisHasUnit) normalizeQuantityMetadata(axis, axisPath, true)
      })
    }
    if (spec.seriesAxis !== undefined) {
      if (!isPlainObject(spec.seriesAxis)) throw new Error(`${path}.seriesAxis must be an object.`)
      normalizeQuantityMetadata(spec.seriesAxis, `${path}.seriesAxis`, true)
    }
  })
}

export function assertSimulationResultV3(value: unknown): asserts value is SimulationResultV3 {
  if (
    !isPlainObject(value)
    || value.format !== 'caemble-run'
    || value.version !== 3
    || value.status !== 'succeeded'
    || typeof value.runId !== 'string'
    || !value.runId
    || !isPlainObject(value.finalState)
    || !Number.isSafeInteger(value.finalState.revision)
    || !Number.isSafeInteger(value.finalState.bodyCount)
    || !isPlainObject(value.outputs)
    || !Array.isArray(value.trace)
    || !isPlainObject(value.provenance)
  ) {
    throw new Error('Simulation result envelope is invalid.')
  }
  Object.entries(value.outputs).forEach(([name, series]) => {
    if (!name.trim() || !isPlainObject(series) || !isPlainObject(series.spec) || !Array.isArray(series.samples)) {
      throw new Error(`Simulation output series "${name}" is invalid.`)
    }
  })
  value.trace.forEach((entry, index) => {
    if (
      !isPlainObject(entry)
      || entry.sequence !== index + 1
      || typeof entry.task !== 'string'
      || !isPlainObject(entry.kernel)
      || (entry.status !== 'succeeded' && entry.status !== 'failed' && entry.status !== 'fallback')
    ) {
      throw new Error(`Simulation trace entry ${index} is invalid.`)
    }
  })
}
