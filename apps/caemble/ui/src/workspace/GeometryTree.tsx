import { useEffect, useRef, useState } from 'react'
import type { CadScene, CadSceneGroup, CadSceneTreeNode } from '../cad'
import type { StructureGroupMap } from '../cad/model/core'
import type { StructureGroupProperty } from '../cad/source/structureGroups'
import {
  findDraftTarget,
  shouldClearGeometryTreeSelection,
  updateDraftSelection,
  type DraftSelection,
} from './groupDraft'

type GeometryTreeProps = {
  draftSelection: DraftSelection | null
  scene: CadScene | null
  selectedId: string | null
  onDraftSelectionChange: (selection: DraftSelection | null) => void
  onSelect: (id: string | null) => void
  onGroupsChange: (property: StructureGroupProperty, groups: StructureGroupMap) => void
}

function GeometryTreeNode({
  depth,
  draftSelection,
  expanded,
  node,
  onRowSelect,
  onToggle,
  selectedId,
}: {
  depth: number
  draftSelection: DraftSelection | null
  expanded: ReadonlySet<string>
  node: CadSceneTreeNode
  onRowSelect: (kind: DraftSelection['kind'], id: string, modified: boolean) => void
  onToggle: (key: string) => void
  selectedId: string | null
}) {
  const rowId = node.groupId ?? node.geometryId ?? node.surfaceId
  const rowKind = node.surfaceId ? 'surface' : 'geometry'
  const displayId = node.globalId ?? rowId
  const isExpanded = expanded.has(node.key)
  const hasChildren = node.children.length > 0
  const isSelected = rowId !== undefined && selectedId === rowId
  const isDraftSelected = rowId !== undefined && draftSelection?.kind === rowKind
    && draftSelection.memberIds.includes(rowId)

  return (
    <li role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined}>
      <div
        className={`group flex min-h-8 items-center border-l-2 text-xs ${
          isDraftSelected
            ? 'border-sky-500 bg-sky-50 text-sky-950'
            : isSelected
              ? 'border-orange-500 bg-orange-50 text-orange-950'
              : 'border-transparent text-slate-700 hover:bg-slate-50'
        }`}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        {hasChildren ? (
          <button
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${node.label}`}
            className="grid h-7 w-6 shrink-0 place-items-center text-[10px] text-slate-500 hover:text-slate-950"
            type="button"
            onClick={() => onToggle(node.key)}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="w-6 shrink-0 text-center text-[10px] text-slate-300">●</span>
        )}

        {rowId ? (
          <button
            aria-pressed={isSelected || isDraftSelected}
            className="min-w-0 flex-1 py-1.5 pr-2 text-left"
            data-group-draft-selected={isDraftSelected || undefined}
            title="Ctrl/Cmd-click to select group members"
            type="button"
            onClick={(event) => onRowSelect(rowKind, rowId, event.ctrlKey || event.metaKey)}
          >
            <span className="block truncate font-medium">{node.label}</span>
            <span className="block truncate font-mono text-[10px] text-slate-400">{displayId}</span>
          </button>
        ) : hasChildren ? (
          <button
            className="min-w-0 flex-1 py-1.5 pr-2 text-left"
            type="button"
            onClick={() => onToggle(node.key)}
          >
            <span className="block truncate font-medium">{node.label}</span>
            {displayId ? (
              <span className="block truncate font-mono text-[10px] text-slate-400">{displayId}</span>
            ) : null}
          </button>
        ) : (
          <div className="min-w-0 flex-1 py-1.5 pr-2 text-left">
            <span className="block truncate font-medium">{node.label}</span>
            {displayId ? (
              <span className="block truncate font-mono text-[10px] text-slate-400">{displayId}</span>
            ) : null}
          </div>
        )}
      </div>

      {hasChildren && isExpanded ? (
        <ul role="group">
          {node.children.map((child) => (
            <GeometryTreeNode
              key={child.key}
              depth={depth + 1}
              draftSelection={draftSelection}
              expanded={expanded}
              node={child}
              onRowSelect={onRowSelect}
              onToggle={onToggle}
              selectedId={selectedId}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function groupMap(groups: readonly CadSceneGroup[]): StructureGroupMap {
  return Object.fromEntries(groups.map((group) => [group.name, group.memberIds]))
}

function NamedGroupSection({
  draftSelection,
  expandedGroups,
  groups,
  onDelete,
  onRemoveMember,
  onSelect,
  onToggle,
  selectedId,
  title,
}: {
  draftSelection: DraftSelection | null
  expandedGroups: ReadonlySet<string>
  groups: readonly CadSceneGroup[]
  onDelete: (group: CadSceneGroup) => void
  onRemoveMember: (group: CadSceneGroup, memberId: string) => void
  onSelect: (group: CadSceneGroup, modified: boolean) => void
  onToggle: (id: string) => void
  selectedId: string | null
  title: string
}) {
  return (
    <section aria-label={title} className="border-b border-slate-200 py-1">
      <h2 className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {groups.length === 0 ? (
        <div className="px-3 pb-2 text-[11px] text-slate-400">No groups</div>
      ) : (
        <ul>
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.id)
            const isSelected = selectedId === group.id
            const isDraftSelected = draftSelection?.kind === group.kind
              && group.memberIds.length > 0
              && group.memberIds.every((id) => draftSelection.memberIds.includes(id))
            const missing = new Set(group.missingMemberIds)
            return (
              <li key={group.id}>
                <div className={`flex min-h-9 items-center border-l-2 text-xs ${
                  isDraftSelected
                    ? 'border-sky-500 bg-sky-50'
                    : isSelected
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-transparent hover:bg-slate-50'
                }`}>
                  <button
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} group ${group.name}`}
                    className="grid h-8 w-7 shrink-0 place-items-center text-[10px] text-slate-500"
                    type="button"
                    onClick={() => onToggle(group.id)}
                  >
                    {isExpanded ? '▼' : '▶'}
                  </button>
                  <button
                    aria-pressed={isSelected || isDraftSelected}
                    className="min-w-0 flex-1 py-1 pr-2 text-left"
                    type="button"
                    onClick={(event) => onSelect(group, event.ctrlKey || event.metaKey)}
                  >
                    <span className="block truncate font-medium">{group.name}</span>
                    <span className="block text-[10px] text-slate-400">
                      {group.memberIds.length - group.missingMemberIds.length}/{group.memberIds.length} resolved
                    </span>
                  </button>
                  <button
                    aria-label={`Delete group ${group.name}`}
                    className="mr-1 rounded px-1.5 py-1 text-[10px] text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                    type="button"
                    onClick={() => onDelete(group)}
                  >
                    Delete
                  </button>
                </div>
                {isExpanded ? (
                  <ul className="bg-slate-50/70 py-1">
                    {group.memberIds.length === 0 ? (
                      <li className="px-8 py-1 text-[10px] text-slate-400">Empty group</li>
                    ) : group.memberIds.map((memberId) => (
                      <li className="flex items-center gap-2 px-8 py-1 text-[10px]" key={memberId}>
                        <span className="min-w-0 flex-1 truncate font-mono text-slate-600">{memberId}</span>
                        {missing.has(memberId) ? (
                          <span className="rounded bg-amber-100 px-1 text-amber-800">Missing</span>
                        ) : null}
                        <button
                          aria-label={`Remove ${memberId} from ${group.name}`}
                          className="text-slate-400 hover:text-rose-700"
                          type="button"
                          onClick={() => onRemoveMember(group, memberId)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function GeometryTree({
  draftSelection,
  onDraftSelectionChange,
  onGroupsChange,
  onSelect,
  scene,
  selectedId,
}: GeometryTreeProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set())
  const [targetGroup, setTargetGroup] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([
    'structure',
    ...scene?.tree.children.map((child) => child.key) ?? [],
  ]))
  const initializedSceneRef = useRef(scene !== null)

  useEffect(() => {
    setTargetGroup('')
    setNewGroupName('')
  }, [draftSelection?.kind])

  useEffect(() => {
    if (!scene) return
    const shouldApplyDefaults = !initializedSceneRef.current
    initializedSceneRef.current = true
    const availableKeys = new Set<string>()
    const pending = [scene.tree]
    while (pending.length > 0) {
      const node = pending.pop()!
      availableKeys.add(node.key)
      pending.push(...node.children)
    }
    setExpanded((current) => new Set([
      'structure',
      ...(shouldApplyDefaults ? scene.tree.children.map((child) => child.key) : []),
      ...[...current].filter((key) => availableKeys.has(key)),
    ]))
  }, [scene])

  const toggle = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleGroup = (id: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleRowSelect = (kind: DraftSelection['kind'], id: string, modified: boolean) => {
    if (modified) {
      onDraftSelectionChange(updateDraftSelection(
        draftSelection,
        { kind, memberIds: [id] },
        findDraftTarget(scene, selectedId),
      ))
      return
    }
    onDraftSelectionChange(null)
    onSelect(selectedId === id ? null : id)
  }

  const handleNamedGroupSelect = (group: CadSceneGroup, modified: boolean) => {
    if (modified) {
      onDraftSelectionChange(updateDraftSelection(
        draftSelection,
        { kind: group.kind, memberIds: group.memberIds },
        findDraftTarget(scene, selectedId),
      ))
      return
    }
    onDraftSelectionChange(null)
    onSelect(selectedId === group.id ? null : group.id)
  }

  const applyGroupMap = (kind: DraftSelection['kind'], groups: StructureGroupMap) => {
    onGroupsChange(kind === 'geometry' ? 'geometryGroup' : 'surfaceGroup', groups)
  }

  const removeMember = (group: CadSceneGroup, memberId: string) => {
    const groups = group.kind === 'geometry' ? scene?.geometryGroups ?? [] : scene?.surfaceGroups ?? []
    applyGroupMap(group.kind, {
      ...groupMap(groups),
      [group.name]: group.memberIds.filter((id) => id !== memberId),
    })
  }

  const deleteGroup = (group: CadSceneGroup) => {
    const groups = group.kind === 'geometry' ? scene?.geometryGroups ?? [] : scene?.surfaceGroups ?? []
    applyGroupMap(group.kind, Object.fromEntries(
      groups.filter((candidate) => candidate.name !== group.name).map((candidate) => [candidate.name, candidate.memberIds]),
    ))
    if (selectedId === group.id) onSelect(null)
  }

  const draftGroups = draftSelection?.kind === 'geometry' ? scene?.geometryGroups ?? [] : scene?.surfaceGroups ?? []
  const normalizedNewGroupName = newGroupName.trim()
  const saveGroupName = targetGroup || normalizedNewGroupName
  const canSaveDraft = Boolean(draftSelection?.memberIds.length && saveGroupName)

  const saveDraft = () => {
    if (!draftSelection || !canSaveDraft) return
    const currentGroups = groupMap(draftGroups)
    const currentMembers = currentGroups[saveGroupName] ?? []
    applyGroupMap(draftSelection.kind, {
      ...currentGroups,
      [saveGroupName]: [...new Set([...currentMembers, ...draftSelection.memberIds])],
    })
    onDraftSelectionChange(null)
    setTargetGroup('')
    setNewGroupName('')
  }

  return (
    <aside
      className="flex h-full min-h-0 flex-col bg-white"
      aria-label="Geometry Tree"
      onClick={(event) => {
        if (!shouldClearGeometryTreeSelection(event.target)) return
        onDraftSelectionChange(null)
        onSelect(null)
      }}
    >
      <div className="shrink-0 border-b border-slate-200 p-2">
        {draftSelection ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-slate-700">
                {draftSelection.memberIds.length} {draftSelection.kind} selected
              </span>
              <button
                className="text-slate-400 hover:text-slate-700"
                type="button"
                onClick={() => onDraftSelectionChange(null)}
              >
                Clear
              </button>
            </div>
            <select
              aria-label="Target group"
              className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              value={targetGroup}
              onChange={(event) => setTargetGroup(event.target.value)}
            >
              <option value="">New group</option>
              {draftGroups.map((group) => <option key={group.id} value={group.name}>{group.name}</option>)}
            </select>
            {!targetGroup ? (
              <input
                aria-label="New group name"
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                placeholder="Group name"
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
              />
            ) : null}
            <button
              className="w-full rounded bg-slate-900 px-2 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canSaveDraft}
              type="button"
              onClick={saveDraft}
            >
              {targetGroup ? 'Add to group' : 'Create group'}
            </button>
          </div>
        ) : (
          <p className="text-[11px] leading-4 text-slate-400">Ctrl/Cmd-click Geometry or Surface rows to assign a group.</p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {scene ? (
          <>
            <NamedGroupSection
              draftSelection={draftSelection}
              expandedGroups={expandedGroups}
              groups={scene.geometryGroups}
              onDelete={deleteGroup}
              onRemoveMember={removeMember}
              onSelect={handleNamedGroupSelect}
              onToggle={toggleGroup}
              selectedId={selectedId}
              title="Geometry Groups"
            />
            <NamedGroupSection
              draftSelection={draftSelection}
              expandedGroups={expandedGroups}
              groups={scene.surfaceGroups}
              onDelete={deleteGroup}
              onRemoveMember={removeMember}
              onSelect={handleNamedGroupSelect}
              onToggle={toggleGroup}
              selectedId={selectedId}
              title="Surface Groups"
            />
            <section aria-label="Geometry Hierarchy" className="py-1">
              <h2 className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Geometry Hierarchy
              </h2>
              <ul role="tree" aria-label="Evaluated Geometry Tree">
                <GeometryTreeNode
                  depth={0}
                  draftSelection={draftSelection}
                  expanded={expanded}
                  node={scene.tree}
                  onRowSelect={handleRowSelect}
                  onToggle={toggle}
                  selectedId={selectedId}
                />
              </ul>
            </section>
          </>
        ) : (
          <div className="px-3 py-4 text-xs text-slate-400">Waiting for model...</div>
        )}
      </div>
    </aside>
  )
}

export default GeometryTree
