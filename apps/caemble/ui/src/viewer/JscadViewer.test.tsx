import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import JscadViewer from './JscadViewer'

describe('JscadViewer Material legend', () => {
  it('shows each used Material once with its display color', () => {
    const markup = renderToStaticMarkup(
      <JscadViewer
        onRenderEnd={() => undefined}
        onRenderError={() => undefined}
        onRenderStart={() => undefined}
        selectedId={null}
        parts={[
          { id: 'geometry-1', geometry: {}, materialName: 'Core', displayColor: '#2563eb', surfaces: [] },
          { id: 'geometry-2', geometry: {}, materialName: 'Core', displayColor: '#2563eb', surfaces: [] },
          { id: 'geometry-3', geometry: {}, materialName: 'Cladding', displayColor: '#f59e0b', surfaces: [] },
        ]}
      />,
    )

    expect(markup.match(/Core/g)).toHaveLength(1)
    expect(markup.match(/Cladding/g)).toHaveLength(1)
    expect(markup).toContain('background-color:#2563eb')
    expect(markup).toContain('background-color:#f59e0b')
  })

  it('shows the selected Surface name and ID', () => {
    const markup = renderToStaticMarkup(
      <JscadViewer
        onRenderEnd={() => undefined}
        onRenderError={() => undefined}
        onRenderStart={() => undefined}
        selectedId="geometry-1/surface-1"
        parts={[{
          id: 'geometry-1',
          geometry: {},
          materialName: 'Core',
          displayColor: '#2563eb',
          surfaces: [{ id: 'geometry-1/surface-1', name: 'Top', polygonIndices: [0] }],
        }]}
      />,
    )

    expect(markup).toContain('Selected')
    expect(markup).toContain('>Top</div>')
    expect(markup).toContain('geometry-1/surface-1')
  })
})
