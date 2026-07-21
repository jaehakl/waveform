import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CadScene } from '@/lib/cad'
import GeometryTree from './GeometryTree'
import { findDraftTarget, shouldClearGeometryTreeSelection, updateDraftSelection } from './groupDraft'

const scene: CadScene = {
  lengthUnit: 'mm',
  geometryGroups: [{
    id: '@geometry-group/body',
    name: 'body',
    kind: 'geometry',
    memberIds: ['assembly', 'missing.geometry'],
    geometryIds: ['assembly.core'],
    surfaceIds: [],
    missingMemberIds: ['missing.geometry'],
  }],
  surfaceGroups: [{
    id: '@surface-group/contact',
    name: 'contact',
    kind: 'surface',
    memberIds: ['assembly.core/surface-1'],
    geometryIds: ['assembly.core'],
    surfaceIds: ['assembly.core/surface-1'],
    missingMemberIds: [],
  }],
  parts: [{
    id: 'assembly.core',
    geometry: {},
    material: { symbol: 'Core', variables: { color: '#2563eb' } },
    surfaces: [{ id: 'assembly.core/surface-1', name: 'Top', polygonIndices: [0] }],
  }],
  tree: {
    key: 'structure',
    label: 'Structure',
    children: [{
      key: 'structure/assembly',
      label: 'Assembly',
      globalId: 'assembly',
      groupId: 'assembly',
      geometryIds: ['assembly.core'],
      children: [{
        key: 'structure/assembly/core',
        label: 'Cell',
        globalId: 'assembly.core',
        geometryId: 'assembly.core',
        children: [{
          key: 'structure/assembly/core/surface-1',
          label: 'Top',
          surfaceId: 'assembly.core/surface-1',
          children: [],
        }],
      }, {
        key: 'structure/assembly/operand',
        label: 'Consumed operand',
        globalId: 'assembly.cutter',
        children: [],
      }],
    }],
  },
}

describe('GeometryTree', () => {
  it('clears selection only for non-interactive Tree background targets', () => {
    let selectors = ''
    const background = {
      closest: (value: string) => {
        selectors = value
        return null
      },
    } as unknown as EventTarget
    const control = {
      closest: () => ({}),
    } as unknown as EventTarget

    expect(shouldClearGeometryTreeSelection(background)).toBe(true)
    expect(selectors).toBe('button, input, select, textarea, a')
    expect(shouldClearGeometryTreeSelection(control)).toBe(false)
    expect(shouldClearGeometryTreeSelection(null)).toBe(false)
  })

  it('marks only the active selectable group while keeping descendants individually unselected', () => {
    const markup = renderToStaticMarkup(
      <GeometryTree
        draftSelection={null}
        scene={scene}
        selectedId="assembly"
        onDraftSelectionChange={() => undefined}
        onGroupsChange={() => undefined}
        onSelect={() => undefined}
      />,
    )

    expect(markup).toContain('aria-label="Geometry Tree"')
    expect(markup).not.toContain('geometries')
    expect(markup).toContain('Geometry Groups')
    expect(markup).toContain('Surface Groups')
    expect(markup).toContain('Geometry Hierarchy')
    expect(markup).toContain('body')
    expect(markup).toContain('contact')
    expect(markup).toContain('1/2 resolved')
    expect(markup).toContain('Structure')
    expect(markup).toContain('assembly')
    expect(markup).toContain('Cell')
    expect(markup).toContain('assembly.core')
    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(markup).toContain('aria-pressed="false"')
    expect(markup).toContain('Consumed operand')
    expect(markup).toContain('assembly.cutter')
  })

  it('seeds a draft from the current row, toggles batches, and ignores mixed kinds', () => {
    const seeded = updateDraftSelection(
      null,
      { kind: 'geometry', memberIds: ['assembly.core'] },
      { kind: 'geometry', memberIds: ['assembly'] },
    )
    const sameRow = updateDraftSelection(
      null,
      { kind: 'geometry', memberIds: ['assembly'] },
      { kind: 'geometry', memberIds: ['assembly'] },
    )
    const withGroup = updateDraftSelection(seeded, {
      kind: 'geometry',
      memberIds: ['assembly', 'missing.geometry'],
    })
    const withoutGroup = updateDraftSelection(withGroup, {
      kind: 'geometry',
      memberIds: ['assembly', 'missing.geometry'],
    })
    const mixed = updateDraftSelection(withoutGroup, {
      kind: 'surface',
      memberIds: ['assembly.core/surface-1'],
    })

    expect(seeded).toEqual({ kind: 'geometry', memberIds: ['assembly', 'assembly.core'] })
    expect(sameRow).toEqual({ kind: 'geometry', memberIds: ['assembly'] })
    expect(withGroup).toEqual({
      kind: 'geometry',
      memberIds: ['assembly', 'assembly.core', 'missing.geometry'],
    })
    expect(withoutGroup).toEqual({ kind: 'geometry', memberIds: ['assembly.core'] })
    expect(mixed).toBe(withoutGroup)
    expect(updateDraftSelection(
      { kind: 'geometry', memberIds: ['assembly.core'] },
      { kind: 'geometry', memberIds: ['assembly.core'] },
    )).toBeNull()
    expect(updateDraftSelection(null, {
      kind: 'surface',
      memberIds: ['assembly.core/surface-1'],
    }, { kind: 'geometry', memberIds: ['assembly'] })).toBeNull()
  })

  it('expands named groups to declared members and marks every drafted row', () => {
    expect(findDraftTarget(scene, '@geometry-group/body')).toEqual({
      kind: 'geometry',
      memberIds: ['assembly', 'missing.geometry'],
    })

    const markup = renderToStaticMarkup(
      <GeometryTree
        draftSelection={{ kind: 'geometry', memberIds: ['assembly', 'assembly.core', 'missing.geometry'] }}
        scene={scene}
        selectedId="assembly"
        onDraftSelectionChange={() => undefined}
        onGroupsChange={() => undefined}
        onSelect={() => undefined}
      />,
    )

    expect(markup.match(/data-group-draft-selected="true"/g)).toHaveLength(2)
    expect(markup.match(/aria-pressed="true"/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('keeps Tree selection available while hiding group mutations in read-only mode', () => {
    const markup = renderToStaticMarkup(
      <GeometryTree
        draftSelection={{ kind: 'geometry', memberIds: ['assembly.core'] }}
        readOnly
        scene={scene}
        selectedId={null}
        onDraftSelectionChange={() => undefined}
        onGroupsChange={() => undefined}
        onSelect={() => undefined}
      />,
    )

    expect(markup).toContain('1 geometry selected')
    expect(markup).toContain('>Clear</button>')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).not.toContain('aria-label="Target group"')
    expect(markup).not.toContain('aria-label="New group name"')
    expect(markup).not.toContain('>Create group</button>')
    expect(markup).not.toContain('aria-label="Delete group body"')
  })
})
