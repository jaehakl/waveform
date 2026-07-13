import { booleans, maths, primitives, transforms } from '@jscad/modeling'
import { CadModelError, Material } from './core'

const { cuboid, cylinder, sphere } = primitives
const { intersect, subtract, union } = booleans
const { scale, transform, translate } = transforms
const cadIntersect = intersect as (...geometries: unknown[]) => unknown
const cadCreateMatrix = maths.mat4.create as () => unknown
const cadFromRotation = maths.mat4.fromRotation as (
  matrix: unknown,
  angle: number,
  axis: [number, number, number],
) => unknown
const cadScale = scale as (factors: [number, number, number], geometry: unknown) => unknown
const cadSubtract = subtract as (...geometries: unknown[]) => unknown
const cadTransform = transform as (matrix: unknown, geometry: unknown) => unknown
const cadTranslate = translate as (offset: [number, number, number], geometry: unknown) => unknown
const cadUnion = union as (...geometries: unknown[]) => unknown

type Vec3 = readonly [number, number, number]
type Rotation = Readonly<{ axis: Vec3; angle: number }>
const origin = Object.freeze([0, 0, 0] as [number, number, number])
const unitScale = Object.freeze([1, 1, 1] as [number, number, number])
const standardAxes = Object.freeze([
  Object.freeze([1, 0, 0] as [number, number, number]),
  Object.freeze([0, 1, 0] as [number, number, number]),
  Object.freeze([0, 0, 1] as [number, number, number]),
] as [Vec3, Vec3, Vec3])

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function flattenValues(values: unknown[]): unknown[] {
  return values.flat(Infinity).filter((value) => value !== null && value !== undefined && value !== false)
}

function requireChildren(type: string, children: unknown[], minimum: number) {
  if (children.length < minimum) {
    throw new CadModelError(`<${type}> requires at least ${minimum} child geometr${minimum === 1 ? 'y' : 'ies'}.`)
  }
}

function resolveMaterials(value: unknown, inherited: readonly Material[] | undefined) {
  if (value === undefined) {
    return inherited === undefined ? undefined : [...inherited]
  }

  if (!Array.isArray(value) || value.length === 0 || value.some((material) => !(material instanceof Material))) {
    throw new CadModelError('Geometry materials must be a non-empty array of Material instances.')
  }

  return [...value] as Material[]
}

function normalizeVec3(value: unknown, path: string): Vec3 {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value.some((coordinate) => typeof coordinate !== 'number' || !Number.isFinite(coordinate))
  ) {
    throw new CadModelError(`${path} must be an array of exactly three finite numbers.`)
  }

  return Object.freeze([value[0], value[1], value[2]] as [number, number, number])
}

function normalizePos(value: unknown, owner: string) {
  return value === undefined ? origin : normalizeVec3(value, `${owner} pos`)
}

function normalizeScale(value: unknown, owner: string) {
  return value === undefined ? unitScale : normalizeVec3(value, `${owner} scale`)
}

function normalizeDirection(value: unknown, path: string) {
  const direction = normalizeVec3(value, path)
  const length = Math.hypot(...direction)

  if (length === 0) {
    throw new CadModelError(`${path} must not be the zero vector.`)
  }

  return Object.freeze(direction.map((coordinate) => coordinate / length) as [number, number, number])
}

function normalizeRotation(value: unknown, owner: string): Rotation | undefined {
  if (value === undefined) return undefined

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CadModelError(`${owner} rotate must be an object with axis and angle.`)
  }

  const input = value as Record<string, unknown>
  const axis = normalizeDirection(input.axis, `${owner} rotate.axis`)

  if (typeof input.angle !== 'number' || !Number.isFinite(input.angle)) {
    throw new CadModelError(`${owner} rotate.angle must be a finite number in radians.`)
  }

  return Object.freeze({
    axis,
    angle: input.angle,
  })
}

function normalizeArrayShape(value: unknown) {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value.some((size) => !Number.isSafeInteger(size) || size <= 0)
  ) {
    throw new CadModelError('<array> shape must be an array of exactly three positive integers.')
  }

  return Object.freeze([value[0], value[1], value[2]] as [number, number, number])
}

function normalizeArrayPeriod(value: unknown, shape: Vec3) {
  const period = normalizeVec3(value, '<array> period')

  period.forEach((spacing, axis) => {
    if (spacing < 0 || (shape[axis] > 1 && spacing === 0)) {
      throw new CadModelError(
        `<array> period[${axis}] must be positive when shape[${axis}] is greater than one, and non-negative otherwise.`,
      )
    }
  })

  return period
}

function normalizeArrayAxes(value: unknown): readonly [Vec3, Vec3, Vec3] {
  if (value === undefined) return standardAxes

  if (!isRecord(value)) {
    throw new CadModelError('<array> axes must be an object with x, y, and z direction vectors.')
  }

  return Object.freeze([
    normalizeDirection(value.x, '<array> axes.x'),
    normalizeDirection(value.y, '<array> axes.y'),
    normalizeDirection(value.z, '<array> axes.z'),
  ])
}

function validateDenseTensor(value: unknown, path: string): number[] {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new CadModelError(`${path} must contain only finite numbers.`)
    }

    return []
  }

  if (!Array.isArray(value) || value.length === 0) {
    throw new CadModelError(`${path} must be a non-empty dense tensor of finite numbers.`)
  }

  const childShape = validateDenseTensor(value[0], `${path}[0]`)

  value.slice(1).forEach((item, index) => {
    const itemShape = validateDenseTensor(item, `${path}[${index + 1}]`)
    if (itemShape.length !== childShape.length || itemShape.some((size, axis) => size !== childShape[axis])) {
      throw new CadModelError(`${path} must be a dense rectangular tensor.`)
    }
  })

  return [value.length, ...childShape]
}

function requireTensorShape(value: unknown, expected: readonly number[], path: string) {
  const actual = validateDenseTensor(value, path)

  if (actual.length !== expected.length || actual.some((size, axis) => size !== expected[axis])) {
    throw new CadModelError(`${path} must have shape [${expected.join(', ')}].`)
  }
}

function requireTensorPrefix(value: unknown, expected: Vec3, path: string) {
  const actual = validateDenseTensor(value, path)

  if (actual.length < 3 || expected.some((size, axis) => actual[axis] !== size)) {
    throw new CadModelError(`${path} must start with shape [${expected.join(', ')}].`)
  }
}

function normalizeArrayInject(value: unknown, shape: Vec3) {
  if (value === undefined) return {}

  if (!isRecord(value)) {
    throw new CadModelError('<array> inject must be an object of Geometry attribute tensors.')
  }

  Object.entries(value).forEach(([key, tensor]) => {
    const path = `<array> inject.${key}`

    if (key === 'materials' || key === 'children') {
      throw new CadModelError(`${path} is not supported.`)
    }

    if (key === 'rotate') {
      if (!isRecord(tensor)) {
        throw new CadModelError(`${path} must be an object with axis and angle tensors.`)
      }

      requireTensorShape(tensor.axis, [...shape, 3], `${path}.axis`)
      requireTensorShape(tensor.angle, shape, `${path}.angle`)
      return
    }

    if (key === 'pos' || key === 'scale') {
      requireTensorShape(tensor, [...shape, 3], path)
      return
    }

    requireTensorPrefix(tensor, shape, path)
  })

  return value
}

function tensorCell(value: unknown, x: number, y: number, z: number) {
  return (((value as unknown[])[x] as unknown[])[y] as unknown[])[z]
}

function injectedPropsAt(inject: Record<string, unknown>, x: number, y: number, z: number) {
  const props: Record<string, unknown> = {}

  Object.entries(inject).forEach(([key, tensor]) => {
    if (key === 'rotate') {
      const rotation = tensor as Record<string, unknown>
      props.rotate = {
        axis: tensorCell(rotation.axis, x, y, z),
        angle: tensorCell(rotation.angle, x, y, z),
      }
      return
    }

    props[key] = tensorCell(tensor, x, y, z)
  })

  return props
}

function applyTransforms(parts: EvaluatedPart[], scaleValue: Vec3, rotation: Rotation | undefined, pos: Vec3) {
  const shouldScale = scaleValue.some((factor) => factor !== 1)
  const rotationMatrix =
    rotation && rotation.angle !== 0
      ? cadFromRotation(cadCreateMatrix(), rotation.angle, [...rotation.axis])
      : undefined
  const shouldTranslate = pos.some((coordinate) => coordinate !== 0)

  if (!shouldScale && rotationMatrix === undefined && !shouldTranslate) return parts

  return parts.map((part) => {
    let geometry = part.geometry
    if (shouldScale) geometry = cadScale([...scaleValue], geometry)
    if (rotationMatrix !== undefined) geometry = cadTransform(rotationMatrix, geometry)
    if (shouldTranslate) geometry = cadTranslate([...pos], geometry)
    return { ...part, geometry }
  })
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
    if (props.pos !== undefined || props.rotate !== undefined || props.scale !== undefined) {
      throw new CadModelError('Fragment does not accept pos, rotate, or scale. Use a Geometry or CAD element.')
    }

    return children.flatMap((child) => evaluateNode(child, inheritedMaterials, materialNames))
  }

  if (typeof type === 'function') {
    const owner = `Geometry ${type.name || '<anonymous>'}`
    const pos = normalizePos(props.pos, owner)
    const rotation = normalizeRotation(props.rotate, owner)
    const scaleValue = normalizeScale(props.scale, owner)
    const materials = resolveMaterials(props.materials, inheritedMaterials)
    const result = type({ ...props, pos, rotate: rotation, scale: scaleValue, materials, children })
    return applyTransforms(evaluateNode(result, materials, materialNames), scaleValue, rotation, pos)
  }

  if (type === 'translate') {
    throw new CadModelError('<translate> is not supported. Use the relative pos attribute instead.')
  }

  if (type === 'rotate') {
    throw new CadModelError('<rotate> is not supported. Use the axis-angle rotate attribute instead.')
  }

  if (type === 'scale') {
    throw new CadModelError('<scale> is not supported. Use the scale attribute instead.')
  }

  const owner = `<${type}>`
  const pos = normalizePos(props.pos, owner)
  const rotation = normalizeRotation(props.rotate, owner)
  const scaleValue = normalizeScale(props.scale, owner)

  if (type === 'array') {
    if (
      children.length !== 1 ||
      !isCadNode(children[0]) ||
      typeof children[0].type !== 'function' ||
      children[0].type === Fragment
    ) {
      throw new CadModelError('<array> requires exactly one direct child Geometry.')
    }

    const shape = normalizeArrayShape(props.shape)
    const period = normalizeArrayPeriod(props.period, shape)
    const axes = normalizeArrayAxes(props.axes)
    const inject = normalizeArrayInject(props.inject, shape)
    const child = children[0]
    const parts: EvaluatedPart[] = []

    for (let x = 0; x < shape[0]; x += 1) {
      for (let y = 0; y < shape[1]; y += 1) {
        for (let z = 0; z < shape[2]; z += 1) {
          const distances = [
            (x - (shape[0] - 1) / 2) * period[0],
            (y - (shape[1] - 1) / 2) * period[1],
            (z - (shape[2] - 1) / 2) * period[2],
          ]
          const offset = axes[0].map(
            (_coordinate, coordinate) =>
              axes[0][coordinate] * distances[0] +
              axes[1][coordinate] * distances[1] +
              axes[2][coordinate] * distances[2],
          ) as [number, number, number]

          if (offset.some((coordinate) => !Number.isFinite(coordinate))) {
            throw new CadModelError('<array> calculated a non-finite cell position.')
          }

          const cell = {
            type: child.type,
            props: { ...child.props, ...injectedPropsAt(inject, x, y, z) },
            children: child.children,
          }
          const cellParts = evaluateNode(cell, inheritedMaterials, materialNames)
          parts.push(...applyTransforms(cellParts, unitScale, undefined, offset))
        }
      }
    }

    return applyTransforms(parts, scaleValue, rotation, pos)
  }

  if (type === 'union' || type === 'subtract' || type === 'intersect') {
    requireChildren(type, children, type === 'union' ? 1 : 2)
    const evaluatedChildren = children.map((child) => evaluateNode(child, inheritedMaterials, materialNames))
    const allParts = evaluatedChildren.flat()
    const material = requireMatchingMaterial(allParts, type)

    if (type === 'union') {
      return applyTransforms(
        [{ geometry: cadUnion(...allParts.map((part) => part.geometry)), material }],
        scaleValue,
        rotation,
        pos,
      )
    }

    const childGeometries = evaluatedChildren.map((parts) => combineParts(parts, type).geometry)

    if (type === 'subtract') {
      return applyTransforms(
        [{ geometry: cadSubtract(childGeometries[0], ...childGeometries.slice(1)), material }],
        scaleValue,
        rotation,
        pos,
      )
    }

    return applyTransforms(
      [{ geometry: cadIntersect(...childGeometries), material }],
      scaleValue,
      rotation,
      pos,
    )
  }

  if (type !== 'box' && type !== 'cylinder' && type !== 'sphere') {
    throw new CadModelError(`Unknown CAD element: ${type}`)
  }

  const materials = resolveMaterials(undefined, inheritedMaterials)

  if (materials === undefined) {
    throw new CadModelError(`<${type}> requires an explicit or inherited Material.`)
  }

  const material = materials[0]
  const existingMaterial = materialNames.get(material.name)

  if (existingMaterial && existingMaterial !== material) {
    throw new CadModelError(`Material name ${material.name} is used by more than one Material instance.`)
  }

  materialNames.set(material.name, material)

  if (type === 'box') {
    return applyTransforms(
      [{ geometry: cuboid({ size: props.size as [number, number, number] }), material }],
      scaleValue,
      rotation,
      pos,
    )
  }

  if (type === 'cylinder') {
    return applyTransforms(
      [
        {
          geometry: cylinder({
            radius: props.radius as number,
            height: props.height as number,
            segments: (props.segments as number | undefined) ?? 32,
          }),
          material,
        },
      ],
      scaleValue,
      rotation,
      pos,
    )
  }

  return applyTransforms(
    [
      {
        geometry: sphere({
          radius: props.radius as number,
          segments: (props.segments as number | undefined) ?? 32,
        }),
        material,
      },
    ],
    scaleValue,
    rotation,
    pos,
  )
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
