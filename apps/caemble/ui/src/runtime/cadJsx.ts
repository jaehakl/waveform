import { booleans, primitives, transforms } from '@jscad/modeling'
import { CadModelError, Material } from './core'

const { cuboid, cylinder, sphere } = primitives
const { intersect, subtract, union } = booleans
const { rotate, scale, translate } = transforms
const cadIntersect = intersect as (...geometries: unknown[]) => unknown
const cadRotate = rotate as (angles: [number, number, number], geometry: unknown) => unknown
const cadScale = scale as (factors: [number, number, number], geometry: unknown) => unknown
const cadSubtract = subtract as (...geometries: unknown[]) => unknown
const cadTranslate = translate as (offset: [number, number, number], geometry: unknown) => unknown
const cadUnion = union as (...geometries: unknown[]) => unknown

type GeometryComponent = (props: Record<string, unknown>) => unknown
type CadElementType = string | GeometryComponent

type CadNode = {
  type: CadElementType
  props: Record<string, unknown>
  children: unknown[]
}

type EvaluatedPart = {
  geometry: unknown
  material: Material
}

export type CadScenePart = {
  geometry: unknown
  materialName: string
  displayColor: string
}

function isCadNode(value: unknown): value is CadNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'props' in value &&
    'children' in value
  )
}

function flattenValues(values: unknown[]): unknown[] {
  return values.flat(Infinity).filter((value) => value !== null && value !== undefined && value !== false)
}

function requireChildren(type: string, children: unknown[], minimum: number) {
  if (children.length < minimum) {
    throw new CadModelError(`<${type}> requires at least ${minimum} child geometr${minimum === 1 ? 'y' : 'ies'}.`)
  }
}

function requireSingleChild(type: string, children: unknown[]) {
  if (children.length !== 1) {
    throw new CadModelError(`<${type}> requires exactly one child geometry.`)
  }
}

function normalizeMaterials(value: unknown, inherited: readonly Material[] | undefined) {
  const source = value === undefined ? inherited : value

  if (!Array.isArray(source) || source.length === 0 || source.some((material) => !(material instanceof Material))) {
    throw new CadModelError('Every Geometry requires a non-empty materials array of Material instances.')
  }

  return [...source] as Material[]
}

function requireMatchingMaterial(parts: EvaluatedPart[], operation: string) {
  const material = parts[0]?.material

  if (!material) {
    throw new CadModelError(`<${operation}> did not receive any geometry.`)
  }

  if (parts.some((part) => part.material !== material)) {
    throw new CadModelError(`<${operation}> cannot combine Geometry with different Materials.`)
  }

  return material
}

function combineParts(parts: EvaluatedPart[], operation: string) {
  const material = requireMatchingMaterial(parts, operation)
  const geometry = parts.length === 1 ? parts[0].geometry : cadUnion(...parts.map((part) => part.geometry))
  return { geometry, material }
}

export function Fragment({ children }: { children?: unknown }) {
  return children
}

export function h(type: CadElementType, props: Record<string, unknown> | null, ...children: unknown[]): CadNode {
  return {
    type,
    props: props ?? {},
    children: flattenValues(children),
  }
}

function evaluateNode(
  value: unknown,
  inheritedMaterials: readonly Material[] | undefined,
  materialNames: Map<string, Material>,
): EvaluatedPart[] {
  if (Array.isArray(value)) {
    return flattenValues(value).flatMap((item) => evaluateNode(item, inheritedMaterials, materialNames))
  }

  if (!isCadNode(value)) {
    throw new CadModelError('Geometry functions must return CAD JSX.')
  }

  const { children, props, type } = value

  if (type === Fragment) {
    return children.flatMap((child) => evaluateNode(child, inheritedMaterials, materialNames))
  }

  if (typeof type === 'function') {
    const materials = normalizeMaterials(props.materials, inheritedMaterials)
    const result = type({ ...props, materials, children })
    return evaluateNode(result, materials, materialNames)
  }

  if (type === 'translate' || type === 'rotate' || type === 'scale') {
    requireSingleChild(type, children)
    const parts = evaluateNode(children[0], inheritedMaterials, materialNames)

    return parts.map((part) => {
      if (type === 'translate') {
        const offset = (props.offset as [number, number, number] | undefined) ?? [
          (props.x as number | undefined) ?? 0,
          (props.y as number | undefined) ?? 0,
          (props.z as number | undefined) ?? 0,
        ]
        return { ...part, geometry: cadTranslate(offset, part.geometry) }
      }

      if (type === 'rotate') {
        const angles = (props.angles as [number, number, number] | undefined) ?? [
          (props.x as number | undefined) ?? 0,
          (props.y as number | undefined) ?? 0,
          (props.z as number | undefined) ?? 0,
        ]
        return { ...part, geometry: cadRotate(angles, part.geometry) }
      }

      const factors = (props.factors as [number, number, number] | undefined) ?? [
        (props.x as number | undefined) ?? 1,
        (props.y as number | undefined) ?? 1,
        (props.z as number | undefined) ?? 1,
      ]
      return { ...part, geometry: cadScale(factors, part.geometry) }
    })
  }

  if (type === 'union' || type === 'subtract' || type === 'intersect') {
    requireChildren(type, children, type === 'union' ? 1 : 2)
    const evaluatedChildren = children.map((child) => evaluateNode(child, inheritedMaterials, materialNames))
    const allParts = evaluatedChildren.flat()
    const material = requireMatchingMaterial(allParts, type)

    if (type === 'union') {
      return [{ geometry: cadUnion(...allParts.map((part) => part.geometry)), material }]
    }

    const childGeometries = evaluatedChildren.map((parts) => combineParts(parts, type).geometry)

    if (type === 'subtract') {
      return [{ geometry: cadSubtract(childGeometries[0], ...childGeometries.slice(1)), material }]
    }

    return [{ geometry: cadIntersect(...childGeometries), material }]
  }

  if (type !== 'box' && type !== 'cylinder' && type !== 'sphere') {
    throw new CadModelError(`Unknown CAD element: ${type}`)
  }

  const materials = normalizeMaterials(undefined, inheritedMaterials)
  const material = materials[0]
  const existingMaterial = materialNames.get(material.name)

  if (existingMaterial && existingMaterial !== material) {
    throw new CadModelError(`Material name ${material.name} is used by more than one Material instance.`)
  }

  materialNames.set(material.name, material)

  if (type === 'box') {
    return [{ geometry: cuboid({ size: props.size as [number, number, number] }), material }]
  }

  if (type === 'cylinder') {
    return [
      {
        geometry: cylinder({
          radius: props.radius as number,
          height: props.height as number,
          segments: (props.segments as number | undefined) ?? 32,
        }),
        material,
      },
    ]
  }

  return [
    {
      geometry: sphere({
        radius: props.radius as number,
        segments: (props.segments as number | undefined) ?? 32,
      }),
      material,
    },
  ]
}

export function evaluateCad(root: unknown): CadScenePart[] {
  const parts = evaluateNode(root, undefined, new Map())

  if (parts.length === 0) {
    throw new CadModelError('Structure geometry did not return any CAD geometry.')
  }

  return parts.map((part) => ({
    geometry: part.geometry,
    materialName: part.material.name,
    displayColor: part.material.displayColor,
  }))
}
