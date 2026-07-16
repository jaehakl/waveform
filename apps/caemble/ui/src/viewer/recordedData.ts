import type {
  RecordedData,
  RecordedDataAxis,
  RecordedDataRule,
  RecordedDataTensor,
} from '../cad/model/core'
import {
  normalizeRecordedDataTensor,
  type ResolvedRecordedTensor,
} from '../cad/model/recordedData'

export type CadViewerRecordedAxis = RecordedDataAxis
export type CadViewerRecordedTensor = RecordedDataTensor
export type CadViewerRecordedData = RecordedData
export type { ResolvedRecordedTensor }

export type ResolvedRecordedData = Readonly<{
  entries: readonly Readonly<{
    rule: RecordedDataRule
    tensor: ResolvedRecordedTensor | null
    error: string | null
  }>[]
  error: string | null
  unknownLabels: readonly string[]
}>

export const normalizeCadViewerRecordedTensor = normalizeRecordedDataTensor

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value))
}

export function resolveCadViewerRecordedData(
  rules: readonly RecordedDataRule[],
  value: unknown,
): ResolvedRecordedData {
  if (value !== null && value !== undefined && !isPlainObject(value)) {
    return Object.freeze({
      entries: Object.freeze(rules.map((rule) => Object.freeze({ rule, tensor: null, error: null }))),
      error: 'recordedData must be a plain object keyed by recorded rule label.',
      unknownLabels: Object.freeze([]),
    })
  }

  const data = value ?? {}
  const labels = new Set(rules.map((rule) => rule.label))
  const unknownLabels = Object.freeze(Object.keys(data).filter((label) => !labels.has(label)))
  const entries = Object.freeze(rules.map((rule) => {
    if (!Object.prototype.hasOwnProperty.call(data, rule.label)) {
      return Object.freeze({ rule, tensor: null, error: null })
    }
    try {
      return Object.freeze({
        rule,
        tensor: normalizeRecordedDataTensor(rule, data[rule.label]),
        error: null,
      })
    } catch (error) {
      return Object.freeze({
        rule,
        tensor: null,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }))

  return Object.freeze({ entries, error: null, unknownLabels })
}

export function isNumericRecordedDType(dtype: RecordedDataRule['result']['dtype']) {
  return dtype !== 'bool' && dtype !== 'string'
}
