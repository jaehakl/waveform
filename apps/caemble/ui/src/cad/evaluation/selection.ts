import type { CadScene, CadSceneSelection } from './types'

export function resolveCadSceneSelection(scene: CadScene | null, selectedId: string | null): CadSceneSelection | null {
  if (!scene || !selectedId) return null

  for (const part of scene.parts) {
    if (part.id === selectedId) {
      return {
        id: selectedId,
        kind: 'geometry',
        label: `${part.id} · ${part.materialName}`,
        geometryIds: [part.id],
      }
    }

    const surface = part.surfaces.find((candidate) => candidate.id === selectedId)
    if (surface) {
      return {
        id: selectedId,
        kind: 'surface',
        label: surface.name,
        geometryIds: [part.id],
        surfaceId: surface.id,
      }
    }
  }

  const pending = [scene.tree]
  while (pending.length > 0) {
    const node = pending.shift()!
    if (node.groupId === selectedId && node.geometryIds && node.geometryIds.length > 0) {
      return {
        id: selectedId,
        kind: 'group',
        label: node.label,
        geometryIds: [...node.geometryIds],
      }
    }
    pending.unshift(...node.children)
  }

  return null
}
