import { describe, expect, it } from 'vitest'
import {
  inspectExperimentTensorSource,
  updateExperimentTensorSource,
} from './experimentParameters'

describe('Experiment tensor parameter source editing', () => {
  it('updates an inline tensor array without changing its descriptor schema', () => {
    const source = `import { Experiment, Setup } from '@caemble/core'
const experiment = new Experiment({
  initialConditions: () => [{
    target: ['structure.geometry.sample'],
    label: 'Inline',
    methodId: 'field.inline',
    parameters: {
      profile: {
        type: 'tensor',
        dimension: 2,
        shape: [1, 2],
        dtype: 'float32',
        value: [[1, 2]] as const,
      },
    },
  }],
})
export default new Setup(experiment)
`

    const info = inspectExperimentTensorSource(source, 'initialConditions', 0, 'profile')
    const update = updateExperimentTensorSource(source, 'initialConditions', 0, 'profile', [[3, 4]])

    expect(info).toEqual({ editable: true, shared: false })
    expect(update.source).toMatch(/value: \[\n\s+\[\n\s+3,\n\s+4\n\s+]\n\s+] as const/)
    expect(update.source).toContain('shape: [1, 2]')
    expect(update.source).toContain("dtype: 'float32'")
  })

  it('updates a top-level const array and reports when the binding is shared', () => {
    const source = `import { Experiment, Setup } from '@caemble/core'
const sharedData = [1, 2] as const
const experiment = new Experiment({
  initialConditions: () => [{
    target: ['structure.geometry.sample'], label: 'Initial', methodId: 'initial',
    parameters: { profile: { type: 'tensor', dimension: 1, shape: [2], dtype: 'int16', value: sharedData } },
  }],
  boundaryConditions: () => [{
    target: ['structure.geometry.sample'], label: 'Boundary', methodId: 'boundary',
    parameters: { profile: { type: 'tensor', dimension: 1, shape: [2], dtype: 'int16', value: sharedData } },
  }],
})
export default new Setup(experiment)
`

    const info = inspectExperimentTensorSource(source, 'initialConditions', 0, 'profile')
    const update = updateExperimentTensorSource(source, 'initialConditions', 0, 'profile', [7, 8])

    expect(info).toEqual({ editable: true, bindingName: 'sharedData', shared: true })
    expect(update.shared).toBe(true)
    expect(update.source).toMatch(/const sharedData = \[\n\s+7,\n\s+8\n\s+] as const/)
    expect(update.source.match(/value: sharedData/g)).toHaveLength(2)
  })

  it('preserves CRLF and UTF-8 Korean text while replacing a const array', () => {
    const source = `import { Experiment, Setup } from '@caemble/core'
const profile = ['초기값', '경계값'] as const
const experiment = new Experiment({
  recordedData: () => [{
    target: ['structure.geometry.sample'],
    label: '한국어 기록',
    methodId: 'record.text',
    parameters: { names: { type: 'tensor', dimension: 1, shape: [2], dtype: 'string', value: profile } },
    result: { type: 'tensor', dimension: 0, shape: [], dtype: 'float64' },
  }],
})
export default new Setup(experiment)
`.replace(/\n/g, '\r\n')

    const update = updateExperimentTensorSource(source, 'recordedData', 0, 'names', ['수정', '완료'])

    expect(update.source).toContain('한국어 기록')
    expect(update.source).toContain('"수정"')
    expect(update.source).toContain('"완료"')
    expect(update.source.replace(/\r\n/g, '')).not.toContain('\n')
  })

  it('marks computed and vars-backed tensor values read-only', () => {
    const source = `import { Experiment, Setup } from '@caemble/core'
const experiment = new Experiment({
  initialConditions: () => [
    {
      target: ['structure.geometry.sample'], label: 'Computed', methodId: 'computed',
      parameters: { profile: { type: 'tensor', dimension: 1, shape: [2], dtype: 'float64', value: makeData() } },
    },
    {
      target: ['structure.geometry.sample'], label: 'Vars', methodId: 'vars',
      parameters: { profile: { type: 'tensor', dimension: 1, shape: [2], dtype: 'float64', value: vars.profile } },
    },
  ],
})
export default new Setup(experiment)
`

    const computed = inspectExperimentTensorSource(source, 'initialConditions', 0, 'profile')
    const vars = inspectExperimentTensorSource(source, 'initialConditions', 1, 'profile')

    expect(computed.editable).toBe(false)
    expect(computed.reason).toContain('inline array or a top-level const array')
    expect(vars.editable).toBe(false)
    expect(vars.reason).toContain('inline array or a top-level const array')
    expect(() => updateExperimentTensorSource(
      source,
      'initialConditions',
      0,
      'profile',
      [1, 2],
    )).toThrow('inline array or a top-level const array')
  })
})
