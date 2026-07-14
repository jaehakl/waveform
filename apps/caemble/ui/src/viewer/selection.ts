import type { CadScenePart, CadSceneSelection } from '../cad'

type RenderPolygon = Record<string, unknown> & { color?: number[] }
type RenderSolid = Record<string, unknown> & { polygons: RenderPolygon[] }

const selectedColor: [number, number, number, number] = [249 / 255, 115 / 255, 22 / 255, 1]

export function colorFromHex(hex: string): [number, number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
    1,
  ]
}

function dimmedColor(hex: string): [number, number, number, number] {
  const color = colorFromHex(hex)
  return [
    color[0] + (1 - color[0]) * 0.7,
    color[1] + (1 - color[1]) * 0.7,
    color[2] + (1 - color[2]) * 0.7,
    1,
  ]
}

export function createRenderParts(parts: CadScenePart[], selection: CadSceneSelection | null) {
  if (!selection) {
    return parts.map((part) => ({ geometry: part.geometry, color: colorFromHex(part.displayColor) }))
  }

  const selectedGeometryIds = new Set(selection.geometryIds)
  const selectedSurfacePart = selection.kind === 'surface'
    ? parts.find((part) => part.id === selection.geometryIds[0])
    : undefined
  const selectedSurface = selectedSurfacePart?.surfaces.find((surface) => surface.id === selection.surfaceId)
  const selectedPolygonIndices = new Set(selectedSurface?.polygonIndices ?? [])

  return parts.map((part) => {
    const wholePartIsSelected = selection.kind !== 'surface' && selectedGeometryIds.has(part.id)
    const fallbackColor = wholePartIsSelected ? selectedColor : dimmedColor(part.displayColor)
    if (
      typeof part.geometry !== 'object' ||
      part.geometry === null ||
      !('polygons' in part.geometry) ||
      !Array.isArray(part.geometry.polygons)
    ) {
      return { geometry: part.geometry, color: fallbackColor }
    }

    const geometry = part.geometry as RenderSolid
    const polygons = geometry.polygons.map((polygon, polygonIndex) => ({
      ...polygon,
      color:
        wholePartIsSelected ||
        (part.id === selectedSurfacePart?.id && selectedPolygonIndices.has(polygonIndex))
          ? [...selectedColor]
          : [...dimmedColor(part.displayColor)],
    }))
    return {
      geometry: { ...geometry, color: fallbackColor, polygons },
      color: fallbackColor,
    }
  })
}
