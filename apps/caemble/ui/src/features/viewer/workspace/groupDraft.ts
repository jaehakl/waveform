import type { CadScene } from '@/lib/cad'

export type DraftSelection = Readonly<{
  kind: 'geometry' | 'surface'
  memberIds: readonly string[]
}>

export function shouldClearGeometryTreeSelection(target: EventTarget | null) {
  const element = target as Element | null
  return typeof element?.closest === 'function' && element.closest('button, input, select, textarea, a') === null
}

export function updateDraftSelection(
  current: DraftSelection | null,
  target: DraftSelection,
  seed: DraftSelection | null = null,
): DraftSelection | null {
  const targetIds = [...new Set(target.memberIds)]
  if (current) {
    if (current.kind !== target.kind || targetIds.length === 0) return current
    const targetSet = new Set(targetIds)
    const allSelected = targetIds.every((id) => current.memberIds.includes(id))
    const memberIds = allSelected
      ? current.memberIds.filter((id) => !targetSet.has(id))
      : [...new Set([...current.memberIds, ...targetIds])]
    return memberIds.length > 0 ? { kind: current.kind, memberIds } : null
  }

  if (seed && seed.kind !== target.kind) return null
  const memberIds = [...new Set([...(seed?.memberIds ?? []), ...targetIds])]
  return memberIds.length > 0 ? { kind: target.kind, memberIds } : null
}

export function findDraftTarget(scene: CadScene | null, id: string | null): DraftSelection | null {
  if (!scene || !id) return null

  const geometryGroup = scene.geometryGroups.find((group) => group.id === id)
  if (geometryGroup) return { kind: 'geometry', memberIds: geometryGroup.memberIds }
  const surfaceGroup = scene.surfaceGroups.find((group) => group.id === id)
  if (surfaceGroup) return { kind: 'surface', memberIds: surfaceGroup.memberIds }

  const pending = [scene.tree]
  while (pending.length > 0) {
    const node = pending.pop()!
    if (node.surfaceId === id) return { kind: 'surface', memberIds: [id] }
    if (node.groupId === id || node.geometryId === id) return { kind: 'geometry', memberIds: [id] }
    pending.push(...node.children)
  }
  return null
}
