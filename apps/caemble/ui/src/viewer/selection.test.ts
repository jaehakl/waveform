import { primitives } from '@jscad/modeling'
import { describe, expect, it } from 'vitest'
import type { CadScenePart, CadSceneSelection } from '../cad'
import { createRenderParts } from './selection'

const selectedColor = [249 / 255, 115 / 255, 22 / 255, 1]

function createPart(id = 'assembly.core', displayColor = '#2563eb'): CadScenePart {
  return {
    id,
    geometry: primitives.cuboid({ size: [2, 2, 2] }),
    materialName: 'Core',
    displayColor,
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
