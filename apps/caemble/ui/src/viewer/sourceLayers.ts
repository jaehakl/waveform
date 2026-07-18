import { transforms } from '@jscad/modeling'
import {
  convertUcumValue,
  type CadDocumentType,
  type CadScenePart,
  type CadSceneSelection,
  type UcumUnit,
} from '../cad'
import { createRenderParts } from './selection'

export type JscadViewerLayer = Readonly<{
  documentType: CadDocumentType
  lengthUnit: UcumUnit
  parts: CadScenePart[]
  sceneHash?: string | null
}>

export type JscadViewerSelection = Readonly<{
  documentType: CadDocumentType
  selection: CadSceneSelection
}>

export function scaleViewerLayers(
  layers: readonly JscadViewerLayer[],
  displayLengthUnit: UcumUnit,
): readonly JscadViewerLayer[] {
  const scaleGeometry = transforms.scale as unknown as (
    factors: readonly [number, number, number],
    geometry: unknown,
  ) => unknown
  return layers.map((layer) => {
    const factor = convertUcumValue(
      1,
      layer.lengthUnit,
      displayLengthUnit,
      `${layer.documentType} viewer lengthUnit`,
    )
    if (factor === 1) return layer
    return {
      ...layer,
      lengthUnit: displayLengthUnit,
      parts: layer.parts.map((part) => ({
        ...part,
        geometry: scaleGeometry([factor, factor, factor], part.geometry),
      })),
    }
  })
}

export function materialGridPartsFromLayers(layers: readonly JscadViewerLayer[]) {
  return (['experiment', 'structure'] as const).flatMap((documentType) => (
    layers.filter((layer) => layer.documentType === documentType).flatMap((layer) => layer.parts)
  ))
}

export function createLayerRenderParts(
  layers: readonly JscadViewerLayer[],
  selected: JscadViewerSelection | null,
) {
  return layers.flatMap((layer) => createRenderParts(
    layer.parts,
    selected?.documentType === layer.documentType ? selected.selection : null,
  ))
}
