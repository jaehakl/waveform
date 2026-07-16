import type { CadSceneMaterial } from '../cad'

export const unassignedGeometryColor = '#475569'

export function materialColor(material: CadSceneMaterial | undefined) {
  return typeof material?.variables.color === 'string'
    ? material.variables.color
    : undefined
}
