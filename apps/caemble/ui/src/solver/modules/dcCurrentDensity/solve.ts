import { geometries, measurements } from '@jscad/modeling'
import type { CadScene, CadScenePart, CadSceneSurface } from '../../../cad/evaluation/types'
import { createSolidPointTester } from '../../../cad/geometry/solid'
import {
  CadModelError,
  isFloatDType,
  type DataDType,
  type DataValueDescriptor,
  type ExperimentRule,
  type RecordedDataRule,
} from '../../../cad/model/core'
import { convertUcumValue } from '../../../cad/model/units'
import type { Vec3 } from '../../../cad/model/types'
import { IDENTITY_CARTESIAN_BASIS } from '../../../quantitykind'
import type { SolverModuleInput } from '../../types'

const maximumVoxelCount = 250_000
const neighborOffsets = [
  [-1, 0, 0],
  [1, 0, 0],
  [0, -1, 0],
  [0, 1, 0],
  [0, 0, -1],
  [0, 0, 1],
] as const

function abortError() {
  const error = new Error('Solver run was cancelled.')
  error.name = 'AbortError'
  return error
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw abortError()
}

async function yieldToWorker(signal: AbortSignal) {
  throwIfAborted(signal)
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  throwIfAborted(signal)
}

function add(left: Vec3, right: Vec3): Vec3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]]
}

function subtract(left: Vec3, right: Vec3): Vec3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]]
}

function scale(vector: Vec3, factor: number): Vec3 {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor]
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

function normalize(vector: Vec3, message: string): Vec3 {
  const length = Math.hypot(...vector)
  if (!Number.isFinite(length) || length <= 0) throw new CadModelError(message)
  return scale(vector, 1 / length)
}

function ruleFor<T extends ExperimentRule>(rules: readonly T[], methodId: string): T {
  return rules.find((rule) => rule.methodId === methodId)!
}

function singleTargetGroup(rule: ExperimentRule, source: 'structure', kind: 'geometry' | 'surface') {
  const prefix = `${source}.${kind}.`
  return rule.target[0].slice(prefix.length)
}

function geometryPart(scene: CadScene, groupName: string) {
  const group = scene.geometryGroups.find((candidate) => candidate.name === groupName)
  if (!group || group.geometryIds.length !== 1) {
    throw new CadModelError(`DC conductor group "${groupName}" must resolve to exactly one Geometry part.`)
  }
  const part = scene.parts.find((candidate) => candidate.id === group.geometryIds[0])
  if (!part) throw new CadModelError(`DC conductor Geometry ${group.geometryIds[0]} is missing.`)
  return part
}

function surfaceForGroup(scene: CadScene, groupName: string) {
  const group = scene.surfaceGroups.find((candidate) => candidate.name === groupName)
  if (!group || group.surfaceIds.length !== 1) {
    throw new CadModelError(`DC terminal group "${groupName}" must resolve to exactly one Surface.`)
  }
  const surfaceId = group.surfaceIds[0]
  for (const part of scene.parts) {
    const surface = part.surfaces.find((candidate) => candidate.id === surfaceId)
    if (surface) return { part, surface }
  }
  throw new CadModelError(`DC terminal Surface ${surfaceId} is missing.`)
}

function planarSurface(part: CadScenePart, surface: CadSceneSurface) {
  if (!geometries.geom3.isA(part.geometry)) {
    throw new CadModelError(`DC conductor ${part.id} must be a 3D solid.`)
  }
  const polygons = geometries.geom3.toPolygons(part.geometry)
  const firstPolygon = polygons[surface.polygonIndices[0]]
  if (!firstPolygon) throw new CadModelError(`Surface ${surface.id} has no polygons.`)
  const plane = geometries.poly3.plane(firstPolygon)
  const tolerance = Math.max(measurements.measureEpsilon(part.geometry) * 10, 1e-9)
  const points: Vec3[] = []
  const weightedCenter: [number, number, number] = [0, 0, 0]
  let totalArea = 0
  surface.polygonIndices.forEach((polygonIndex) => {
    const polygon = polygons[polygonIndex]
    if (!polygon) throw new CadModelError(`Surface ${surface.id} references a missing polygon.`)
    const polygonPoints = geometries.poly3.toPoints(polygon) as Vec3[]
    points.push(...polygonPoints)
    const anchor = polygonPoints[0]
    for (let index = 1; index < polygonPoints.length - 1; index += 1) {
      const second = polygonPoints[index]
      const third = polygonPoints[index + 1]
      const area = Math.hypot(...cross(subtract(second, anchor), subtract(third, anchor))) / 2
      const triangleCenter = scale(add(add(anchor, second), third), 1 / 3)
      weightedCenter[0] += triangleCenter[0] * area
      weightedCenter[1] += triangleCenter[1] * area
      weightedCenter[2] += triangleCenter[2] * area
      totalArea += area
    }
  })
  if (points.length === 0 || !Number.isFinite(totalArea) || totalArea <= 0) {
    throw new CadModelError(`Surface ${surface.id} has no positive-area polygon points.`)
  }
  if (points.some((point) => (
    Math.abs(plane[0] * point[0] + plane[1] * point[1] + plane[2] * point[2] - plane[3]) > tolerance
  ))) {
    throw new CadModelError(`DC terminal Surface ${surface.id} must be planar.`)
  }
  return {
    center: scale(weightedCenter, 1 / totalArea),
    normal: normalize([plane[0], plane[1], plane[2]], `Surface ${surface.id} has an invalid normal.`),
    polygonIndices: surface.polygonIndices,
    surfaceId: surface.id,
  }
}

function voltage(rule: ExperimentRule) {
  return floatParameter(rule.parameters.voltage, `${rule.methodId} parameters.voltage`, 'V')
}

function isFloatValue(value: unknown): value is DataValueDescriptor & { value: number } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && 'dtype' in value && typeof value.dtype === 'string'
    && isFloatDType(value.dtype as DataDType)
    && 'value' in value && typeof value.value === 'number'
}

function floatParameter(value: unknown, name: string, unit: string | undefined) {
  if (!isFloatValue(value) || !Number.isFinite(value.value)) {
    throw new CadModelError(`${name} must be a finite float dtype descriptor.`)
  }
  return convertUcumValue(value.value, value.unit, unit, name)
}

function gridShapeParameter(value: unknown) {
  const shape = (value as { value: [number, number, number] }).value
  if (shape[0] * shape[1] * shape[2] > maximumVoxelCount) {
    throw new CadModelError(`dc.voxel-grid gridShape may contain at most ${maximumVoxelCount} voxels.`)
  }
  return shape
}

function crossSectionPosition(rule: RecordedDataRule) {
  return floatParameter(
    rule.parameters.crossSectionPosition,
    `${rule.methodId} parameters.crossSectionPosition`,
    undefined,
  )
}

function isotropicConductivity(value: unknown) {
  const path = 'Conductor Material electricalConductivity'
  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value)
    || !('dtype' in value)
  ) {
    throw new CadModelError(
      `${path} must use dtype 'float64', omit axes, and provide component shape [3,3].`,
    )
  }
  const descriptor = value as Readonly<Record<string, unknown>>
  if (descriptor.type !== undefined || descriptor.shape !== undefined) {
    throw new CadModelError(`${path} must migrate type/shape to dtype and axes.`)
  }
  if (descriptor.axes !== undefined) {
    throw new CadModelError(`${path}.axes must be omitted for one conductivity tensor.`)
  }
  if (JSON.stringify(descriptor.basis) !== JSON.stringify(IDENTITY_CARTESIAN_BASIS)) {
    throw new CadModelError(`${path}.basis must exactly match the global identity basis.`)
  }
  if (typeof descriptor.unit !== 'string') {
    throw new CadModelError(`${path}.unit must be an applicable ElectricConductivity unit.`)
  }
  const unit = descriptor.unit
  if (!Array.isArray(descriptor.value) || descriptor.value.length !== 3) {
    throw new CadModelError(`${path}.value must have component shape [3,3].`)
  }
  const matrix = descriptor.value.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== 3) {
      throw new CadModelError(`${path}.value must have component shape [3,3].`)
    }
    return row.map((component, columnIndex) => {
      if (typeof component !== 'number' || !Number.isFinite(component)) {
        throw new CadModelError(`${path}.value[${rowIndex}][${columnIndex}] must be finite.`)
      }
      return convertUcumValue(component, unit, 'S/m', path)
    })
  })
  const diagonal = [matrix[0][0], matrix[1][1], matrix[2][2]]
  if (diagonal.some((component) => component <= 0)) {
    throw new CadModelError(`${path} must have positive diagonal components.`)
  }
  const scaleValue = Math.max(...diagonal)
  const relativeIsotropyTolerance = 1e-12 + Number.EPSILON
  if (diagonal.some((component) => (
    Math.abs(component - diagonal[0]) / scaleValue > relativeIsotropyTolerance
  ))) {
    throw new CadModelError(`${path} must be isotropic σI; diagonal components differ beyond relative tolerance 1e-12.`)
  }
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      if (row !== column && Math.abs(matrix[row][column]) / scaleValue > relativeIsotropyTolerance) {
        throw new CadModelError(`${path} must be isotropic σI; off-diagonal components exceed relative tolerance 1e-12.`)
      }
    }
  }
  return (diagonal[0] + diagonal[1] + diagonal[2]) / 3
}

function localPoint(origin: Vec3, axis: Vec3, uAxis: Vec3, vAxis: Vec3, s: number, u: number, v: number) {
  return add(add(add(origin, scale(axis, s)), scale(uAxis, u)), scale(vAxis, v))
}

function createFrame(part: CadScenePart, source: ReturnType<typeof planarSurface>, reference: ReturnType<typeof planarSurface>) {
  if (!geometries.geom3.isA(part.geometry)) throw new CadModelError(`DC conductor ${part.id} must be a 3D solid.`)
  const displacement = subtract(reference.center, source.center)
  const axis = normalize(displacement, 'DC terminal centers must have a finite positive separation.')
  const length = Math.hypot(...displacement)
  const terminalNormalDot = dot(source.normal, reference.normal)
  if (
    terminalNormalDot > -1 + 1e-7
    || dot(source.normal, axis) > -1 + 1e-7
    || dot(reference.normal, axis) < 1 - 1e-7
  ) {
    throw new CadModelError('DC terminal surfaces must be parallel, opposite, and normal to their center axis.')
  }

  const projectedY = subtract([0, 1, 0], scale(axis, dot([0, 1, 0], axis)))
  const projectedZ = subtract([0, 0, 1], scale(axis, dot([0, 0, 1], axis)))
  const uAxis = normalize(
    Math.hypot(...projectedY) > 1e-8 ? projectedY : projectedZ,
    'DC terminal axis could not define a cross-section basis.',
  )
  const vAxis = normalize(cross(axis, uAxis), 'DC terminal axis could not define a cross-section basis.')
  const origin = scale(add(source.center, reference.center), 0.5)
  const polygons = geometries.geom3.toPolygons(part.geometry)
  const vertices = polygons.flatMap((polygon) => geometries.poly3.toPoints(polygon))
  let minimumU = Number.POSITIVE_INFINITY
  let maximumU = Number.NEGATIVE_INFINITY
  let minimumV = Number.POSITIVE_INFINITY
  let maximumV = Number.NEGATIVE_INFINITY
  const minimumS = -length / 2
  const maximumS = length / 2
  const axialTolerance = Math.max(measurements.measureEpsilon(part.geometry) * 20, length * 1e-8)

  vertices.forEach((vertex) => {
    const offset = subtract(vertex as Vec3, origin)
    const s = dot(offset, axis)
    if (s < minimumS - axialTolerance || s > maximumS + axialTolerance) {
      throw new CadModelError('DC conductor Geometry must remain between its two terminal planes.')
    }
    const u = dot(offset, uAxis)
    const v = dot(offset, vAxis)
    minimumU = Math.min(minimumU, u)
    maximumU = Math.max(maximumU, u)
    minimumV = Math.min(minimumV, v)
    maximumV = Math.max(maximumV, v)
  })
  ;[
    { terminal: source, label: 'source' },
    { terminal: reference, label: 'reference' },
  ].forEach(({ terminal, label }) => {
    const selectedPolygons = new Set(terminal.polygonIndices)
    polygons.forEach((polygon, polygonIndex) => {
      const liesOnTerminalPlane = geometries.poly3.toPoints(polygon).every((point) => (
        Math.abs(dot(subtract(point as Vec3, terminal.center), terminal.normal)) <= axialTolerance
      ))
      if (liesOnTerminalPlane && !selectedPolygons.has(polygonIndex)) {
        throw new CadModelError(
          `DC ${label} terminal Surface ${terminal.surfaceId} must cover the complete conductor end plane.`,
        )
      }
    })
  })
  if (
    !Number.isFinite(maximumU - minimumU)
    || !Number.isFinite(maximumV - minimumV)
    || maximumU <= minimumU
    || maximumV <= minimumV
  ) {
    throw new CadModelError('DC conductor cross-section bounds must be finite and positive.')
  }

  return { axis, length, maximumU, maximumV, minimumU, minimumV, origin, uAxis, vAxis }
}

function globalIndex(i: number, j: number, k: number, shape: readonly [number, number, number]) {
  return (i * shape[1] + j) * shape[2] + k
}

async function buildOccupancy(
  part: CadScenePart,
  frame: ReturnType<typeof createFrame>,
  shape: readonly [number, number, number],
  signal: AbortSignal,
) {
  const tester = createSolidPointTester(part.geometry)
  if (!tester) throw new CadModelError(`DC conductor ${part.id} must be a valid 3D solid.`)
  const [axialCount, uCount, vCount] = shape
  const axialSpacing = frame.length / axialCount
  const uSpacing = (frame.maximumU - frame.minimumU) / uCount
  const vSpacing = (frame.maximumV - frame.minimumV) / vCount
  const occupancy = new Uint8Array(axialCount * uCount * vCount)
  let occupiedCount = 0

  for (let i = 0; i < axialCount; i += 1) {
    const s = -frame.length / 2 + (i + 0.5) * axialSpacing
    for (let j = 0; j < uCount; j += 1) {
      const u = frame.minimumU + (j + 0.5) * uSpacing
      for (let k = 0; k < vCount; k += 1) {
        const v = frame.minimumV + (k + 0.5) * vSpacing
        const index = globalIndex(i, j, k, shape)
        if (tester.contains(localPoint(frame.origin, frame.axis, frame.uAxis, frame.vAxis, s, u, v))) {
          occupancy[index] = 1
          occupiedCount += 1
        }
        if ((index + 1) % 4096 === 0) await yieldToWorker(signal)
      }
    }
  }
  if (occupiedCount === 0) throw new CadModelError('DC conductor did not occupy any finite-volume cells.')
  return { axialSpacing, occupancy, occupiedCount, uSpacing, vSpacing }
}

async function validateConnectedDomain(
  occupancy: Uint8Array,
  occupiedCount: number,
  shape: readonly [number, number, number],
  signal: AbortSignal,
) {
  const [axialCount, uCount, vCount] = shape
  const sourceCells: number[] = []
  const referenceCells: number[] = []
  for (let j = 0; j < uCount; j += 1) {
    for (let k = 0; k < vCount; k += 1) {
      const sourceIndex = globalIndex(0, j, k, shape)
      const referenceIndex = globalIndex(axialCount - 1, j, k, shape)
      if (occupancy[sourceIndex]) sourceCells.push(sourceIndex)
      if (occupancy[referenceIndex]) referenceCells.push(referenceIndex)
    }
  }
  if (sourceCells.length === 0 || referenceCells.length === 0) {
    throw new CadModelError('DC grid must contain conductor cells at both terminal planes.')
  }

  const visited = new Uint8Array(occupancy.length)
  const queue = new Int32Array(occupiedCount)
  let head = 0
  let tail = 1
  let visitedCount = 1
  queue[0] = sourceCells[0]
  visited[sourceCells[0]] = 1
  while (head < tail) {
    const index = queue[head]
    head += 1
    const k = index % vCount
    const j = Math.floor(index / vCount) % uCount
    const i = Math.floor(index / (uCount * vCount))
    for (const [di, dj, dk] of neighborOffsets) {
      const ni = i + di
      const nj = j + dj
      const nk = k + dk
      if (ni < 0 || ni >= axialCount || nj < 0 || nj >= uCount || nk < 0 || nk >= vCount) continue
      const neighbor = globalIndex(ni, nj, nk, shape)
      if (!occupancy[neighbor] || visited[neighbor]) continue
      visited[neighbor] = 1
      queue[tail] = neighbor
      tail += 1
      visitedCount += 1
    }
    if (head % 8192 === 0) await yieldToWorker(signal)
  }
  if (visitedCount !== occupiedCount || referenceCells.every((index) => !visited[index])) {
    throw new CadModelError('DC finite-volume cells must form one connected domain between both terminals.')
  }
}

function createLinearSystem(
  occupancy: Uint8Array,
  shape: readonly [number, number, number],
  spacings: readonly [number, number, number],
  sourceVoltage: number,
  referenceVoltage: number,
) {
  const activeIndex = new Int32Array(occupancy.length)
  activeIndex.fill(-1)
  const activeCells = new Int32Array(occupancy.reduce((count, occupied) => count + occupied, 0))
  let activeCount = 0
  occupancy.forEach((occupied, index) => {
    if (!occupied) return
    activeIndex[index] = activeCount
    activeCells[activeCount] = index
    activeCount += 1
  })

  const [axialCount, uCount, vCount] = shape
  const weights = spacings.map((spacing) => 1 / (spacing * spacing))
  const neighborWeights = [weights[0], weights[0], weights[1], weights[1], weights[2], weights[2]]
  const neighbors = new Int32Array(activeCount * neighborOffsets.length)
  neighbors.fill(-1)
  const diagonal = new Float64Array(activeCount)
  const rightHandSide = new Float64Array(activeCount)
  const initial = new Float64Array(activeCount)

  activeCells.forEach((index, active) => {
    const k = index % vCount
    const j = Math.floor(index / vCount) % uCount
    const i = Math.floor(index / (uCount * vCount))
    initial[active] = sourceVoltage + (referenceVoltage - sourceVoltage) * ((i + 0.5) / axialCount)
    neighborOffsets.forEach(([di, dj, dk], neighborSlot) => {
      const ni = i + di
      const nj = j + dj
      const nk = k + dk
      if (ni < 0 || ni >= axialCount || nj < 0 || nj >= uCount || nk < 0 || nk >= vCount) return
      const neighborGlobal = globalIndex(ni, nj, nk, shape)
      if (!occupancy[neighborGlobal]) return
      diagonal[active] += neighborWeights[neighborSlot]
      neighbors[active * neighborOffsets.length + neighborSlot] = activeIndex[neighborGlobal]
    })
    if (i === 0) {
      diagonal[active] += 2 * weights[0]
      rightHandSide[active] += 2 * weights[0] * sourceVoltage
    }
    if (i === axialCount - 1) {
      diagonal[active] += 2 * weights[0]
      rightHandSide[active] += 2 * weights[0] * referenceVoltage
    }
    if (!Number.isFinite(diagonal[active]) || diagonal[active] <= 0) {
      throw new CadModelError('DC finite-volume matrix contains an isolated cell.')
    }
  })

  return { activeCells, activeIndex, diagonal, initial, neighborWeights, neighbors, rightHandSide }
}

function applyMatrix(
  input: Float64Array,
  output: Float64Array,
  diagonal: Float64Array,
  neighbors: Int32Array,
  neighborWeights: readonly number[],
) {
  for (let index = 0; index < input.length; index += 1) {
    let value = diagonal[index] * input[index]
    for (let slot = 0; slot < neighborOffsets.length; slot += 1) {
      const neighbor = neighbors[index * neighborOffsets.length + slot]
      if (neighbor >= 0) value -= neighborWeights[slot] * input[neighbor]
    }
    output[index] = value
  }
}

async function solvePcg(
  system: ReturnType<typeof createLinearSystem>,
  relativeTolerance: number,
  maxIterations: number,
  signal: AbortSignal,
) {
  const { diagonal, initial, neighbors, neighborWeights, rightHandSide } = system
  const solution = initial
  const residual = new Float64Array(solution.length)
  const preconditioned = new Float64Array(solution.length)
  const direction = new Float64Array(solution.length)
  const product = new Float64Array(solution.length)
  applyMatrix(solution, product, diagonal, neighbors, neighborWeights)
  let rightHandSideNormSquared = 0
  let residualNormSquared = 0
  let residualPreconditioned = 0
  for (let index = 0; index < solution.length; index += 1) {
    residual[index] = rightHandSide[index] - product[index]
    preconditioned[index] = residual[index] / diagonal[index]
    direction[index] = preconditioned[index]
    rightHandSideNormSquared += rightHandSide[index] ** 2
    residualNormSquared += residual[index] ** 2
    residualPreconditioned += residual[index] * preconditioned[index]
  }
  const rightHandSideNorm = Math.sqrt(rightHandSideNormSquared) || 1
  let relativeResidual = Math.sqrt(residualNormSquared) / rightHandSideNorm
  if (relativeResidual <= relativeTolerance) return solution

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    throwIfAborted(signal)
    applyMatrix(direction, product, diagonal, neighbors, neighborWeights)
    let denominator = 0
    for (let index = 0; index < solution.length; index += 1) {
      denominator += direction[index] * product[index]
    }
    if (!Number.isFinite(denominator) || denominator <= 0) {
      throw new CadModelError('DC finite-volume matrix is not positive definite.')
    }
    const alpha = residualPreconditioned / denominator
    residualNormSquared = 0
    for (let index = 0; index < solution.length; index += 1) {
      solution[index] += alpha * direction[index]
      residual[index] -= alpha * product[index]
      residualNormSquared += residual[index] ** 2
    }
    relativeResidual = Math.sqrt(residualNormSquared) / rightHandSideNorm
    if (relativeResidual <= relativeTolerance) return solution

    let nextResidualPreconditioned = 0
    for (let index = 0; index < solution.length; index += 1) {
      preconditioned[index] = residual[index] / diagonal[index]
      nextResidualPreconditioned += residual[index] * preconditioned[index]
    }
    const beta = nextResidualPreconditioned / residualPreconditioned
    for (let index = 0; index < solution.length; index += 1) {
      direction[index] = preconditioned[index] + beta * direction[index]
    }
    residualPreconditioned = nextResidualPreconditioned
    if (iteration % 8 === 0) await yieldToWorker(signal)
  }

  throw new CadModelError(
    `DC finite-volume solve did not converge within ${maxIterations} iterations (relative residual ${relativeResidual}).`,
  )
}

function crossSectionResult(
  solution: Float64Array,
  activeIndex: Int32Array,
  occupancy: Uint8Array,
  shape: readonly [number, number, number],
  frame: ReturnType<typeof createFrame>,
  spacings: readonly [number, number, number],
  crossSectionPosition: number,
  sceneLengthToMeters: number,
  conductivity: number,
  sourceVoltage: number,
  referenceVoltage: number,
) {
  const [axialCount, uCount, vCount] = shape
  const [axialSpacing, uSpacing, vSpacing] = spacings
  const faceIndex = Math.min(axialCount, Math.max(0, Math.round(crossSectionPosition * axialCount)))
  const axialValues = Array.from({ length: vCount }, (_value, row) => {
    const k = vCount - row - 1
    return Array.from({ length: uCount }, (_columnValue, j) => {
      if (faceIndex === 0) {
        const rightGlobal = globalIndex(0, j, k, shape)
        if (!occupancy[rightGlobal]) return 0
        const currentDensity = 2 * conductivity * (sourceVoltage - solution[activeIndex[rightGlobal]])
          / (axialSpacing * sceneLengthToMeters)
        return Object.is(currentDensity, -0) ? 0 : currentDensity
      }
      if (faceIndex === axialCount) {
        const leftGlobal = globalIndex(axialCount - 1, j, k, shape)
        if (!occupancy[leftGlobal]) return 0
        const currentDensity = 2 * conductivity * (solution[activeIndex[leftGlobal]] - referenceVoltage)
          / (axialSpacing * sceneLengthToMeters)
        return Object.is(currentDensity, -0) ? 0 : currentDensity
      }
      const leftGlobal = globalIndex(faceIndex - 1, j, k, shape)
      const rightGlobal = globalIndex(faceIndex, j, k, shape)
      if (!occupancy[leftGlobal] || !occupancy[rightGlobal]) return 0
      const left = activeIndex[leftGlobal]
      const right = activeIndex[rightGlobal]
      const currentDensity = conductivity * (solution[left] - solution[right])
        / (axialSpacing * sceneLengthToMeters)
      return Object.is(currentDensity, -0) ? 0 : currentDensity
    })
  })
  const totalCurrent = Math.abs(axialValues.reduce((sum, row) => (
    sum + row.reduce((rowSum, value) => rowSum + value, 0)
  ), 0) * uSpacing * vSpacing * sceneLengthToMeters ** 2)
  const uTicks = Array.from({ length: uCount }, (_value, j) => (
    (frame.minimumU + (j + 0.5) * uSpacing) * sceneLengthToMeters
  ))
  const vTicks = Array.from({ length: vCount }, (_value, row) => {
    const k = vCount - row - 1
    return (frame.minimumV + (k + 0.5) * vSpacing) * sceneLengthToMeters
  })
  const values = axialValues.map((row) => row.map((value) => scale(frame.axis, value)))
  return { totalCurrent, uTicks, values, vTicks }
}

export async function solveDcCurrentDensity(input: SolverModuleInput, signal: AbortSignal) {
  const { parameters } = input.experiment.solver
  const relativeTolerance = floatParameter(parameters.relativeTolerance, 'dc-current-density relativeTolerance', undefined)
  const maxIterations = parameters.maxIterations as number
  const gridRule = ruleFor(input.experiment.rules.initializations, 'dc.voxel-grid')
  const sourceRule = ruleFor(input.experiment.rules.boundaryConditions, 'dc.source-potential')
  const referenceRule = ruleFor(input.experiment.rules.boundaryConditions, 'dc.reference-potential')
  const densityRule = ruleFor(input.experiment.rules.recordedData, 'dc.current-density')
  const totalCurrentRule = ruleFor(input.experiment.rules.recordedData, 'dc.total-current')

  const gridGroup = singleTargetGroup(gridRule, 'structure', 'geometry')
  const densityGroup = singleTargetGroup(densityRule, 'structure', 'geometry')
  const totalCurrentGroup = singleTargetGroup(totalCurrentRule, 'structure', 'geometry')
  if (gridGroup !== densityGroup || densityGroup !== totalCurrentGroup) {
    throw new CadModelError('DC voxel grid and both recorded-data rules must target the same conductor group.')
  }
  const gridShape = gridShapeParameter(gridRule.parameters.gridShape)
  const densityCrossSectionPosition = crossSectionPosition(densityRule)
  const totalCurrentCrossSectionPosition = crossSectionPosition(totalCurrentRule)
  const positionDifference = Math.abs(densityCrossSectionPosition - totalCurrentCrossSectionPosition)
  const positionTolerance = 1e-12 * Math.max(
    1,
    Math.abs(densityCrossSectionPosition),
    Math.abs(totalCurrentCrossSectionPosition),
  )
  if (positionDifference > positionTolerance) {
    throw new CadModelError('DC recorded-data rules must use the same crossSectionPosition.')
  }
  if (input.structure.scene.parts.length !== 1) {
    throw new CadModelError('dc-current-density@2.0.0 supports exactly one Structure Geometry part.')
  }
  const conductor = geometryPart(input.structure.scene, densityGroup)
  const source = surfaceForGroup(
    input.structure.scene,
    singleTargetGroup(sourceRule, 'structure', 'surface'),
  )
  const reference = surfaceForGroup(
    input.structure.scene,
    singleTargetGroup(referenceRule, 'structure', 'surface'),
  )
  if (source.part.id !== conductor.id || reference.part.id !== conductor.id) {
    throw new CadModelError('Both DC terminal surfaces must belong to the recorded conductor Geometry.')
  }
  if (source.surface.id === reference.surface.id) {
    throw new CadModelError('DC source and reference potentials must target different terminal surfaces.')
  }

  const conductivitySi = isotropicConductivity(
    conductor.material!.variables.electricalConductivity,
  )
  const sceneLengthToMeters = convertUcumValue(
    1,
    input.structure.scene.lengthUnit,
    'm',
    'DC Structure lengthUnit',
  )

  const sourceSurface = planarSurface(source.part, source.surface)
  const referenceSurface = planarSurface(reference.part, reference.surface)
  const frame = createFrame(conductor, sourceSurface, referenceSurface)
  const grid = await buildOccupancy(conductor, frame, gridShape, signal)
  await validateConnectedDomain(grid.occupancy, grid.occupiedCount, gridShape, signal)
  const sourceVoltage = voltage(sourceRule)
  const referenceVoltage = voltage(referenceRule)
  const system = createLinearSystem(
    grid.occupancy,
    gridShape,
    [grid.axialSpacing, grid.uSpacing, grid.vSpacing],
    sourceVoltage,
    referenceVoltage,
  )
  const solution = await solvePcg(system, relativeTolerance, maxIterations, signal)
  const result = crossSectionResult(
    solution,
    system.activeIndex,
    grid.occupancy,
    gridShape,
    frame,
    [grid.axialSpacing, grid.uSpacing, grid.vSpacing],
    densityCrossSectionPosition,
    sceneLengthToMeters,
    conductivitySi,
    sourceVoltage,
    referenceVoltage,
  )

  const densityScale = convertUcumValue(1, 'A/m2', densityRule.result.unit, 'Current density result unit')
  const totalCurrentScale = convertUcumValue(1, 'A', totalCurrentRule.result.unit, 'Total current result unit')
  const vScale = convertUcumValue(1, 'm', densityRule.result.axes?.[0].unit, 'Current density v-axis unit')
  const uScale = convertUcumValue(1, 'm', densityRule.result.axes?.[1].unit, 'Current density u-axis unit')

  return {
    [densityRule.label]: {
      value: result.values.map((row) => row.map((vector) => vector.map((value) => value * densityScale))),
      axes: [
        { ticks: result.vTicks.map((tick) => tick * vScale) },
        { ticks: result.uTicks.map((tick) => tick * uScale) },
      ],
    },
    [totalCurrentRule.label]: { value: result.totalCurrent * totalCurrentScale },
  }
}

