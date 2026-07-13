import { CadModelError, Material } from '../model/core'
import { getCadElementDefinition } from './registry'
import { flattenValues, Fragment, isCadNode } from './jsx'
import { applyTransforms, normalizeTransforms } from './transforms'
import type { CadScenePart, EvaluatedPart } from './types'

function resolveMaterials(value: unknown, inherited: readonly Material[] | undefined) {
  if (value === undefined) return inherited === undefined ? undefined : [...inherited]
  if (!Array.isArray(value) || value.length === 0 || value.some((material) => !(material instanceof Material))) {
    throw new CadModelError('Geometry materials must be a non-empty array of Material instances.')
  }
  return [...value] as Material[]
}

function evaluateNode(
  value: unknown,
  inheritedMaterials: readonly Material[] | undefined,
  materialNames: Map<string, Material>,
): EvaluatedPart[] {
  if (Array.isArray(value)) {
    return flattenValues(value).flatMap((item) => evaluateNode(item, inheritedMaterials, materialNames))
  }
  if (!isCadNode(value)) throw new CadModelError('Geometry functions must return CAD JSX.')

  const { children, props, type } = value
  if (type === Fragment) {
    if (props.pos !== undefined || props.rotate !== undefined || props.scale !== undefined) {
      throw new CadModelError('Fragment does not accept pos, rotate, or scale. Use a Geometry or CAD element.')
    }
    return children.flatMap((child) => evaluateNode(child, inheritedMaterials, materialNames))
  }

  if (typeof type === 'function') {
    const owner = `Geometry ${type.name || '<anonymous>'}`
    const transformValues = normalizeTransforms(props, owner)
    const materials = resolveMaterials(props.materials, inheritedMaterials)
    const result = type({
      ...props,
      pos: transformValues.pos,
      rotate: transformValues.rotate,
      scale: transformValues.scale,
      materials,
      children,
    })
    return applyTransforms(evaluateNode(result, materials, materialNames), transformValues)
  }

  if (type === 'translate') throw new CadModelError('<translate> is not supported. Use the relative pos attribute instead.')
  if (type === 'rotate') throw new CadModelError('<rotate> is not supported. Use the axis-angle rotate attribute instead.')
  if (type === 'scale') throw new CadModelError('<scale> is not supported. Use the scale attribute instead.')

  const definition = getCadElementDefinition(type)
  if (!definition) throw new CadModelError(`Unknown CAD element: ${type}`)
  const transformValues = normalizeTransforms(props, `<${type}>`)
  let parts: EvaluatedPart[]

  if (definition.kind === 'primitive') {
    const materials = resolveMaterials(undefined, inheritedMaterials)
    if (materials === undefined) throw new CadModelError(`<${type}> requires an explicit or inherited Material.`)

    const material = materials[0]
    const existing = materialNames.get(material.name)
    if (existing && existing !== material) {
      throw new CadModelError(`Material name ${material.name} is used by more than one Material instance.`)
    }
    materialNames.set(material.name, material)
    parts = [{ geometry: definition.createGeometry(props), material }]
  } else {
    parts = definition.evaluate(value, {
      inheritedMaterials,
      evaluate: (child, materials = inheritedMaterials) => evaluateNode(child, materials, materialNames),
    })
  }

  return applyTransforms(parts, transformValues)
}

export function evaluateCad(root: unknown): CadScenePart[] {
  const parts = evaluateNode(root, undefined, new Map())
  if (parts.length === 0) throw new CadModelError('Structure geometry did not return any CAD geometry.')
  return parts.map((part) => ({
    geometry: part.geometry,
    materialName: part.material.name,
    displayColor: part.material.displayColor,
  }))
}


