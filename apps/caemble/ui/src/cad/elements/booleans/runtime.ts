import { booleans } from '@jscad/modeling'
import { CadModelError } from '../../model/core'
import type { CadElementManifest, CompoundElementDefinition, EvaluatedPart } from '../../evaluation/types'
import { intersectManifest, subtractManifest, unionManifest } from './definition'

const cadIntersect = booleans.intersect as (...geometries: unknown[]) => unknown
const cadSubtract = booleans.subtract as (...geometries: unknown[]) => unknown
const cadUnion = booleans.union as (...geometries: unknown[]) => unknown

function matchingMaterial(parts: EvaluatedPart[], operation: string) {
  const material = parts[0]?.material
  if (!material) throw new CadModelError(`<${operation}> did not receive any geometry.`)
  if (parts.some((part) => part.material !== material)) {
    throw new CadModelError(`<${operation}> cannot combine Geometry with different Materials.`)
  }
  return material
}

function createBooleanDefinition<Tag extends 'union' | 'subtract' | 'intersect'>(manifest: CadElementManifest<Tag>) {
  return {
    kind: 'compound',
    tag: manifest.tag,
    manifest,
    evaluate(node, context) {
      const minimum = manifest.tag === 'union' ? 1 : 2
      if (node.children.length < minimum) {
        throw new CadModelError(`<${manifest.tag}> requires at least ${minimum} child geometr${minimum === 1 ? 'y' : 'ies'}.`)
      }

      const childParts = node.children.map((child) => context.evaluate(child, context.inheritedMaterials))
      const allParts = childParts.flat()
      const material = matchingMaterial(allParts, manifest.tag)
      if (manifest.tag === 'union') {
        return [{ geometry: cadUnion(...allParts.map((part) => part.geometry)), material }]
      }

      const childGeometries = childParts.map((parts) => {
        matchingMaterial(parts, manifest.tag)
        return parts.length === 1 ? parts[0].geometry : cadUnion(...parts.map((part) => part.geometry))
      })
      const geometry = manifest.tag === 'subtract'
        ? cadSubtract(childGeometries[0], ...childGeometries.slice(1))
        : cadIntersect(...childGeometries)
      return [{ geometry, material }]
    },
  } satisfies CompoundElementDefinition<Tag>
}

export const unionDefinition = createBooleanDefinition(unionManifest)
export const subtractDefinition = createBooleanDefinition(subtractManifest)
export const intersectDefinition = createBooleanDefinition(intersectManifest)
