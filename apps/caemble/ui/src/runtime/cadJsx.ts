import { booleans, primitives, transforms } from '@jscad/modeling'

const { cuboid, cylinder, sphere } = primitives
const { intersect, subtract, union } = booleans
const { rotate, scale, translate } = transforms
const cadIntersect = intersect as (...geometries: unknown[]) => unknown
const cadRotate = rotate as (angles: [number, number, number], geometry: unknown) => unknown
const cadScale = scale as (factors: [number, number, number], geometry: unknown) => unknown
const cadSubtract = subtract as (...geometries: unknown[]) => unknown
const cadTranslate = translate as (offset: [number, number, number], geometry: unknown) => unknown
const cadUnion = union as (...geometries: unknown[]) => unknown

type CadElementType = string | ((props: Record<string, unknown>) => unknown)

export class CadModelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CadModelError'
  }
}

function flattenChildren(children: unknown[]): unknown[] {
  return children.flat(Infinity).filter(Boolean)
}

function firstChild(type: string, children: unknown[]) {
  const child = children[0]

  if (!child) {
    throw new CadModelError(`<${type}> requires one child geometry.`)
  }

  return child
}

export function Fragment(props: { children?: unknown }) {
  return props.children
}

export function h(type: CadElementType, props: Record<string, unknown> | null, ...rawChildren: unknown[]) {
  const safeProps = props ?? {}
  const children = flattenChildren(rawChildren)

  if (typeof type === 'function') {
    return type({ ...safeProps, children })
  }

  switch (type) {
    case 'box':
      return cuboid({ size: safeProps.size as [number, number, number] })

    case 'cylinder':
      return cylinder({
        radius: safeProps.radius as number,
        height: safeProps.height as number,
        segments: (safeProps.segments as number | undefined) ?? 32,
      })

    case 'sphere':
      return sphere({
        radius: safeProps.radius as number,
        segments: (safeProps.segments as number | undefined) ?? 32,
      })

    case 'translate':
      return cadTranslate(
        (safeProps.offset as [number, number, number] | undefined) ?? [
          (safeProps.x as number | undefined) ?? 0,
          (safeProps.y as number | undefined) ?? 0,
          (safeProps.z as number | undefined) ?? 0,
        ],
        firstChild(type, children),
      )

    case 'rotate':
      return cadRotate(
        (safeProps.angles as [number, number, number] | undefined) ?? [
          (safeProps.x as number | undefined) ?? 0,
          (safeProps.y as number | undefined) ?? 0,
          (safeProps.z as number | undefined) ?? 0,
        ],
        firstChild(type, children),
      )

    case 'scale':
      return cadScale(
        (safeProps.factors as [number, number, number] | undefined) ?? [
          (safeProps.x as number | undefined) ?? 1,
          (safeProps.y as number | undefined) ?? 1,
          (safeProps.z as number | undefined) ?? 1,
        ],
        firstChild(type, children),
      )

    case 'union':
      return cadUnion(...children)

    case 'subtract':
      if (children.length < 2) {
        throw new CadModelError('<subtract> requires a base geometry and at least one cutter geometry.')
      }

      return cadSubtract(children[0], ...children.slice(1))

    case 'intersect':
      return cadIntersect(...children)

    default:
      throw new CadModelError(`Unknown CAD element: ${type}`)
  }
}
