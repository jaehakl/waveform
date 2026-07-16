import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { EvaluatedExperimentRules } from '../cad'
import ExperimentalParameters from './ExperimentalParameters'

const rules: EvaluatedExperimentRules = {
  initialConditions: [{
    target: ['structure.geometry.sample'],
    label: 'Initial profile',
    methodId: 'field.initialize',
    parameters: {
      scalarOnly: 1,
      profile: {
        type: 'tensor',
        dimension: 2,
        shape: [1, 2],
        dtype: 'float32',
        value: [[0.1, 0.2]],
      },
    },
  }],
  boundaryConditions: [],
  recordedData: [{
    target: ['structure.geometry.sample'],
    label: 'Domain average',
    methodId: 'field.average',
    parameters: { interval: 10 },
    result: { type: 'tensor', dimension: 0, shape: [], dtype: 'float64' },
  }],
}

const source = `import { Experiment, Setup } from '@caemble/core'
const tensorValues = [[0.1, 0.2]] as const
const experiment = new Experiment({
  initialConditions: () => [{
    target: ['structure.geometry.sample'], label: 'Initial profile', methodId: 'field.initialize',
    parameters: {
      scalarOnly: 1,
      profile: { type: 'tensor', dimension: 2, shape: [1, 2], dtype: 'float32', value: tensorValues },
    },
  }],
  recordedData: () => [{
    target: ['structure.geometry.sample'], label: 'Domain average', methodId: 'field.average',
    parameters: { interval: 10 },
    result: { type: 'tensor', dimension: 0, shape: [], dtype: 'float64' },
  }],
})
export default new Setup(experiment)
`

describe('ExperimentalParameters', () => {
  it('shows tensor editors and recorded result schemas but no scalar editor', () => {
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
    expect(markup).toContain('float32 · 2D · shape [1,2]')
    expect(markup).toContain('Recorded result schema (source-only)')
    expect(markup).toContain('float64 · 0D · shape []')
    expect(markup).toContain('1 scalar parameter hidden here')
    expect(markup).not.toContain('>scalarOnly<')
    expect(markup).not.toContain('Result value')
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
