import { useEffect, useRef, useState } from 'react'
import type { CadScene, CadSceneTreeNode } from '../cad'

type GeometryTreeProps = {
  scene: CadScene | null
  selectedId: string | null
  onSelect: (id: string | null) => void
}

function GeometryTreeNode({
  depth,
  expanded,
  node,
  onSelect,
  onToggle,
  selectedId,
}: {
  depth: number
  expanded: ReadonlySet<string>
  node: CadSceneTreeNode
  onSelect: (id: string | null) => void
  onToggle: (key: string) => void
  selectedId: string | null
}) {
  const rowId = node.geometryId ?? node.surfaceId
  const isExpanded = expanded.has(node.key)
  const hasChildren = node.children.length > 0
  const isSelected = rowId !== undefined && selectedId === rowId

  return (
    <li role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined}>
      <div
        className={`group flex min-h-8 items-center border-l-2 text-xs ${
          isSelected
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
            aria-pressed={isSelected}
            className="min-w-0 flex-1 py-1.5 pr-2 text-left"
            type="button"
            onClick={() => onSelect(isSelected ? null : rowId)}
          >
            <span className="block truncate font-medium">{node.label}</span>
            <span className="block truncate font-mono text-[10px] text-slate-400">{rowId}</span>
          </button>
        ) : (
          <button
            className="min-w-0 flex-1 truncate py-1.5 pr-2 text-left font-medium"
            type="button"
            onClick={() => hasChildren && onToggle(node.key)}
          >
            {node.label}
          </button>
        )}
      </div>

      {hasChildren && isExpanded ? (
        <ul role="group">
          {node.children.map((child) => (
            <GeometryTreeNode
              key={child.key}
              depth={depth + 1}
              expanded={expanded}
              node={child}
              onSelect={onSelect}
              onToggle={onToggle}
              selectedId={selectedId}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function GeometryTree({ onSelect, scene, selectedId }: GeometryTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([
    'structure',
    ...scene?.tree.children.map((child) => child.key) ?? [],
  ]))
  const initializedSceneRef = useRef(scene !== null)

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

  return (
    <aside className="flex h-full min-h-0 flex-col bg-white" aria-label="Geometry Tree">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 px-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Geometry Tree</h2>
        <span className="text-[10px] text-slate-400">{scene?.parts.length ?? 0} geometries</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto py-1">
        {scene ? (
          <ul role="tree" aria-label="Evaluated Geometry Tree">
            <GeometryTreeNode
              depth={0}
              expanded={expanded}
              node={scene.tree}
              onSelect={onSelect}
              onToggle={toggle}
              selectedId={selectedId}
            />
          </ul>
        ) : (
          <div className="px-3 py-4 text-xs text-slate-400">Waiting for model...</div>
        )}
      </div>
    </aside>
  )
}

export default GeometryTree
