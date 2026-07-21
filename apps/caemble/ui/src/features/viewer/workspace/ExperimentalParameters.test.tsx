import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { EvaluatedExperimentRules } from '@/lib/cad'
import ExperimentalParameters from './ExperimentalParameters'

const rules: EvaluatedExperimentRules = {
  initializations: [{
    target: ['structure.geometry.sample'],
    label: 'Initial profile',
    methodId: 'field.initialize',
    parameters: {
      scalarOnly: 1,
      ratio: {
        dtype: 'float64', value: 0.25, unit: '{fraction}', quantityKind: 'DimensionlessRatio',
      },
      voltage: { dtype: 'float64', value: 1, unit: 'mV', quantityKind: 'electromagnetism.Voltage' },
      profile: {
        dtype: 'float32',
        unit: 'V',
        quantityKind: 'electromagnetism.Voltage',
        axes: [
          { length: 1, name: 'batch', ticks: ['sample'] },
          { length: 2, name: 'position', ticks: [0, 0.5], unit: 'm', quantityKind: 'Length' },
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
        dtype: 'float64',
        unit: '{fraction}', quantityKind: 'DimensionlessRatio',
      },
    },
    {
      target: ['structure.geometry.sample'],
      label: 'Dynamic profile',
      methodId: 'field.profile',
      parameters: { interval: 10 },
      result: {
        dtype: 'float32', axes: [{ name: 'time' }],
        unit: 'V', quantityKind: 'electromagnetism.Voltage',
      },
    },
  ],
}

const source = `import { experiment } from '@caemble/core/v2'
const tensorValues = [[0.1, 0.2]] as const
const active = experiment({ lengthUnit: 'mm',
  initializations: () => [{
    target: ['structure.geometry.sample'], label: 'Initial profile', methodId: 'field.initialize',
    parameters: {
      scalarOnly: 1,
      profile: {
        dtype: 'float32',
        unit: 'V',
        quantityKind: 'electromagnetism.Voltage',
        axes: [
          { length: 1, name: 'batch', ticks: ['sample'] },
          { length: 2, name: 'position', ticks: [0, 0.5], unit: 'm', quantityKind: 'Length' },
        ],
        value: tensorValues,
      },
    },
  }],
  recordedData: () => [{
    target: ['structure.geometry.sample'], label: 'Domain average', methodId: 'field.average',
    parameters: { interval: 10 },
    result: {
      dtype: 'float64',
      unit: '{fraction}', quantityKind: 'DimensionlessRatio',
    },
  }],
})
export default active
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
    expect(markup).toContain('float32 · axes 1 × 2 · order 0 · components [] · electromagnetism.Voltage · V')
    expect(markup).toContain('aria-label="Initial profile profile axes"')
    expect(markup).toContain('batch')
    expect(markup).toContain('sample')
    expect(markup).toContain('position')
    expect(markup).toContain('position · Length · m')
    expect(markup).toContain('[0,0.5]')
    expect(markup).toContain('Recorded result schema (source-only)')
    expect(markup).toContain('float64 · axes none · order 0 · components []')
    expect(markup).not.toContain('aria-label="Domain average result axes"')
    expect(markup).toContain('Dynamic profile')
    expect(markup).toContain('length dynamic · ticks from result')
    expect(markup).toContain('Scalar parameters (source-only)')
    expect(markup).toContain('>scalarOnly</code>')
    expect(markup).toContain('1 · integer')
    expect(markup).toContain('>ratio</code>')
    expect(markup).toContain('0.25 · float64 · DimensionlessRatio · {fraction}')
    expect(markup).toContain('>voltage</code>')
    expect(markup).toContain('1 · float64 · electromagnetism.Voltage · mV')
    expect(markup).not.toContain('Result value')
    expect(markup.match(/<textarea/g)).toHaveLength(1)
  })

  it('makes descriptor data JSON read-only without an Experiment change callback', () => {
    const markup = renderToStaticMarkup(
      <ExperimentalParameters
        onSourceChange={() => undefined}
        readOnly
        rules={rules}
        source={source}
      />,
    )
    const textarea = markup.match(/<textarea[^>]*aria-label="Initial profile profile data JSON"[^>]*>/)?.[0]

    expect(textarea).toBeDefined()
    expect(textarea).toContain('readOnly=""')
    expect(markup).toContain('Provide onExperimentChange to edit this tensor.')
  })
})
