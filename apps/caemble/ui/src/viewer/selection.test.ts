import { primitives } from '@jscad/modeling'
import { describe, expect, it } from 'vitest'
import type { CadScenePart, CadSceneSelection } from '../cad'
import { createRenderParts, createWireframeGeometries } from './selection'

const selectedColor = [249 / 255, 115 / 255, 22 / 255, 1]

function createPart(id = 'assembly.core', color: string | null = '#2563eb', withMaterial = true): CadScenePart {
  return {
    id,
    geometry: primitives.cuboid({ size: [2, 2, 2] }),
    ...(withMaterial ? { material: { symbol: 'Core', variables: color === null ? {} : { color } } } : {}),
    surfaces: [
      { id: `${id}/surface-1`, name: '-X', polygonIndices: [0] },
      { id: `${id}/surface-2`, name: 'Other', polygonIndices: [1, 2, 3, 4, 5] },
    ],
  }
}

describe('viewer selection colors', () => {
  it('keeps original geometry without a selection', () => {
    const part = createPart()
    const [renderPart] = createRenderParts([part], null)

    expect(renderPart.geometry).toBe(part.geometry)
    expect(renderPart.color).toEqual([37 / 255, 99 / 255, 235 / 255, 1])
    expect(renderPart.wireframe).toBe(false)
  })

  it('uses neutral wireframe rendering when Material or color is missing', () => {
    const rendered = createRenderParts([
      createPart('colorless', null),
      createPart('materialless', null, false),
    ], null)

    for (const renderPart of rendered) {
      expect(renderPart.color).toEqual([71 / 255, 85 / 255, 105 / 255, 1])
      expect(renderPart.wireframe).toBe(true)
      const [wireframe] = createWireframeGeometries(renderPart)
      expect(wireframe.positions).toHaveLength(24)
      expect(wireframe.indices).toHaveLength(24)
    }
  })

  it('keeps every unique polygon edge and prioritizes selected Surface edges', () => {
    const transforms = (primitives.cuboid() as { transforms: unknown }).transforms
    const part: CadScenePart = {
      id: 'wireframe',
      geometry: {
        transforms,
        polygons: [
          { vertices: [[0, 0, 0], [1, 0, 0], [1, 1, 0]] },
          { vertices: [[0, 0, 0], [1, 1, 0], [0, 1, 0]] },
        ],
      },
      material: { symbol: 'Colorless', variables: {} },
      surfaces: [
        { id: 'wireframe/surface-1', name: 'First', polygonIndices: [0] },
        { id: 'wireframe/surface-2', name: 'Second', polygonIndices: [1] },
      ],
    }
    const [renderPart] = createRenderParts([part], {
      id: 'wireframe/surface-1',
      kind: 'surface',
      label: 'First',
      geometryIds: ['wireframe'],
      surfaceIds: ['wireframe/surface-1'],
    })
    const [wireframe] = createWireframeGeometries(renderPart)

    expect(wireframe.positions).toHaveLength(10)
    expect(wireframe.colors.filter((color) => color.every((value, index) => value === selectedColor[index]))).toHaveLength(6)
  })

  it('keeps selected unassigned Geometry as orange lines without a mesh', () => {
    const part = createPart('materialless', null, false)
    const [renderPart] = createRenderParts([part], {
      id: part.id,
      kind: 'geometry',
      label: part.id,
      geometryIds: [part.id],
    })
    const geometries = createWireframeGeometries(renderPart)

    expect(renderPart.wireframe).toBe(true)
    expect(geometries).toHaveLength(1)
    expect(geometries[0].colors.every((color) => (
      color.every((value, index) => value === selectedColor[index])
    ))).toBe(true)
  })

  it('splits large wireframes below the 16-bit vertex limit', () => {
    const transforms = (primitives.cuboid() as { transforms: unknown }).transforms
    const vertexCount = 32_768
    const vertices = Array.from({ length: vertexCount }, (_, index) => {
      const angle = index / vertexCount * Math.PI * 2
      return [Math.cos(angle), Math.sin(angle), 0]
    })
    const part = createPart('large-wireframe', null, false)
    part.geometry = { transforms, polygons: [{ vertices }] }
    const geometries = createWireframeGeometries(createRenderParts([part], null)[0])

    expect(geometries.map((geometry) => geometry.positions.length)).toEqual([65_534, 2])
    expect(geometries.every((geometry) => geometry.indices[geometry.indices.length - 1] <= 65_534)).toBe(true)
  })

  it('highlights a whole Geometry or one Surface without mutating scene polygons', () => {
    const part = createPart()
    const originalPolygons = (part.geometry as { polygons: Array<{ color?: number[] }> }).polygons

    const geometrySelection = createRenderParts([part], {
      id: part.id,
      kind: 'geometry',
      label: part.id,
      geometryIds: [part.id],
    })[0].geometry as {
      polygons: Array<{ color: number[] }>
    }
    expect(geometrySelection.polygons.every((polygon) =>
      polygon.color.every((coordinate, index) => coordinate === selectedColor[index]),
    )).toBe(true)

    const surfaceSelection = createRenderParts([part], {
      id: part.surfaces[0].id,
      kind: 'surface',
      label: part.surfaces[0].name,
      geometryIds: [part.id],
      surfaceIds: [part.surfaces[0].id],
    })[0].geometry as {
      polygons: Array<{ color: number[] }>
    }
    const dimmedBlue = [
      37 / 255 + (1 - 37 / 255) * 0.7,
      99 / 255 + (1 - 99 / 255) * 0.7,
      235 / 255 + (1 - 235 / 255) * 0.7,
      1,
    ]
    expect(surfaceSelection.polygons[0].color).toEqual(selectedColor)
    expect(surfaceSelection.polygons.slice(1).every((polygon) =>
      polygon.color.every((coordinate, index) => coordinate === dimmedBlue[index]),
    )).toBe(true)
    expect(originalPolygons.every((polygon) => polygon.color === undefined)).toBe(true)
  })

  it('highlights every Geometry in one group and dims Geometry outside the group', () => {
    const first = createPart('assembly.first', '#2563eb')
    const second = createPart('assembly.second', '#16a34a')
    const outside = createPart('outside', '#dc2626')
    const selection = {
      id: 'assembly',
      kind: 'group',
      label: 'Assembly',
      geometryIds: [first.id, second.id],
    } satisfies CadSceneSelection
    const rendered = createRenderParts([first, second, outside], selection)

    for (const index of [0, 1]) {
      const geometry = rendered[index].geometry as { polygons: Array<{ color: number[] }> }
      expect(geometry.polygons.every((polygon) =>
        polygon.color.every((coordinate, colorIndex) => coordinate === selectedColor[colorIndex]),
      )).toBe(true)
    }

    const dimmedRed = [
      220 / 255 + (1 - 220 / 255) * 0.7,
      38 / 255 + (1 - 38 / 255) * 0.7,
      38 / 255 + (1 - 38 / 255) * 0.7,
      1,
    ]
    const outsideGeometry = rendered[2].geometry as { polygons: Array<{ color: number[] }> }
    expect(outsideGeometry.polygons.every((polygon) =>
      polygon.color.every((coordinate, colorIndex) => coordinate === dimmedRed[colorIndex]),
    )).toBe(true)
    for (const part of [first, second, outside]) {
      const polygons = (part.geometry as { polygons: Array<{ color?: number[] }> }).polygons
      expect(polygons.every((polygon) => polygon.color === undefined)).toBe(true)
    }
  })

  it('highlights grouped Surfaces across multiple Geometry parts', () => {
    const first = createPart('assembly.first')
    const second = createPart('assembly.second', '#16a34a')
    const rendered = createRenderParts([first, second], {
      id: '@surface-group/contacts',
      kind: 'surface-group',
      label: 'contacts',
      geometryIds: [first.id, second.id],
      surfaceIds: [first.surfaces[0].id, second.surfaces[1].id],
    })
    const firstPolygons = (rendered[0].geometry as { polygons: Array<{ color: number[] }> }).polygons
    const secondPolygons = (rendered[1].geometry as { polygons: Array<{ color: number[] }> }).polygons

    expect(firstPolygons[0].color).toEqual(selectedColor)
    expect(firstPolygons.slice(1).every((polygon) => polygon.color[0] !== selectedColor[0])).toBe(true)
    expect(secondPolygons[0].color[0]).not.toBe(selectedColor[0])
    expect(secondPolygons.slice(1).every((polygon) => polygon.color[0] === selectedColor[0])).toBe(true)
  })
})
