import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CadScene } from '../cad'
import CadViewer from './CadViewer'
import { resolveCadViewerContent } from './cadViewerContent'

const structureScene: CadScene = {
  parts: [{ id: 'structure-part', geometry: {}, surfaces: [] }],
  tree: { key: 'structure', label: 'Structure', children: [] },
  geometryGroups: [],
  surfaceGroups: [],
}

const experimentScene: CadScene = {
  parts: [{ id: 'experiment-part', geometry: {}, surfaces: [] }],
  tree: { key: 'experiment', label: 'Experiment', children: [] },
  geometryGroups: [],
  surfaceGroups: [],
}

describe('CadViewer', () => {
  it('defaults available Structure and Experiment sources to visible', () => {
    const markup = renderToStaticMarkup(
      <CadViewer
        experiment={{ scene: experimentScene, variables: { duration: 1 } }}
        selected={null}
        structure={{ scene: structureScene, variables: { width: 2 } }}
        onRenderEnd={() => undefined}
        onRenderError={() => undefined}
        onRenderStart={() => undefined}
      />,
    )

    expect(markup).toContain('aria-label="3D CAD Viewer"')
    expect(markup).toMatch(/<button[^>]*aria-label="Toggle structure"[^>]*aria-pressed="true"/)
    expect(markup).toMatch(/<button[^>]*aria-label="Toggle experiment"[^>]*aria-pressed="true"/)
  })

  it('disables a missing source toggle', () => {
    const markup = renderToStaticMarkup(
      <CadViewer
        experiment={null}
        selected={null}
        structure={{ scene: null, variables: null }}
        onRenderEnd={() => undefined}
        onRenderError={() => undefined}
        onRenderStart={() => undefined}
      />,
    )

    expect(markup).toMatch(/<button[^>]*aria-label="Toggle experiment"[^>]*disabled/)
    expect(markup).toContain('Waiting for model...')
  })

  it('builds Experiment then Structure layers and an explicit all-hidden state', () => {
    const visible = resolveCadViewerContent(
      { scene: structureScene, variables: { width: 2 } },
      { scene: experimentScene, variables: { duration: 1 } },
      true,
      true,
    )
    const hidden = resolveCadViewerContent(
      { scene: structureScene, variables: { width: 2 } },
      { scene: experimentScene, variables: { duration: 1 } },
      false,
      false,
    )

    expect(visible.visibleSources).toEqual(['structure', 'experiment'])
    expect(visible.layers.map((layer) => layer.documentType)).toEqual(['experiment', 'structure'])
    expect(hidden.visibleSources).toEqual([])
    expect(hidden.layers).toEqual([])
    expect(hidden.emptyMessage).toBe('All Structure and Experiment sources are hidden.')
  })

  it('shows Results only when the Experiment exposes recorded rules', () => {
    const experimentRules = {
      initialConditions: [],
      boundaryConditions: [],
      recordedData: [{
        target: ['experiment.geometry.domain'] as const,
        label: 'Domain average',
        methodId: 'field.average',
        parameters: {},
        result: { type: 'tensor' as const, dimension: 0, shape: [], dtype: 'float64' as const, axes: [] },
      }],
    }
    const markup = renderToStaticMarkup(
      <CadViewer
        experiment={{ scene: experimentScene, variables: {}, experimentRules }}
        recordedData={{ 'Domain average': { value: 0.5 } }}
        selected={null}
        structure={null}
        onRenderEnd={() => undefined}
        onRenderError={() => undefined}
        onRenderStart={() => undefined}
      />,
    )

    expect(markup).toContain('id="viewer-results-tab"')
    expect(markup).toContain('>Results</button>')
  })
})
