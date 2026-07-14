import { primitives } from '@jscad/modeling'
import { describe, expect, it } from 'vitest'
import type { CadScenePart } from '../cad'
import { createRenderParts } from './selection'

const selectedColor = [249 / 255, 115 / 255, 22 / 255, 1]

function createPart(): CadScenePart {
  return {
    id: 'geometry-1',
    geometry: primitives.cuboid({ size: [2, 2, 2] }),
    materialName: 'Core',
    displayColor: '#2563eb',
    surfaces: [
      { id: 'geometry-1/surface-1', name: '-X', polygonIndices: [0] },
      { id: 'geometry-1/surface-2', name: 'Other', polygonIndices: [1, 2, 3, 4, 5] },
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

    const geometrySelection = createRenderParts([part], part.id)[0].geometry as {
      polygons: Array<{ color: number[] }>
    }
    expect(geometrySelection.polygons.every((polygon) =>
      polygon.color.every((coordinate, index) => coordinate === selectedColor[index]),
    )).toBe(true)

    const surfaceSelection = createRenderParts([part], part.surfaces[0].id)[0].geometry as {
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
})
