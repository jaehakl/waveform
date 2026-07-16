import type { CadDocumentType, CadScenePart, CadSceneSelection } from '../cad'
import { createRenderParts } from './selection'

export type JscadViewerLayer = Readonly<{
  documentType: CadDocumentType
  parts: CadScenePart[]
}>

export type JscadViewerSelection = Readonly<{
  documentType: CadDocumentType
  selection: CadSceneSelection
}>

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
