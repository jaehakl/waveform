import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import JscadViewer, { ViewerToolbar } from './JscadViewer'

describe('JscadViewer modes', () => {
  it('defaults to the Geometry tab and exposes the shared render panel', () => {
    const markup = renderToStaticMarkup(
      <JscadViewer
        onRenderEnd={() => undefined}
        onRenderError={() => undefined}
        onRenderStart={() => undefined}
        parts={[]}
        selection={null}
      />,
    )

    expect(markup).toContain('aria-label="Viewer modes"')
    expect(markup).toMatch(/<button[^>]*aria-selected="true"[^>]*id="viewer-geometry-tab"[^>]*role="tab"[^>]*tabindex="0"/)
    expect(markup).toMatch(/<button[^>]*aria-selected="false"[^>]*id="viewer-material-grid-tab"[^>]*role="tab"[^>]*tabindex="-1"/)
    expect(markup).toMatch(/aria-labelledby="viewer-geometry-tab"[^>]*id="viewer-render-panel"[^>]*role="tabpanel"/)
    expect(markup).not.toContain('id="material-grid-spacing"')
  })

  it('shows spacing controls and requested/applied spacing for Material Grid', () => {
    const markup = renderToStaticMarkup(
      <ViewerToolbar
        gridError={null}
        gridResult={{
          candidatePointCount: 100,
          colors: new Float32Array(48),
          effectiveSpacing: 0.25,
          positions: new Float32Array(36),
          requestedSpacing: 0.1,
          visiblePointCount: 12,
        }}
        gridStatus="ready"
        mode="material-grid"
        spacingDraft="0.1"
        spacingError={null}
        onApplySpacing={() => undefined}
        onChangeSpacing={() => undefined}
        onSelectMode={() => undefined}
      />,
    )

    expect(markup).toMatch(/<button[^>]*aria-selected="true"[^>]*id="viewer-material-grid-tab"/)
    expect(markup).toContain('id="material-grid-spacing"')
    expect(markup).toContain('value="0.1"')
    expect(markup).toContain('>Apply</button>')
    expect(markup).toContain('12 points · requested 0.1 · applied 0.25')
  })

  it('marks invalid spacing and reports a local validation message', () => {
    const markup = renderToStaticMarkup(
      <ViewerToolbar
        gridError={null}
        gridResult={null}
        gridStatus="idle"
        mode="material-grid"
        spacingDraft="0"
        spacingError="Enter a positive finite spacing value."
        onApplySpacing={() => undefined}
        onChangeSpacing={() => undefined}
        onSelectMode={() => undefined}
      />,
    )

    expect(markup).toMatch(/<input[^>]*aria-describedby="material-grid-spacing-error"[^>]*aria-invalid="true"/)
    expect(markup).toContain('role="alert">Enter a positive finite spacing value.</div>')
  })
})

describe('JscadViewer Material legend', () => {
  it('shows filled, colorless, and unassigned entries with the matching swatch style', () => {
    const core = { symbol: 'Core', version: 'Kittel_1988', variables: { color: '#2563eb' } }
    const cladding = { symbol: 'Cladding', variables: {} }
    const markup = renderToStaticMarkup(
      <JscadViewer
        onRenderEnd={() => undefined}
        onRenderError={() => undefined}
        onRenderStart={() => undefined}
        selection={null}
        parts={[
          { id: 'assembly.core-1', geometry: {}, material: core, surfaces: [] },
          { id: 'assembly.core-2', geometry: {}, material: core, surfaces: [] },
          { id: 'assembly.cladding', geometry: {}, material: cladding, surfaces: [] },
          { id: 'assembly.unassigned-1', geometry: {}, surfaces: [] },
          { id: 'assembly.unassigned-2', geometry: {}, surfaces: [] },
        ]}
      />,
    )

    expect(markup.match(/Core/g)).toHaveLength(1)
    expect(markup.match(/Cladding/g)).toHaveLength(1)
    expect(markup.match(/Unassigned/g)).toHaveLength(1)
    expect(markup).toContain('background-color:#2563eb')
    expect(markup.match(/data-material-swatch="wireframe"/g)).toHaveLength(2)
    expect(markup).toContain('border-color:#475569')
    expect(markup).not.toContain('background-color:#3b82f6')
    expect(markup).not.toContain('Kittel_1988')
  })

  it('keeps distinct Material instances with the same symbol in separate rows', () => {
    const markup = renderToStaticMarkup(
      <JscadViewer
        onRenderEnd={() => undefined}
        onRenderError={() => undefined}
        onRenderStart={() => undefined}
        selection={null}
        parts={[
          {
            id: 'assembly.first',
            geometry: {},
            material: { symbol: 'Core', variables: { color: '#2563eb' } },
            surfaces: [],
          },
          {
            id: 'assembly.second',
            geometry: {},
            material: { symbol: 'Core', variables: { color: '#dc2626' } },
            surfaces: [],
          },
        ]}
      />,
    )

    expect(markup.match(/Core/g)).toHaveLength(2)
    expect(markup).toContain('background-color:#2563eb')
    expect(markup).toContain('background-color:#dc2626')
  })

  it('shows the selected Surface name and ID', () => {
    const markup = renderToStaticMarkup(
      <JscadViewer
        onRenderEnd={() => undefined}
        onRenderError={() => undefined}
        onRenderStart={() => undefined}
        selection={{
          id: 'assembly.core/surface-1',
          kind: 'surface',
          label: 'Top',
          geometryIds: ['assembly.core'],
          surfaceIds: ['assembly.core/surface-1'],
        }}
        parts={[{
          id: 'assembly.core',
          geometry: {},
          material: { symbol: 'Core', variables: { color: '#2563eb' } },
          surfaces: [{ id: 'assembly.core/surface-1', name: 'Top', polygonIndices: [0] }],
        }]}
      />,
    )

    expect(markup).toContain('Selected')
    expect(markup).toContain('>Top</div>')
    expect(markup).toContain('assembly.core/surface-1')
  })

  it('shows a selected group label, ID, and Geometry count', () => {
    const markup = renderToStaticMarkup(
      <JscadViewer
        onRenderEnd={() => undefined}
        onRenderError={() => undefined}
        onRenderStart={() => undefined}
        selection={{
          id: 'assembly',
          kind: 'group',
          label: 'Assembly',
          geometryIds: ['assembly.first', 'assembly.second'],
        }}
        parts={[
          {
            id: 'assembly.first',
            geometry: {},
            material: { symbol: 'Core', variables: { color: '#2563eb' } },
            surfaces: [],
          },
          {
            id: 'assembly.second',
            geometry: {},
            material: { symbol: 'Core', variables: { color: '#2563eb' } },
            surfaces: [],
          },
        ]}
      />,
    )

    expect(markup).toContain('Assembly · 2 geometries')
    expect(markup).toContain('assembly')
  })
})
