import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CadScene } from '../cad'
import GeometryTree from './GeometryTree'

const scene: CadScene = {
  parts: [{
    id: 'geometry-1',
    geometry: {},
    materialName: 'Core',
    displayColor: '#2563eb',
    surfaces: [{ id: 'geometry-1/surface-1', name: 'Top', polygonIndices: [0] }],
  }],
  tree: {
    key: 'structure',
    label: 'Structure',
    children: [{
      key: 'structure/geometry-1',
      label: 'Geometry 1 · Core',
      geometryId: 'geometry-1',
      children: [{
        key: 'structure/geometry-1/surface-1',
        label: 'Top',
        surfaceId: 'geometry-1/surface-1',
        children: [],
      }],
    }],
  },
}

describe('GeometryTree', () => {
  it('opens Structure and its first level while marking the selected Geometry row', () => {
    const markup = renderToStaticMarkup(
      <GeometryTree scene={scene} selectedId="geometry-1" onSelect={() => undefined} />,
    )

    expect(markup).toContain('Geometry Tree')
    expect(markup).toContain('Structure')
    expect(markup).toContain('Geometry 1 · Core')
    expect(markup).toContain('geometry-1')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('geometry-1/surface-1')
    expect(markup).toContain('>Top</span>')
  })
})
