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
        selection={null}
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
        selection={{
          id: 'geometry-1/surface-1',
          kind: 'surface',
          label: 'Top',
          geometryIds: ['geometry-1'],
          surfaceId: 'geometry-1/surface-1',
        }}
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

  it('shows a selected group label, ID, and Geometry count', () => {
    const markup = renderToStaticMarkup(
      <JscadViewer
        onRenderEnd={() => undefined}
        onRenderError={() => undefined}
        onRenderStart={() => undefined}
        selection={{
          id: 'group-1',
          kind: 'group',
          label: 'Structure',
          geometryIds: ['geometry-1', 'geometry-2'],
        }}
        parts={[
          { id: 'geometry-1', geometry: {}, materialName: 'Core', displayColor: '#2563eb', surfaces: [] },
          { id: 'geometry-2', geometry: {}, materialName: 'Core', displayColor: '#2563eb', surfaces: [] },
        ]}
      />,
    )

    expect(markup).toContain('Structure · 2 geometries')
    expect(markup).toContain('group-1')
  })
})
