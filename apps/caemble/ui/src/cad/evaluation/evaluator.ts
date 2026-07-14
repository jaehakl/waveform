import { CadModelError, Material } from '../model/core'
import { deriveGeometrySurfaces, validateSurfacePartition } from '../geometry/surfaces'
import { getCadElementDefinition } from './registry'
import { flattenValues, Fragment, isCadNode } from './jsx'
import { applyTransforms, normalizeTransforms } from './transforms'
import type { CadScene, CadScenePart, CadSceneTreeNode, EvaluatedPart } from './types'

type EvaluationState = {
  materialNames: Map<string, Material>
  nodes: Map<string, CadSceneTreeNode>
}

function resolveMaterials(value: unknown, inherited: readonly Material[] | undefined) {
  if (value === undefined) return inherited === undefined ? undefined : [...inherited]
  if (!Array.isArray(value) || value.length === 0 || value.some((material) => !(material instanceof Material))) {
    throw new CadModelError('Geometry materials must be a non-empty array of Material instances.')
  }
  return [...value] as Material[]
}

function addTreeNode(
  state: EvaluationState,
  parent: CadSceneTreeNode,
  key: string,
  label: string,
) {
  const node: CadSceneTreeNode = { key, label, children: [] }
  state.nodes.set(key, node)
  parent.children.push(node)
  return node
}

function annotateTreeGroups(tree: CadSceneTreeNode) {
  const geometryIdsByKey = new Map<string, string[]>()
  const collectGeometryIds = (node: CadSceneTreeNode): string[] => {
    const geometryIds = [
      ...(node.geometryId ? [node.geometryId] : []),
      ...node.children.flatMap(collectGeometryIds),
    ]
    geometryIdsByKey.set(node.key, geometryIds)
    return geometryIds
  }
  collectGeometryIds(tree)

  let groupIndex = 0
  const pending = [tree]
  while (pending.length > 0) {
    const node = pending.shift()!
    const geometryIds = geometryIdsByKey.get(node.key) ?? []
    if (!node.geometryId && !node.surfaceId && geometryIds.length > 0) {
      groupIndex += 1
      node.groupId = `group-${groupIndex}`
      node.geometryIds = geometryIds
    }
    pending.unshift(...node.children)
  }
}

function evaluateNode(
  value: unknown,
  inheritedMaterials: readonly Material[] | undefined,
  state: EvaluationState,
  traceParent: CadSceneTreeNode,
  nodeKey: string,
): EvaluatedPart[] {
  if (Array.isArray(value)) {
    return flattenValues(value).flatMap((item, index) =>
      evaluateNode(item, inheritedMaterials, state, traceParent, `${nodeKey}/item-${index}`),
    )
  }
  if (!isCadNode(value)) throw new CadModelError('Geometry functions must return CAD JSX.')

  const { children, props, type } = value
  if (type === Fragment) {
    if (props.pos !== undefined || props.rotate !== undefined || props.scale !== undefined) {
      throw new CadModelError('Fragment does not accept pos, rotate, or scale. Use a Geometry or CAD element.')
    }
    return children.flatMap((child, index) =>
      evaluateNode(child, inheritedMaterials, state, traceParent, `${nodeKey}/fragment-${index}`),
    )
  }

  if (typeof type === 'function') {
    const label = type.name || 'Anonymous Geometry'
    const traceNode = addTreeNode(state, traceParent, nodeKey, label)
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
    return applyTransforms(
      evaluateNode(result, materials, state, traceNode, `${nodeKey}/result`),
      transformValues,
    )
  }

  if (type === 'translate') throw new CadModelError('<translate> is not supported. Use the relative pos attribute instead.')
  if (type === 'rotate') throw new CadModelError('<rotate> is not supported. Use the axis-angle rotate attribute instead.')
  if (type === 'scale') throw new CadModelError('<scale> is not supported. Use the scale attribute instead.')

  const definition = getCadElementDefinition(type)
  if (!definition) throw new CadModelError(`Unknown CAD element: ${type}`)
  const traceNode = addTreeNode(state, traceParent, nodeKey, `<${type}>`)
  const transformValues = normalizeTransforms(props, `<${type}>`)
  let parts: EvaluatedPart[]

  if (definition.kind === 'primitive') {
    const materials = resolveMaterials(undefined, inheritedMaterials)
    if (materials === undefined) throw new CadModelError(`<${type}> requires an explicit or inherited Material.`)

    const geometry = definition.createGeometry(props)
    parts = [{
      geometry,
      material: materials[0],
      surfaces: definition.createSurfaces(geometry, props),
      ownerNodeKey: nodeKey,
    }]
  } else {
    let childIndex = 0
    parts = definition.evaluate(value, {
      inheritedMaterials,
      evaluate: (child, materials = inheritedMaterials, trace) => {
        if (trace) {
          const wrapperKey = `${nodeKey}/${trace.key}`
          const wrapper = addTreeNode(state, traceNode, wrapperKey, trace.label)
          return evaluateNode(child, materials, state, wrapper, `${wrapperKey}/value`)
        }

        const childKey = `${nodeKey}/child-${childIndex}`
        childIndex += 1
        return evaluateNode(child, materials, state, traceNode, childKey)
      },
    })

    if (definition.surfacePolicy === 'derive') {
      parts = parts.map((part) => {
        const derived = deriveGeometrySurfaces(part.geometry)
        return {
          ...part,
          geometry: derived.geometry,
          surfaces: derived.surfaces,
          ownerNodeKey: nodeKey,
        }
      })
    }
  }

  parts.forEach(({ material }) => {
    const existing = state.materialNames.get(material.name)
    if (existing && existing !== material) {
      throw new CadModelError(`Material name ${material.name} is used by more than one Material instance.`)
    }
    state.materialNames.set(material.name, material)
  })

  return applyTransforms(parts, transformValues)
}

export function evaluateCadScene(root: unknown): CadScene {
  const tree: CadSceneTreeNode = { key: 'structure', label: 'Structure', children: [] }
  const state: EvaluationState = {
    materialNames: new Map(),
    nodes: new Map([[tree.key, tree]]),
  }
  const evaluatedParts = evaluateNode(root, undefined, state, tree, 'structure/root')
  if (evaluatedParts.length === 0) throw new CadModelError('Structure geometry did not return any CAD geometry.')

  const parts: CadScenePart[] = evaluatedParts.map((part, partIndex) => {
    if (!part.surfaces || !part.ownerNodeKey) {
      throw new CadModelError('CAD evaluation produced geometry without surface metadata.')
    }
    validateSurfacePartition(part.geometry, part.surfaces)

    const id = `geometry-${partIndex + 1}`
    const surfaces = part.surfaces.map((surface, surfaceIndex) => ({
      id: `${id}/surface-${surfaceIndex + 1}`,
      name: surface.name,
      polygonIndices: [...surface.polygonIndices],
    }))
    const owner = state.nodes.get(part.ownerNodeKey)
    if (!owner) throw new CadModelError('CAD evaluation lost the Geometry Tree owner for a scene part.')
    owner.children.push({
      key: `${part.ownerNodeKey}/${id}`,
      label: `Geometry ${partIndex + 1} · ${part.material.name}`,
      geometryId: id,
      children: surfaces.map((surface) => ({
        key: `${part.ownerNodeKey}/${surface.id}`,
        label: surface.name,
        surfaceId: surface.id,
        children: [],
      })),
    })

    return {
      id,
      geometry: part.geometry,
      materialName: part.material.name,
      displayColor: part.material.displayColor,
      surfaces,
    }
  })

  annotateTreeGroups(tree)

  return { parts, tree }
}

export function evaluateCad(root: unknown): CadScenePart[] {
  return evaluateCadScene(root).parts
}
