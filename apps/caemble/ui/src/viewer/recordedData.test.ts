import { describe, expect, it } from 'vitest'
import type { ExperimentTensorAxis, RecordedDataRule } from '../cad'
import {
  normalizeCadViewerRecordedTensor,
  resolveCadViewerRecordedData,
} from './recordedData'

function createRule(
  label: string,
  shape: readonly number[],
  dtype: RecordedDataRule['result']['dtype'] = 'float32',
  axes: readonly ExperimentTensorAxis[] = shape.map((size, index) => ({
    name: `axis ${index}`,
    ...(size === -1 ? {} : { ticks: Array.from({ length: size }, (_, tick) => tick) }),
  })),
): RecordedDataRule {
  return {
    target: ['experiment.geometry.domain'],
    label,
    methodId: 'field.record',
    parameters: {},
    result: {
      type: 'tensor',
      dimension: shape.length,
      shape,
      dtype,
      axes,
      ...(dtype.startsWith('float')
        ? { unit: '{fraction}', quantityKind: 'DimensionlessRatio' }
        : {}),
    } as RecordedDataRule['result'],
  }
}

describe('CadViewer recordedData normalization', () => {
  it('normalizes fixed tensors against the Experiment schema and freezes copies', () => {
    const source = [[1, 2, 3], [4, 5, 6]]
    const rule = createRule('Layer field', [2, 3], 'float32', [
      { name: 'layer', ticks: ['lower', 'upper'] },
      { name: 'position', ticks: [0, 0.5, 1] },
    ])
    const tensor = normalizeCadViewerRecordedTensor(rule, { value: source })

    expect(tensor).toEqual({
      value: source,
      shape: [2, 3],
      dtype: 'float32',
      axes: [
        { name: 'layer', ticks: ['lower', 'upper'] },
        { name: 'position', ticks: [0, 0.5, 1] },
      ],
    })
    expect(Object.isFrozen(tensor)).toBe(true)
    expect(Object.isFrozen(tensor.value)).toBe(true)
    expect(Object.isFrozen(tensor.axes)).toBe(true)
    expect(Object.isFrozen(tensor.axes[0].ticks)).toBe(true)
    source[0][0] = 99
    expect((tensor.value as readonly (readonly number[])[])[0][0]).toBe(1)
  })

  it('resolves multiple wildcard axes, empty tensors, and result-provided ticks', () => {
    const rule = createRule('Dynamic field', [-1, -1], 'float64', [
      { name: 'time' },
      { name: 'position' },
    ])
    const tensor = normalizeCadViewerRecordedTensor(rule, {
      value: [[1, 2], [3, 4], [5, 6]],
      axes: [
        { ticks: ['t0', 't1', 't2'] },
        { ticks: [10, 20] },
      ],
    })
    const empty = normalizeCadViewerRecordedTensor(rule, { value: [] })

    expect(tensor.shape).toEqual([3, 2])
    expect(tensor.axes).toEqual([
      { name: 'time', ticks: ['t0', 't1', 't2'] },
      { name: 'position', ticks: [10, 20] },
    ])
    expect(empty.shape).toEqual([0, 0])
    expect(empty.axes).toEqual([
      { name: 'time', ticks: [] },
      { name: 'position', ticks: [] },
    ])
  })

  it('uses 0-based wildcard ticks and validates fixed and dynamic payload axes', () => {
    const dynamic = createRule('Dynamic profile', [-1])
    expect(normalizeCadViewerRecordedTensor(dynamic, { value: [1, 2, 3] }).axes[0].ticks).toEqual([0, 1, 2])
    expect(() => normalizeCadViewerRecordedTensor(dynamic, {
      value: [1, 2, 3],
      axes: [{ ticks: ['a', 'b'] }],
    })).toThrow('ticks has length 2; expected 3')

    const fixed = createRule('Fixed profile', [2], 'float32', [{ name: 'x', ticks: ['a', 'b'] }])
    expect(normalizeCadViewerRecordedTensor(fixed, {
      value: [1, 2],
      axes: [{ ticks: ['a', 'b'] }],
    }).axes[0].ticks).toEqual(['a', 'b'])
    expect(() => normalizeCadViewerRecordedTensor(fixed, {
      value: [1, 2],
      axes: [{ ticks: ['b', 'a'] }],
    })).toThrow('does not match Experiment schema ticks')
    expect(() => normalizeCadViewerRecordedTensor(fixed, {
      value: [1, 2],
      axes: [{ name: 'x' }],
    })).toThrow('may contain only ticks')
  })

  it('reports actual and expected shapes, ragged values, dtype errors, and invalid envelopes', () => {
    const rule = createRule('Profile', [-1, 2], 'int16')

    expect(() => normalizeCadViewerRecordedTensor(rule, { value: [[1, 2], [3]] })).toThrow(
      'actual shape [2, ragged [2] | [1]]; expected shape [-1,2]',
    )
    expect(() => normalizeCadViewerRecordedTensor(rule, { value: [[1, 40000]] })).toThrow(
      'must be a int16 safe integer',
    )
    expect(() => normalizeCadViewerRecordedTensor(rule, [[1, 2]])).toThrow(
      'must be a plain object containing value',
    )
    expect(() => normalizeCadViewerRecordedTensor(rule, { value: [[1, 2]], shape: [1, 2] })).toThrow(
      'must contain value and optional axes only',
    )
  })

  it('keeps missing rules empty and isolates unknown labels and per-rule errors', () => {
    const scalar = createRule('Average', [], 'float64', [])
    const profile = createRule('Profile', [2])
    const resolved = resolveCadViewerRecordedData([scalar, profile], {
      Average: { value: 0.5 },
      Profile: { value: [1] },
      Extra: { value: 1 },
    })

    expect(resolved.unknownLabels).toEqual(['Extra'])
    expect(resolved.entries[0].tensor?.value).toBe(0.5)
    expect(resolved.entries[1].tensor).toBeNull()
    expect(resolved.entries[1].error).toContain('actual shape [1]; expected shape [2]')

    const missing = resolveCadViewerRecordedData([scalar, profile], undefined)
    expect(missing.entries.every((entry) => entry.tensor === null && entry.error === null)).toBe(true)
    expect(resolveCadViewerRecordedData([scalar], []).error).toBe(
      'recordedData must be a plain object keyed by recorded rule label.',
    )
  })
})
