import { arrayDefinition } from '../elements/operations/array/runtime'
import { intersectDefinition, subtractDefinition, unionDefinition } from '../elements/operations/booleans/runtime'
import { shellDefinition } from '../elements/operations/shell/runtime'
import { boxDefinition } from '../elements/primitives/box/runtime'
import { cylinderDefinition } from '../elements/primitives/cylinder/runtime'
import { curvedEdgeCylinderDefinition } from '../elements/primitives/curvedEdgeCylinder/runtime'
import { curvedSurfaceSphereDefinition } from '../elements/primitives/curvedSurfaceSphere/runtime'
import { fiberDefinition } from '../elements/primitives/fiber/runtime'
import { sphereDefinition } from '../elements/primitives/sphere/runtime'
import type { CadElementDefinition } from './types'

export const cadElementDefinitions = [
  boxDefinition,
  cylinderDefinition,
  curvedEdgeCylinderDefinition,
  sphereDefinition,
  curvedSurfaceSphereDefinition,
  fiberDefinition,
  shellDefinition,
  arrayDefinition,
  unionDefinition,
  subtractDefinition,
  intersectDefinition,
] as const satisfies readonly CadElementDefinition[]

export type CadElementTag = (typeof cadElementDefinitions)[number]['tag']

export function createCadElementRegistry(definitions: readonly CadElementDefinition[]) {
  const registry = new Map<string, CadElementDefinition>()
  definitions.forEach((definition) => {
    if (registry.has(definition.tag)) throw new Error(`Duplicate CAD element tag: ${definition.tag}`)
    if (definition.manifest.tag !== definition.tag) {
      throw new Error(`CAD element definition and manifest tags differ: ${definition.tag} / ${definition.manifest.tag}`)
    }
    registry.set(definition.tag, definition)
  })
  return registry
}

export const cadElementRegistry = createCadElementRegistry(cadElementDefinitions)

export function getCadElementDefinition(tag: string) {
  return cadElementRegistry.get(tag)
}
