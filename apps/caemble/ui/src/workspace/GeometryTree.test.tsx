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
    groupId: 'group-1',
    geometryIds: ['geometry-1'],
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
    }, {
      key: 'structure/operand',
      label: 'Consumed operand',
      children: [],
    }],
  },
}

describe('GeometryTree', () => {
  it('marks only the active selectable group while keeping descendants individually unselected', () => {
    const markup = renderToStaticMarkup(
      <GeometryTree scene={scene} selectedId="group-1" onSelect={() => undefined} />,
    )

    expect(markup).toContain('aria-label="Geometry Tree"')
    expect(markup).not.toContain('<h2')
    expect(markup).not.toContain('geometries')
    expect(markup).toContain('Structure')
    expect(markup).toContain('group-1')
    expect(markup).toContain('Geometry 1 · Core')
    expect(markup).toContain('geometry-1')
    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(markup).toContain('aria-pressed="false"')
    expect(markup).toContain('geometry-1/surface-1')
    expect(markup).toContain('>Top</span>')
    expect(markup).toContain('Consumed operand')
  })
})
