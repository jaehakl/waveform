import type { CadScene, CadSceneSelection } from './types'

export function resolveCadSceneSelection(scene: CadScene | null, selectedId: string | null): CadSceneSelection | null {
  if (!scene || !selectedId) return null

  const geometryGroup = scene.geometryGroups.find((group) => group.id === selectedId)
  if (geometryGroup) {
    return {
      id: selectedId,
      kind: 'geometry-group',
      label: geometryGroup.name,
      geometryIds: [...geometryGroup.geometryIds],
    }
  }

  const surfaceGroup = scene.surfaceGroups.find((group) => group.id === selectedId)
  if (surfaceGroup) {
    return {
      id: selectedId,
      kind: 'surface-group',
      label: surfaceGroup.name,
      geometryIds: [...surfaceGroup.geometryIds],
      surfaceIds: [...surfaceGroup.surfaceIds],
    }
  }

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
        surfaceIds: [surface.id],
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

export function resolveCadSceneDraftSelection(
  scene: CadScene | null,
  draft: Readonly<{ kind: 'geometry' | 'surface'; memberIds: readonly string[] }>,
): CadSceneSelection | null {
  if (!scene) return null

  const geometryIds: string[] = []
  const surfaceIds: string[] = []
  const seenGeometryIds = new Set<string>()
  const seenSurfaceIds = new Set<string>()

  draft.memberIds.forEach((memberId) => {
    const selection = resolveCadSceneSelection(scene, memberId)
    if (!selection) return
    const selectsSurfaces = selection.kind === 'surface' || selection.kind === 'surface-group'
    if ((draft.kind === 'surface') !== selectsSurfaces) return

    selection.geometryIds.forEach((geometryId) => {
      if (seenGeometryIds.has(geometryId)) return
      seenGeometryIds.add(geometryId)
      geometryIds.push(geometryId)
    })
    selection.surfaceIds?.forEach((surfaceId) => {
      if (seenSurfaceIds.has(surfaceId)) return
      seenSurfaceIds.add(surfaceId)
      surfaceIds.push(surfaceId)
    })
  })

  return {
    id: `@draft/${draft.kind}`,
    kind: draft.kind === 'geometry' ? 'geometry-group' : 'surface-group',
    label: `${draft.memberIds.length} ${draft.kind} selected`,
    geometryIds,
    ...(draft.kind === 'surface' ? { surfaceIds } : {}),
  }
}
