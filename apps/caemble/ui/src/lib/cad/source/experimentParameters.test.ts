import { describe, expect, it } from 'vitest'
import {
  inspectExperimentTensorSource,
  updateExperimentTensorSource,
} from './experimentParameters'

describe('Experiment tensor parameter source editing', () => {
  it('updates an inline tensor array without changing its descriptor schema', () => {
    const source = `import { experiment } from '@caemble/core/v2'
const active = experiment({ lengthUnit: 'mm',
  initializations: () => [{
    target: ['structure.geometry.sample'],
    label: 'Inline',
    methodId: 'field.inline',
    parameters: {
      profile: {
        dtype: 'float32',
        unit: '{fraction}',
        quantityKind: 'DimensionlessRatio',
        axes: [{ length: 1, name: 'batch', ticks: ['sample'] }, { length: 2, name: 'position', ticks: [0, 1] }],
        value: [[1, 2]] as const,
      },
    },
  }],
})
export default active
`

    const info = inspectExperimentTensorSource(source, 'initializations', 0, 'profile')
    const update = updateExperimentTensorSource(source, 'initializations', 0, 'profile', [[3, 4]])

    expect(info).toEqual({ editable: true, shared: false })
    expect(update.source).toMatch(/value: \[\n\s+\[\n\s+3,\n\s+4\n\s+]\n\s+] as const/)
    expect(update.source).not.toContain('shape:')
    expect(update.source).toContain("dtype: 'float32'")
    expect(update.source).toContain("axes: [{ length: 1, name: 'batch', ticks: ['sample'] }, { length: 2, name: 'position', ticks: [0, 1] }]")
  })

  it('updates a top-level const array and reports when the binding is shared', () => {
    const source = `import { experiment } from '@caemble/core/v2'
const sharedData = [1, 2] as const
const active = experiment({ lengthUnit: 'mm',
  initializations: () => [{
    target: ['structure.geometry.sample'], label: 'Initial', methodId: 'initial',
    parameters: {
      profile: { dtype: 'int16', axes: [{ length: 2, name: 'x' }], value: sharedData },
    },
  }],
  boundaryConditions: () => [{
    target: ['structure.geometry.sample'], label: 'Boundary', methodId: 'boundary',
    parameters: {
      profile: { dtype: 'int16', axes: [{ length: 2, name: 'x' }], value: sharedData },
    },
  }],
})
export default active
`

    const info = inspectExperimentTensorSource(source, 'initializations', 0, 'profile')
    const update = updateExperimentTensorSource(source, 'initializations', 0, 'profile', [7, 8])

    expect(info).toEqual({ editable: true, bindingName: 'sharedData', shared: true })
    expect(update.shared).toBe(true)
    expect(update.source).toMatch(/const sharedData = \[\n\s+7,\n\s+8\n\s+] as const/)
    expect(update.source.match(/value: sharedData/g)).toHaveLength(2)
    expect(update.source.match(/axes: \[\{ length: 2, name: 'x' }]/g)).toHaveLength(2)
  })

  it('preserves CRLF and UTF-8 Korean text while replacing a const array', () => {
    const source = `import { experiment } from '@caemble/core/v2'
const profile = ['초기값', '경계값'] as const
const active = experiment({ lengthUnit: 'mm',
  recordedData: () => [{
    target: ['structure.geometry.sample'],
    label: '한국어 기록',
    methodId: 'record.text',
    parameters: {
      names: {
        dtype: 'string',
        axes: [{ length: 2, name: '이름', ticks: ['첫째', '둘째'] }], value: profile,
      },
    },
    result: {
      dtype: 'float64',
      unit: '{fraction}', quantityKind: 'DimensionlessRatio',
    },
  }],
})
export default active
`.replace(/\n/g, '\r\n')

    const update = updateExperimentTensorSource(source, 'recordedData', 0, 'names', ['수정', '완료'])

    expect(update.source).toContain('한국어 기록')
    expect(update.source).toContain("axes: [{ length: 2, name: '이름', ticks: ['첫째', '둘째'] }]")
    expect(update.source).toContain('"수정"')
    expect(update.source).toContain('"완료"')
    expect(update.source.replace(/\r\n/g, '')).not.toContain('\n')
  })

  it('marks computed and vars-backed tensor values read-only', () => {
    const source = `import { experiment } from '@caemble/core/v2'
const active = experiment({ lengthUnit: 'mm',
  initializations: () => [
    {
      target: ['structure.geometry.sample'], label: 'Computed', methodId: 'computed',
      parameters: { profile: {
        dtype: 'float64', axes: [{ length: 2 }],
        unit: '{fraction}', quantityKind: 'DimensionlessRatio', value: makeData(),
      } },
    },
    {
      target: ['structure.geometry.sample'], label: 'Vars', methodId: 'vars',
      parameters: { profile: {
        dtype: 'float64', axes: [{ length: 2 }],
        unit: '{fraction}', quantityKind: 'DimensionlessRatio', value: vars.profile,
      } },
    },
  ],
})
export default active
`

    const computed = inspectExperimentTensorSource(source, 'initializations', 0, 'profile')
    const vars = inspectExperimentTensorSource(source, 'initializations', 1, 'profile')

    expect(computed.editable).toBe(false)
    expect(computed.reason).toContain('inline array or a top-level const array')
    expect(vars.editable).toBe(false)
    expect(vars.reason).toContain('inline array or a top-level const array')
    expect(() => updateExperimentTensorSource(
      source,
      'initializations',
      0,
      'profile',
      [1, 2],
    )).toThrow('inline array or a top-level const array')
  })

  it('marks spread-based experiment options read-only', () => {
    const source = `import { experiment } from '@caemble/core/v2'
const common = {
  lengthUnit: 'mm',
  solver: { name: 'test', version: '1', parameters: () => ({}) },
  geometry: () => null,
  varsSchema: {},
}
export default experiment({
  ...common,
  initializations: () => [],
})
`

    const info = inspectExperimentTensorSource(source, 'initializations', 0, 'profile')
    expect(info.editable).toBe(false)
    expect(info.reason).toContain('spread or computed options')
  })
})
