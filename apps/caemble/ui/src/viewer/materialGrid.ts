import { geometries, measurements } from '@jscad/modeling'
import type { CadScenePart } from '../cad'
import { materialColor } from './materialColor'
import { colorFromHex } from './selection'

const defaultMaximumCandidatePoints = 100_000
const rayDirection = normalize([1, Math.SQRT1_2, Math.PI / 7])

type Vec3 = readonly [number, number, number]

type Bounds = readonly [Vec3, Vec3]

type PreparedTriangle = Readonly<{
  anchor: Vec3
  bounds: Bounds
  center: Vec3
  edge1: Vec3
  edge2: Vec3
  normal: Vec3
  normalLengthSquared: number
  maximumEdgeLength: number
}>

type TriangleTree = Readonly<{
  bounds: Bounds
  children?: readonly [TriangleTree, TriangleTree]
  triangles?: readonly PreparedTriangle[]
}>

type PreparedPart = Readonly<{
  bounds: Bounds
  color: readonly [number, number, number, number]
  epsilon: number
  triangleTree: TriangleTree
}>

export type MaterialGridResult = Readonly<{
  candidatePointCount: number
  colors: Float32Array
  effectiveSpacing: number
  positions: Float32Array
  requestedSpacing: number
  visiblePointCount: number
}>

export type MaterialGridWorkerRequest = Readonly<{
  parts: CadScenePart[]
  requestId: string
  requestedSpacing: number
}>

export type MaterialGridWorkerResponse =
  | Readonly<{
      requestId: string
      result: MaterialGridResult
      type: 'success'
    }>
  | Readonly<{
      message: string
      requestId: string
      type: 'error'
    }>

function subtract(left: Vec3, right: Vec3): Vec3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]]
}

function dot(left: Vec3, right: Vec3) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2]
}

function cross(left: Vec3, right: Vec3): Vec3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ]
}

function normalize(vector: Vec3): Vec3 {
  const length = Math.hypot(...vector)
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

function distance(left: Vec3, right: Vec3) {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2])
}

function prepareTriangle(anchor: Vec3, second: Vec3, third: Vec3): PreparedTriangle | null {
  const edge1 = subtract(second, anchor)
  const edge2 = subtract(third, anchor)
  const normal = cross(edge1, edge2)
  const normalLengthSquared = dot(normal, normal)
  if (normalLengthSquared === 0) return null

  return {
    anchor,
    bounds: [
      [
        Math.min(anchor[0], second[0], third[0]),
        Math.min(anchor[1], second[1], third[1]),
        Math.min(anchor[2], second[2], third[2]),
      ],
      [
        Math.max(anchor[0], second[0], third[0]),
        Math.max(anchor[1], second[1], third[1]),
        Math.max(anchor[2], second[2], third[2]),
      ],
    ],
    center: [
      (anchor[0] + second[0] + third[0]) / 3,
      (anchor[1] + second[1] + third[1]) / 3,
      (anchor[2] + second[2] + third[2]) / 3,
    ],
    edge1,
    edge2,
    normal,
    normalLengthSquared,
    maximumEdgeLength: Math.max(distance(anchor, second), distance(second, third), distance(third, anchor)),
  }
}

function triangleBounds(triangles: readonly PreparedTriangle[]): Bounds {
  const minimum: [number, number, number] = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
  const maximum: [number, number, number] = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]
  for (const triangle of triangles) {
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis], triangle.bounds[0][axis])
      maximum[axis] = Math.max(maximum[axis], triangle.bounds[1][axis])
    }
  }
  return [minimum, maximum]
}

function buildTriangleTree(triangles: readonly PreparedTriangle[]): TriangleTree {
  const bounds = triangleBounds(triangles)
  if (triangles.length <= 12) return { bounds, triangles }

  const dimensions = bounds[0].map((minimum, axis) => bounds[1][axis] - minimum)
  const splitAxis = dimensions.indexOf(Math.max(...dimensions))
  const ordered = [...triangles].sort((left, right) => left.center[splitAxis] - right.center[splitAxis])
  const middle = Math.floor(ordered.length / 2)
  return {
    bounds,
    children: [buildTriangleTree(ordered.slice(0, middle)), buildTriangleTree(ordered.slice(middle))],
  }
}

function preparePart(part: CadScenePart): PreparedPart | null {
  if (!geometries.geom3.isA(part.geometry)) return null

  const triangles: PreparedTriangle[] = []
  for (const polygon of geometries.geom3.toPolygons(part.geometry)) {
    if (polygon.vertices.length < 3) continue
    const anchor = polygon.vertices[0] as Vec3
    for (let index = 1; index < polygon.vertices.length - 1; index += 1) {
      const triangle = prepareTriangle(
        anchor,
        polygon.vertices[index] as Vec3,
        polygon.vertices[index + 1] as Vec3,
      )
      if (triangle) triangles.push(triangle)
    }
  }
  if (triangles.length === 0) return null

  return {
    bounds: measurements.measureBoundingBox(part.geometry) as Bounds,
    color: colorFromHex(materialColor(part.material)),
    epsilon: Math.max(measurements.measureEpsilon(part.geometry), Number.EPSILON),
    triangleTree: buildTriangleTree(triangles),
  }
}

function aggregateBounds(parts: readonly PreparedPart[]): Bounds {
  const minimum: [number, number, number] = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
  const maximum: [number, number, number] = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]

  for (const part of parts) {
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis], part.bounds[0][axis])
      maximum[axis] = Math.max(maximum[axis], part.bounds[1][axis])
    }
  }
  return [minimum, maximum]
}

function gridIndexRange(minimum: number, maximum: number, spacing: number) {
  const scale = Math.max(1, Math.abs(minimum), Math.abs(maximum))
  const coordinateTolerance = Number.EPSILON * scale * 16
  const first = Math.ceil((minimum - coordinateTolerance) / spacing)
  const last = Math.floor((maximum + coordinateTolerance) / spacing)
  return { count: Math.max(0, last - first + 1), first, last }
}

function createGridRanges(bounds: Bounds, spacing: number) {
  return [
    gridIndexRange(bounds[0][0], bounds[1][0], spacing),
    gridIndexRange(bounds[0][1], bounds[1][1], spacing),
    gridIndexRange(bounds[0][2], bounds[1][2], spacing),
  ] as const
}

function countGridPoints(bounds: Bounds, spacing: number) {
  return createGridRanges(bounds, spacing).reduce((total, range) => total * range.count, 1)
}

function countGridPointUpperBound(bounds: Bounds, spacing: number) {
  return bounds[0].reduce((total, minimum, axis) => {
    const length = Math.max(0, bounds[1][axis] - minimum)
    const ratio = length / spacing
    const ratioTolerance = Number.EPSILON * Math.max(1, ratio) * 16
    return total * (Math.floor(ratio + ratioTolerance) + 1)
  }, 1)
}

function resolveEffectiveSpacing(
  bounds: Bounds,
  requestedSpacing: number,
  maximumCandidatePoints: number,
) {
  if (countGridPoints(bounds, requestedSpacing) <= maximumCandidatePoints) return requestedSpacing

  let lower = requestedSpacing
  let upper = requestedSpacing * 2
  while (countGridPointUpperBound(bounds, upper) > maximumCandidatePoints) {
    lower = upper
    upper *= 2
  }

  for (let iteration = 0; iteration < 60; iteration += 1) {
    const candidate = (lower + upper) / 2
    if (countGridPointUpperBound(bounds, candidate) > maximumCandidatePoints) {
      lower = candidate
    } else {
      upper = candidate
    }
  }

  return upper * (1 + Number.EPSILON * 8)
}

function pointIsWithinBounds(point: Vec3, bounds: Bounds, epsilon: number) {
  return point.every((coordinate, axis) => (
    coordinate >= bounds[0][axis] - epsilon && coordinate <= bounds[1][axis] + epsilon
  ))
}

function pointIsOnTriangle(point: Vec3, triangle: PreparedTriangle, epsilon: number) {
  const offset = subtract(point, triangle.anchor)
  const planeDistance = dot(offset, triangle.normal)
  if (planeDistance * planeDistance > epsilon * epsilon * triangle.normalLengthSquared) return false

  const edge1LengthSquared = dot(triangle.edge1, triangle.edge1)
  const edge2LengthSquared = dot(triangle.edge2, triangle.edge2)
  const edgeDot = dot(triangle.edge1, triangle.edge2)
  const offsetEdge1Dot = dot(offset, triangle.edge1)
  const offsetEdge2Dot = dot(offset, triangle.edge2)
  const denominator = edge1LengthSquared * edge2LengthSquared - edgeDot * edgeDot
  if (denominator === 0) return false

  const firstWeight = (edge2LengthSquared * offsetEdge1Dot - edgeDot * offsetEdge2Dot) / denominator
  const secondWeight = (edge1LengthSquared * offsetEdge2Dot - edgeDot * offsetEdge1Dot) / denominator
  const weightTolerance = epsilon / triangle.maximumEdgeLength
  return firstWeight >= -weightTolerance
    && secondWeight >= -weightTolerance
    && firstWeight + secondWeight <= 1 + weightTolerance
}

function rayIntersectionDistance(point: Vec3, triangle: PreparedTriangle) {
  const perpendicular = cross(rayDirection, triangle.edge2)
  const determinant = dot(triangle.edge1, perpendicular)
  const determinantTolerance = triangle.maximumEdgeLength * triangle.maximumEdgeLength * 1e-12
  if (Math.abs(determinant) <= determinantTolerance) return null

  const inverseDeterminant = 1 / determinant
  const offset = subtract(point, triangle.anchor)
  const firstWeight = dot(offset, perpendicular) * inverseDeterminant
  if (firstWeight < -1e-10 || firstWeight > 1 + 1e-10) return null

  const perpendicularOffset = cross(offset, triangle.edge1)
  const secondWeight = dot(rayDirection, perpendicularOffset) * inverseDeterminant
  if (secondWeight < -1e-10 || firstWeight + secondWeight > 1 + 1e-10) return null

  return dot(triangle.edge2, perpendicularOffset) * inverseDeterminant
}

function rayIntersectsBounds(point: Vec3, bounds: Bounds, epsilon: number) {
  let minimumDistance = 0
  let maximumDistance = Number.POSITIVE_INFINITY
  for (let axis = 0; axis < 3; axis += 1) {
    let near = (bounds[0][axis] - epsilon - point[axis]) / rayDirection[axis]
    let far = (bounds[1][axis] + epsilon - point[axis]) / rayDirection[axis]
    if (near > far) [near, far] = [far, near]
    minimumDistance = Math.max(minimumDistance, near)
    maximumDistance = Math.min(maximumDistance, far)
    if (maximumDistance < minimumDistance) return false
  }
  return maximumDistance >= 0
}

function pointIsInsidePart(point: Vec3, part: PreparedPart) {
  if (!pointIsWithinBounds(point, part.bounds, part.epsilon)) return false

  const intersections: number[] = []
  const pending = [part.triangleTree]
  while (pending.length > 0) {
    const node = pending.pop()!
    if (!rayIntersectsBounds(point, node.bounds, part.epsilon)) continue
    if (node.children) {
      pending.push(...node.children)
      continue
    }

    for (const triangle of node.triangles ?? []) {
      if (pointIsOnTriangle(point, triangle, part.epsilon)) return true
      const intersection = rayIntersectionDistance(point, triangle)
      if (intersection !== null && intersection > part.epsilon) intersections.push(intersection)
    }
  }
  if (intersections.length === 0) return false

  intersections.sort((left, right) => left - right)
  let distinctIntersections = 1
  for (let index = 1; index < intersections.length; index += 1) {
    if (Math.abs(intersections[index] - intersections[index - 1]) > part.epsilon * 2) {
      distinctIntersections += 1
    }
  }
  return distinctIntersections % 2 === 1
}

export function createMaterialGrid(
  parts: CadScenePart[],
  requestedSpacing: number,
  maximumCandidatePoints = defaultMaximumCandidatePoints,
): MaterialGridResult {
  if (!Number.isFinite(requestedSpacing) || requestedSpacing <= 0) {
    throw new Error('Material Grid spacing must be a positive finite number.')
  }
  if (!Number.isSafeInteger(maximumCandidatePoints) || maximumCandidatePoints <= 0) {
    throw new Error('Material Grid maximum candidate points must be a positive safe integer.')
  }

  const preparedParts = parts.map(preparePart).filter((part): part is PreparedPart => part !== null)
  if (preparedParts.length === 0) {
    return {
      candidatePointCount: 0,
      colors: new Float32Array(),
      effectiveSpacing: requestedSpacing,
      positions: new Float32Array(),
      requestedSpacing,
      visiblePointCount: 0,
    }
  }

  const bounds = aggregateBounds(preparedParts)
  const effectiveSpacing = resolveEffectiveSpacing(bounds, requestedSpacing, maximumCandidatePoints)
  const ranges = createGridRanges(bounds, effectiveSpacing)
  const candidatePointCount = ranges.reduce((total, range) => total * range.count, 1)
  const positions: number[] = []
  const colors: number[] = []

  for (let xIndex = ranges[0].first; xIndex <= ranges[0].last; xIndex += 1) {
    for (let yIndex = ranges[1].first; yIndex <= ranges[1].last; yIndex += 1) {
      for (let zIndex = ranges[2].first; zIndex <= ranges[2].last; zIndex += 1) {
        const point: Vec3 = [
          xIndex === 0 ? 0 : xIndex * effectiveSpacing,
          yIndex === 0 ? 0 : yIndex * effectiveSpacing,
          zIndex === 0 ? 0 : zIndex * effectiveSpacing,
        ]
        let materialPart: PreparedPart | undefined
        for (let partIndex = preparedParts.length - 1; partIndex >= 0; partIndex -= 1) {
          if (pointIsInsidePart(point, preparedParts[partIndex])) {
            materialPart = preparedParts[partIndex]
            break
          }
        }
        if (!materialPart) continue

        positions.push(...point)
        colors.push(...materialPart.color)
      }
    }
  }

  return {
    candidatePointCount,
    colors: new Float32Array(colors),
    effectiveSpacing,
    positions: new Float32Array(positions),
    requestedSpacing,
    visiblePointCount: positions.length / 3,
  }
}
