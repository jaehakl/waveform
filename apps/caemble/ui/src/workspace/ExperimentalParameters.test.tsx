import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { EvaluatedExperimentRules } from '../cad'
import ExperimentalParameters from './ExperimentalParameters'

const rules: EvaluatedExperimentRules = {
  initializations: [{
    target: ['structure.geometry.sample'],
    label: 'Initial profile',
    methodId: 'field.initialize',
    parameters: {
      scalarOnly: 1,
      ratio: {
        type: 'float', value: 0.25, unit: '{fraction}', quantityKind: 'DimensionlessRatio',
      },
      voltage: { type: 'float', value: 1, unit: 'mV', quantityKind: 'Voltage' },
      profile: {
        type: 'tensor',
        dimension: 2,
        shape: [1, 2],
        dtype: 'float32',
        unit: 'V',
        quantityKind: 'Voltage',
        axes: [
          { name: 'batch', ticks: ['sample'] },
          { name: 'position', ticks: [0, 0.5], unit: 'm', quantityKind: 'Length' },
        ],
        value: [[0.1, 0.2]],
      },
    },
  }],
  boundaryConditions: [],
  recordedData: [
    {
      target: ['structure.geometry.sample'],
      label: 'Domain average',
      methodId: 'field.average',
      parameters: { interval: 10 },
      result: {
        type: 'tensor', dimension: 0, shape: [], dtype: 'float64', axes: [],
        unit: '{fraction}', quantityKind: 'DimensionlessRatio',
      },
    },
    {
      target: ['structure.geometry.sample'],
      label: 'Dynamic profile',
      methodId: 'field.profile',
      parameters: { interval: 10 },
      result: {
        type: 'tensor', dimension: 1, shape: [-1], dtype: 'float32', axes: [{ name: 'time' }],
        unit: 'V', quantityKind: 'Voltage',
      },
    },
  ],
}

const source = `import { Experiment, Setup } from '@caemble/core'
const tensorValues = [[0.1, 0.2]] as const
const experiment = new Experiment({ lengthUnit: 'mm',
  initializations: () => [{
    target: ['structure.geometry.sample'], label: 'Initial profile', methodId: 'field.initialize',
    parameters: {
      scalarOnly: 1,
      profile: {
        type: 'tensor', dimension: 2, shape: [1, 2], dtype: 'float32',
        unit: 'V',
        quantityKind: 'Voltage',
        axes: [
          { name: 'batch', ticks: ['sample'] },
          { name: 'position', ticks: [0, 0.5], unit: 'm', quantityKind: 'Length' },
        ],
        value: tensorValues,
      },
    },
  }],
  recordedData: () => [{
    target: ['structure.geometry.sample'], label: 'Domain average', methodId: 'field.average',
    parameters: { interval: 10 },
    result: {
      type: 'tensor', dimension: 0, shape: [], dtype: 'float64',
      unit: '{fraction}', quantityKind: 'DimensionlessRatio',
    },
  }],
})
export default new Setup(experiment)
`

describe('ExperimentalParameters', () => {
  it('shows tensor/result units and read-only scalar parameter units', () => {
    const markup = renderToStaticMarkup(
      <ExperimentalParameters
        onSourceChange={() => undefined}
        readOnly={false}
        rules={rules}
        source={source}
      />,
    )

    expect(markup).toContain('Initial profile')
    expect(markup).toContain('field.initialize')
    expect(markup).toContain('profile')
    expect(markup).toContain('float32 · 2D · shape [1,2] · Voltage · V')
    expect(markup).toContain('aria-label="Initial profile profile axes"')
    expect(markup).toContain('batch')
    expect(markup).toContain('sample')
    expect(markup).toContain('position')
    expect(markup).toContain('position · Length · m')
    expect(markup).toContain('[0,0.5]')
    expect(markup).toContain('Recorded result schema (source-only)')
    expect(markup).toContain('float64 · 0D · shape []')
    expect(markup).toContain('aria-label="Domain average result axes"')
    expect(markup).toContain('[] (0D tensor)')
    expect(markup).toContain('Dynamic profile')
    expect(markup).toContain('dynamic ticks from result')
    expect(markup).toContain('Scalar parameters (source-only)')
    expect(markup).toContain('>scalarOnly</code>')
    expect(markup).toContain('1 · integer')
    expect(markup).toContain('>ratio</code>')
    expect(markup).toContain('0.25 · DimensionlessRatio · {fraction}')
    expect(markup).toContain('>voltage</code>')
    expect(markup).toContain('1 · Voltage · mV')
    expect(markup).not.toContain('Result value')
    expect(markup.match(/<textarea/g)).toHaveLength(1)
  })

  it('makes tensor JSON read-only without an Experiment change callback', () => {
    const markup = renderToStaticMarkup(
      <ExperimentalParameters
        onSourceChange={() => undefined}
        readOnly
        rules={rules}
        source={source}
      />,
    )
    const textarea = markup.match(/<textarea[^>]*aria-label="Initial profile profile tensor JSON"[^>]*>/)?.[0]

    expect(textarea).toBeDefined()
    expect(textarea).toContain('readonly=""')
    expect(markup).toContain('Provide onExperimentChange to edit this tensor.')
  })
})
