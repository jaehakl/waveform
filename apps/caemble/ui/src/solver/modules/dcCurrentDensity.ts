import { geometries, measurements } from '@jscad/modeling'
import type { CadScene, CadScenePart, CadSceneSurface } from '../../cad/evaluation/types'
import {
  CadModelError,
  type ExperimentRule,
  type RecordedDataRule,
} from '../../cad/model/core'
import type { SolverModule, SolverModuleInput } from '../types'

function singleRule<T extends ExperimentRule>(rules: readonly T[], methodId: string): T {
  const matches = rules.filter((rule) => rule.methodId === methodId)
  if (matches.length !== 1) {
    throw new CadModelError(`DC current density solver requires exactly one ${methodId} rule.`)
  }
  return matches[0]
}

function singleTargetGroup(rule: ExperimentRule, source: 'structure', kind: 'geometry' | 'surface') {
  if (rule.target.length !== 1) {
    throw new CadModelError(`${rule.methodId} must target exactly one ${source} ${kind} group.`)
  }
  const prefix = `${source}.${kind}.`
  if (!rule.target[0].startsWith(prefix)) {
    throw new CadModelError(`${rule.methodId} must target one ${source} ${kind} group.`)
  }
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

function surfaceCenter(part: CadScenePart, surface: CadSceneSurface) {
  if (!geometries.geom3.isA(part.geometry)) {
    throw new CadModelError(`DC conductor ${part.id} must be a 3D solid.`)
  }
  const polygons = geometries.geom3.toPolygons(part.geometry)
  const points = surface.polygonIndices.flatMap((polygonIndex) => {
    const polygon = polygons[polygonIndex]
    if (!polygon) throw new CadModelError(`Surface ${surface.id} references a missing polygon.`)
    return geometries.poly3.toPoints(polygon)
  })
  if (points.length === 0) throw new CadModelError(`Surface ${surface.id} has no polygon points.`)

  const sum = points.reduce<[number, number, number]>((center, point) => [
    center[0] + point[0],
    center[1] + point[1],
    center[2] + point[2],
  ], [0, 0, 0])
  return sum.map((value) => value / points.length) as [number, number, number]
}

function planarSurfaceNormal(part: CadScenePart, surface: CadSceneSurface) {
  if (!geometries.geom3.isA(part.geometry)) {
    throw new CadModelError(`DC conductor ${part.id} must be a 3D solid.`)
  }
  const polygons = geometries.geom3.toPolygons(part.geometry)
  const firstPolygon = polygons[surface.polygonIndices[0]]
  if (!firstPolygon) throw new CadModelError(`Surface ${surface.id} has no polygons.`)
  const plane = geometries.poly3.plane(firstPolygon)
  const tolerance = Math.max(measurements.measureEpsilon(part.geometry) * 10, 1e-9)
  const planar = surface.polygonIndices.every((polygonIndex) => {
    const polygon = polygons[polygonIndex]
    return polygon && geometries.poly3.toPoints(polygon).every((point) => (
      Math.abs(plane[0] * point[0] + plane[1] * point[1] + plane[2] * point[2] - plane[3]) <= tolerance
    ))
  })
  if (!planar) throw new CadModelError(`DC terminal Surface ${surface.id} must be planar.`)
  return plane.slice(0, 3) as [number, number, number]
}

function voltage(rule: ExperimentRule) {
  const value = rule.parameters.voltage
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CadModelError(`${rule.methodId} parameters.voltage must be a finite number.`)
  }
  return value
}

function assertRecordedRule(
  rule: RecordedDataRule,
  dimension: number,
  shape: readonly number[],
  axes: readonly Readonly<{ name?: string; ticks?: readonly (number | string)[] }>[],
) {
  if (
    rule.result.dimension !== dimension
    || JSON.stringify(rule.result.shape) !== JSON.stringify(shape)
    || rule.result.dtype !== 'float64'
    || JSON.stringify(rule.result.axes ?? []) !== JSON.stringify(axes)
  ) {
    throw new CadModelError(
      `${rule.methodId} has an unsupported RecordedData schema for dc-current-density@1.0.0.`,
    )
  }
}

function solveDcCurrentDensity(input: SolverModuleInput) {
  const { parameters } = input.experiment.solver
  const lengthScaleToMeters = parameters.lengthScaleToMeters
  const conductivityVariable = parameters.conductivityVariable
  if (typeof lengthScaleToMeters !== 'number' || !Number.isFinite(lengthScaleToMeters) || lengthScaleToMeters <= 0) {
    throw new CadModelError('dc-current-density lengthScaleToMeters must be a finite positive number.')
  }
  if (typeof conductivityVariable !== 'string' || !conductivityVariable.trim()) {
    throw new CadModelError('dc-current-density conductivityVariable must be a non-empty string.')
  }
  if (
    input.experiment.rules.initialConditions.length !== 0
    || input.experiment.rules.boundaryConditions.length !== 2
    || input.experiment.rules.recordedData.length !== 2
  ) {
    throw new CadModelError(
      'dc-current-density@1.0.0 supports no initial conditions, two potential rules, and two recorded-data rules.',
    )
  }

  const sourceRule = singleRule(input.experiment.rules.boundaryConditions, 'dc.source-potential')
  const referenceRule = singleRule(input.experiment.rules.boundaryConditions, 'dc.reference-potential')
  const densityRule = singleRule(input.experiment.rules.recordedData, 'dc.current-density')
  const totalCurrentRule = singleRule(input.experiment.rules.recordedData, 'dc.total-current')
  assertRecordedRule(densityRule, 1, [3], [{ name: 'component', ticks: ['x', 'y', 'z'] }])
  assertRecordedRule(totalCurrentRule, 0, [], [])

  const densityGroup = singleTargetGroup(densityRule, 'structure', 'geometry')
  const totalCurrentGroup = singleTargetGroup(totalCurrentRule, 'structure', 'geometry')
  if (densityGroup !== totalCurrentGroup) {
    throw new CadModelError('DC current density and total current rules must target the same conductor group.')
  }
  if (input.structure.scene.parts.length !== 1) {
    throw new CadModelError('dc-current-density@1.0.0 supports exactly one Structure Geometry part.')
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

  const conductivity = conductor.material?.variables[conductivityVariable]
  if (typeof conductivity !== 'number' || !Number.isFinite(conductivity) || conductivity <= 0) {
    throw new CadModelError(
      `Conductor Material ${conductivityVariable} must be a finite positive number in S/m.`,
    )
  }

  const sourceCenter = surfaceCenter(source.part, source.surface)
  const referenceCenter = surfaceCenter(reference.part, reference.surface)
  const sourceNormal = planarSurfaceNormal(source.part, source.surface)
  const referenceNormal = planarSurfaceNormal(reference.part, reference.surface)
  const displacement = referenceCenter.map((value, index) => value - sourceCenter[index]) as [number, number, number]
  const lengthInGeometryUnits = Math.hypot(...displacement)
  if (!Number.isFinite(lengthInGeometryUnits) || lengthInGeometryUnits <= 0) {
    throw new CadModelError('DC terminal centers must have a finite positive separation.')
  }
  const volumeInGeometryUnits = measurements.measureVolume(conductor.geometry)
  if (!Number.isFinite(volumeInGeometryUnits) || volumeInGeometryUnits <= 0) {
    throw new CadModelError('DC conductor volume must be finite and positive.')
  }

  const direction = displacement.map((value) => value / lengthInGeometryUnits)
  const terminalNormalDot = sourceNormal.reduce((sum, value, index) => sum + value * referenceNormal[index], 0)
  const directionNormalDot = direction.reduce((sum, value, index) => sum + value * referenceNormal[index], 0)
  if (terminalNormalDot > -1 + 1e-8 || Math.abs(Math.abs(directionNormalDot) - 1) > 1e-8) {
    throw new CadModelError('DC terminal surfaces must be parallel, opposite, and normal to their center axis.')
  }
  const lengthInMeters = lengthInGeometryUnits * lengthScaleToMeters
  const currentDensity = conductivity * (voltage(sourceRule) - voltage(referenceRule)) / lengthInMeters
  const currentDensityVector = direction.map((value) => {
    const component = value * currentDensity
    return Object.is(component, -0) ? 0 : component
  })
  const areaInSquareMeters = volumeInGeometryUnits * lengthScaleToMeters ** 3 / lengthInMeters
  const totalCurrent = Math.abs(currentDensity) * areaInSquareMeters

  return Object.freeze({
    [densityRule.label]: Object.freeze({ value: Object.freeze(currentDensityVector) }),
    [totalCurrentRule.label]: Object.freeze({ value: totalCurrent }),
  })
}

export const dcCurrentDensitySolver = Object.freeze({
  name: 'dc-current-density',
  version: '1.0.0',
  async solve(input, signal) {
    if (signal.aborted) throw new DOMException('Solver run was cancelled.', 'AbortError')
    const result = solveDcCurrentDensity(input)
    if (signal.aborted) throw new DOMException('Solver run was cancelled.', 'AbortError')
    return result
  },
}) satisfies SolverModule
