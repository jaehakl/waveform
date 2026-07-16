import type { CadScenePart, CadSceneSelection } from '../cad'
import { materialColor, unassignedGeometryColor } from './materialColor'

type RenderColor = [number, number, number, number]
type RenderPolygon = Record<string, unknown> & { color?: number[]; vertices?: number[][] }
type RenderSolid = Record<string, unknown> & { polygons: RenderPolygon[]; transforms?: unknown }

export type RenderPart = Readonly<{
  color: RenderColor
  geometry: unknown
  selectedPolygonIndices: readonly number[]
  wireframe: boolean
}>

export type WireframeGeometry = Readonly<{
  colors: RenderColor[]
  indices: number[]
  isTransparent: boolean
  normals: number[][]
  positions: number[][]
  transforms: unknown
  type: '3d'
}>

const maximumWireframeVertices = Math.floor(65_535 / 2) * 2
const selectedColor: RenderColor = [249 / 255, 115 / 255, 22 / 255, 1]

export function colorFromHex(hex: string): RenderColor {
  return [
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
    1,
  ]
}

const wireframeColor = colorFromHex(unassignedGeometryColor)

function dimmedColor(color: RenderColor): RenderColor {
  return [
    color[0] + (1 - color[0]) * 0.7,
    color[1] + (1 - color[1]) * 0.7,
    color[2] + (1 - color[2]) * 0.7,
    1,
  ]
}

export function createRenderParts(parts: CadScenePart[], selection: CadSceneSelection | null): RenderPart[] {
  if (!selection) {
    return parts.map((part) => {
      const color = materialColor(part.material)
      return {
        geometry: part.geometry,
        color: color === undefined ? wireframeColor : colorFromHex(color),
        selectedPolygonIndices: [],
        wireframe: color === undefined,
      }
    })
  }

  const selectedGeometryIds = new Set(selection.geometryIds)
  const selectsSurfaces = selection.kind === 'surface' || selection.kind === 'surface-group'
  const selectedSurfaceIds = new Set(selection.surfaceIds ?? [])

  return parts.map((part) => {
    const color = materialColor(part.material)
    const wireframe = color === undefined
    const wholePartIsSelected = !selectsSurfaces && selectedGeometryIds.has(part.id)
    const selectedPolygonIndices = new Set(
      part.surfaces
        .filter((surface) => selectedSurfaceIds.has(surface.id))
        .flatMap((surface) => surface.polygonIndices),
    )
    const baseColor = color === undefined ? wireframeColor : colorFromHex(color)
    const fallbackColor = wholePartIsSelected ? selectedColor : dimmedColor(baseColor)
    if (wireframe) {
      return {
        geometry: part.geometry,
        color: fallbackColor,
        selectedPolygonIndices: [...selectedPolygonIndices],
        wireframe: true,
      }
    }
    if (
      typeof part.geometry !== 'object'
      || part.geometry === null
      || !('polygons' in part.geometry)
      || !Array.isArray(part.geometry.polygons)
    ) {
      return {
        geometry: part.geometry,
        color: fallbackColor,
        selectedPolygonIndices: [],
        wireframe: false,
      }
    }

    const geometry = part.geometry as RenderSolid
    const polygons = geometry.polygons.map((polygon, polygonIndex) => ({
      ...polygon,
      color:
        wholePartIsSelected || selectedPolygonIndices.has(polygonIndex)
          ? [...selectedColor]
          : [...dimmedColor(baseColor)],
    }))
    return {
      geometry: { ...geometry, color: fallbackColor, polygons },
      color: fallbackColor,
      selectedPolygonIndices: [],
      wireframe: false,
    }
  })
}

export function createWireframeGeometries(part: RenderPart): WireframeGeometry[] {
  if (
    !part.wireframe
    || typeof part.geometry !== 'object'
    || part.geometry === null
    || !('polygons' in part.geometry)
  ) return []

  const geometry = part.geometry as RenderSolid
  if (!Array.isArray(geometry.polygons) || geometry.transforms === undefined) return []

  const selectedPolygonIndices = new Set(part.selectedPolygonIndices)
  const edges = new Map<string, { first: number[]; second: number[]; selected: boolean }>()
  geometry.polygons.forEach((polygon, polygonIndex) => {
    if (!Array.isArray(polygon.vertices) || polygon.vertices.length < 2) return

    polygon.vertices.forEach((first, vertexIndex) => {
      const second = polygon.vertices![(vertexIndex + 1) % polygon.vertices!.length]
      if (
        !Array.isArray(first)
        || !Array.isArray(second)
        || first.length < 3
        || second.length < 3
      ) return

      const firstKey = first.join(',')
      const secondKey = second.join(',')
      const key = firstKey < secondKey ? `${firstKey}/${secondKey}` : `${secondKey}/${firstKey}`
      const existing = edges.get(key)
      if (existing) {
        if (selectedPolygonIndices.has(polygonIndex)) existing.selected = true
        return
      }
      edges.set(key, {
        first: [first[0], first[1], first[2]],
        second: [second[0], second[1], second[2]],
        selected: selectedPolygonIndices.has(polygonIndex),
      })
    })
  })

  const edgeList = [...edges.values()]
  const maximumEdgesPerGeometry = maximumWireframeVertices / 2
  const geometries: WireframeGeometry[] = []
  for (let start = 0; start < edgeList.length; start += maximumEdgesPerGeometry) {
    const positions: number[][] = []
    const colors: RenderColor[] = []
    edgeList.slice(start, start + maximumEdgesPerGeometry).forEach((edge) => {
      const color = edge.selected ? selectedColor : part.color
      positions.push(edge.first, edge.second)
      colors.push(color, color)
    })
    geometries.push({
      colors,
      indices: positions.map((_, index) => index),
      isTransparent: false,
      normals: positions.map(() => [0, 0, 1]),
      positions,
      transforms: geometry.transforms,
      type: '3d',
    })
  }
  return geometries
}
