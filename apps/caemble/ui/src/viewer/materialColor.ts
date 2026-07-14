import type { CadSceneMaterial } from '../cad'

export const defaultMaterialColor = '#3b82f6'

export function materialColor(material: CadSceneMaterial) {
  return typeof material.variables.color === 'string'
    ? material.variables.color
    : defaultMaterialColor
}
