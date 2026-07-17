import type {
  QuantityKindName,
  RecordedData,
  RecordedDataAxis,
  RecordedDataRule,
  RecordedDataTensor,
  UcumUnit,
} from '../cad/model/core'
import { convertUcumValue } from '../cad/model/units'
import {
  normalizeRecordedDataTensor,
  type ResolvedRecordedTensor,
} from '../cad/model/recordedData'
import { QuantityKind } from '../quantitykind'

export type CadViewerRecordedAxis = RecordedDataAxis
export type CadViewerRecordedTensor = RecordedDataTensor
export type CadViewerRecordedData = RecordedData
export type { ResolvedRecordedTensor }

export type RecordedDataDisplayUnits = Readonly<Record<string, Readonly<{
  axes?: Readonly<Record<number, UcumUnit>>
  result?: UcumUnit
}>>>

export type RecordedDataDisplayUnitTarget = 'result' | number

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

export function recordedDisplayUnitOptions(
  quantityKind: QuantityKindName,
  sourceUnit: UcumUnit,
): readonly UcumUnit[] {
  const units = QuantityKind[quantityKind].applicableUnits() as readonly UcumUnit[]
  return Object.freeze([sourceUnit, ...units.filter((unit) => unit !== sourceUnit)].filter((unit) => {
    try {
      convertUcumValue(1, sourceUnit, unit, `${quantityKind} display unit`)
      return true
    } catch {
      return false
    }
  }))
}

export function convertRecordedNumericValue(
  value: ResolvedRecordedTensor['value'],
  sourceUnit: UcumUnit,
  displayUnit: UcumUnit,
): ResolvedRecordedTensor['value'] {
  if (sourceUnit === displayUnit) return value
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => convertRecordedNumericValue(
      item as ResolvedRecordedTensor['value'],
      sourceUnit,
      displayUnit,
    )))
  }
  if (typeof value !== 'number') throw new Error('Recorded value unit conversion requires numeric tensor values.')
  return convertUcumValue(value, sourceUnit, displayUnit, 'Recorded value display unit')
}

export function convertRecordedNumericTicks(
  ticks: readonly number[],
  sourceUnit: UcumUnit,
  displayUnit: UcumUnit,
): readonly number[] {
  if (sourceUnit === displayUnit) return ticks
  return Object.freeze(ticks.map((tick) => convertUcumValue(
    tick,
    sourceUnit,
    displayUnit,
    'Recorded axis display unit',
  )))
}
