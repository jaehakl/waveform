import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { RecordedDataRule } from '../cad'
import RecordedDataResults from './RecordedDataResults'

function rule(
  label: string,
  shape: readonly number[],
  dtype: RecordedDataRule['result']['dtype'],
  unit?: string,
  axisUnit?: string,
): RecordedDataRule {
  const quantityMetadata = dtype.startsWith('float')
    ? unit === 'A'
      ? { unit, quantityKind: 'ElectricCurrent' as const }
      : unit === 'A.m-2'
        ? { unit, quantityKind: 'ElectricCurrentDensity' as const }
        : { unit: '{fraction}', quantityKind: 'DimensionlessRatio' as const }
    : {}
  return {
    target: ['experiment.geometry.domain'],
    label,
    methodId: `field.${label.toLowerCase().replace(/ /g, '-')}`,
    parameters: {},
    result: {
      type: 'tensor',
      dimension: shape.length,
      shape,
      dtype,
      ...quantityMetadata,
      axes: shape.map((size, index) => ({
        name: `axis ${index}`,
        ...(axisUnit ? { unit: axisUnit, quantityKind: 'Length' as const } : {}),
        ...(size === -1 ? {} : { ticks: Array.from({ length: size }, (_, tick) => `${index}:${tick}`) }),
      })),
    } as RecordedDataRule['result'],
  }
}

describe('RecordedDataResults', () => {
  const rules = [
    rule('Average', [], 'float64', 'A'),
    rule('Profile', [3], 'float32', 'A.m-2', 'm'),
    rule('Field', [2, 3], 'float32', 'A.m-2', 'm'),
  ]

  it('shows schema-driven scalar, chart, and heatmap shells without values', () => {
    const markup = renderToStaticMarkup(<RecordedDataResults rules={rules} />)

    expect(markup).toContain('aria-label="Recorded Data Results"')
    expect(markup).toContain('data-result-visualization="scalar"')
    expect(markup).toContain('data-result-visualization="line chart"')
    expect(markup).toContain('data-result-visualization="heatmap"')
    expect(markup.match(/No recorded data/g)).toHaveLength(3)
    expect(markup).toContain('expected [2,3]')
  })

  it('shows valid scalar data and isolates unknown labels and shape errors', () => {
    const markup = renderToStaticMarkup(
      <RecordedDataResults
        rules={rules}
        recordedData={{
          Average: { value: 0.5 },
          Profile: { value: [1, 2] },
          Unknown: { value: 1 },
        }}
      />,
    )

    expect(markup).toContain('Unknown recordedData labels: Unknown')
    expect(markup).toContain('aria-label="Recorded scalar value"')
    expect(markup).toContain('<span>0.5</span>')
    expect(markup).toContain('<span class="text-base text-slate-500">A</span>')
    expect(markup).toContain('actual shape [2]; expected shape [3]')
    expect(markup).toContain('aria-label="Profile empty line chart"')
  })

  it('renders N-dimensional string slices with leading-axis selectors and a matrix table', () => {
    const textRule = rule('Labels', [2, 2, 2], 'string')
    const markup = renderToStaticMarkup(
      <RecordedDataResults
        rules={[textRule]}
        recordedData={{
          Labels: { value: [
            [['a', 'b'], ['c', 'd']],
            [['e', 'f'], ['g', 'h']],
          ] },
        }}
      />,
    )

    expect(markup).toContain('aria-label="Select axis 0 slice"')
    expect(markup).toContain('0: 0:0')
    expect(markup).toContain('>a</td>')
    expect(markup).toContain('>d</td>')
    expect(markup).not.toContain('>e</td>')
  })

  it('lazy-loads Plotly for populated numeric line and heatmap plots', () => {
    const markup = renderToStaticMarkup(
      <RecordedDataResults
        rules={rules.slice(1)}
        recordedData={{
          Profile: { value: [1, 2, 3] },
          Field: { value: [[1, 2, 3], [4, 5, 6]] },
        }}
      />,
    )

    expect(markup).toContain('Loading line chart...')
    expect(markup).toContain('Loading heatmap...')
  })

  it('renders a resolved empty wildcard tensor without attempting an invalid slice', () => {
    const emptyRule = rule('Dynamic empty', [-1, -1, -1], 'float32')
    const markup = renderToStaticMarkup(
      <RecordedDataResults
        rules={[emptyRule]}
        recordedData={{ 'Dynamic empty': { value: [] } }}
      />,
    )

    expect(markup).toContain('No recorded values')
    expect(markup).toContain('Resolved empty tensor · actual [0,0,0]')
  })
})
