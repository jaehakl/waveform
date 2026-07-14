import { describe, expect, it } from 'vitest'
import { Material } from '../model/core'
import { Fragment, evaluateCadScene, h, resolveCadSceneSelection } from '../index'
import { resolveCadSceneDraftSelection } from './selection'
import type { CadSceneTreeNode } from './types'

function flattenTree(node: CadSceneTreeNode): CadSceneTreeNode[] {
  return [node, ...node.children.flatMap(flattenTree)]
}

describe('CAD scene identity and evaluated tree', () => {
  it('derives stable part, group, array cell, and surface IDs from explicit local Geometry IDs', () => {
    const material = new Material('Scene material', {}, '#2563eb')

    function Cell() {
      return h('box', { size: [1, 1, 1] })
    }

    function Base() {
      return h('box', { size: [3, 3, 3] })
    }

    function Cutter() {
      return h('cylinder', { radius: 0.5, height: 4, segments: 16 })
    }

    function Root() {
      return h(
        Fragment,
        null,
        h('array', { shape: [2, 1, 1], period: [2, 0, 0] }, h(Cell, { id: 'particle' })),
        h('subtract', null, h(Base, { id: 'base' }), h(Cutter, { id: 'cutter' })),
      )
    }

    const first = evaluateCadScene(h(Root, { id: 'root', materials: [material] }))
    const second = evaluateCadScene(h(Root, { id: 'root', materials: [material] }))
    const nodes = flattenTree(first.tree)

    expect(first.parts.map((part) => part.id)).toEqual([
      'root.$cell-0-0-0.particle',
      'root.$cell-1-0-0.particle',
      'root.$part-1',
    ])
    expect(first.parts.map((part) => part.surfaces.length)).toEqual([6, 6, 7])
    expect(new Set(first.parts.flatMap((part) => [part.id, ...part.surfaces.map((surface) => surface.id)])).size).toBe(22)
    expect(nodes.map((node) => node.label)).toEqual(expect.arrayContaining([
      'Structure',
      'Root',
      '<array>',
      'Cell [0, 0, 0]',
      'Cell [1, 0, 0]',
      'Cell',
      '<box>',
      '<subtract>',
      'Base',
      'Cutter',
      '<cylinder>',
      'Part 1 · Scene material',
    ]))
    expect(nodes.some((node) => node.label === 'Fragment')).toBe(false)
    expect(nodes.filter((node) => node.geometryId).map((node) => node.geometryId)).toEqual([
      'root.$cell-0-0-0.particle',
      'root.$cell-1-0-0.particle',
      'root.$part-1',
    ])
    expect(nodes.filter((node) => node.surfaceId).map((node) => node.surfaceId)).toEqual(
      first.parts.flatMap((part) => part.surfaces.map((surface) => surface.id)),
    )

    const rootNode = nodes.find((node) => node.globalId === 'root')!
    expect(rootNode).toMatchObject({
      groupId: 'root',
      geometryIds: [
        'root.$cell-0-0-0.particle',
        'root.$cell-1-0-0.particle',
        'root.$part-1',
      ],
    })

    const arrayNode = nodes.find((node) => node.label === '<array>')!
    expect(arrayNode.groupId).toBeUndefined()
    expect(arrayNode.geometryIds).toBeUndefined()
    const cellNodes = nodes.filter((node) => node.label.startsWith('Cell ['))
    expect(cellNodes.every((node) => node.groupId === undefined)).toBe(true)

    const subtractNode = nodes.find((node) => node.label === '<subtract>')!
    const baseNode = subtractNode.children.find((node) => node.label === 'Base')!
    const cutterNode = subtractNode.children.find((node) => node.label === 'Cutter')!
    expect(baseNode).toMatchObject({ globalId: 'root.base' })
    expect(cutterNode).toMatchObject({ globalId: 'root.cutter' })
    expect(flattenTree(baseNode).some((node) => node.geometryId || node.groupId)).toBe(false)
    expect(flattenTree(cutterNode).some((node) => node.geometryId || node.groupId)).toBe(false)
    expect(subtractNode.groupId).toBeUndefined()

    expect(second.parts.map((part) => ({
      id: part.id,
      surfaceIds: part.surfaces.map((surface) => surface.id),
    }))).toEqual(first.parts.map((part) => ({
      id: part.id,
      surfaceIds: part.surfaces.map((surface) => surface.id),
    })))
    expect(second.tree).toEqual(first.tree)

    expect(resolveCadSceneSelection(first, 'root')).toMatchObject({
      kind: 'group',
      label: 'Root',
      geometryIds: first.parts.map((part) => part.id),
    })
    expect(resolveCadSceneSelection(first, 'root.$cell-0-0-0.particle')).toMatchObject({
      kind: 'geometry',
      geometryIds: ['root.$cell-0-0-0.particle'],
    })
    expect(resolveCadSceneSelection(first, 'root.$part-1/surface-1')).toMatchObject({
      kind: 'surface',
      geometryIds: ['root.$part-1'],
      surfaceIds: ['root.$part-1/surface-1'],
    })
    expect(resolveCadSceneSelection(first, 'root.base')).toBeNull()
  })

  it('validates local IDs, sibling uniqueness, and the Geometry ownership boundary', () => {
    const material = new Material('Core', {}, '#2563eb')

    function Box() {
      return h('box', { size: [1, 1, 1] })
    }

    expect(() => evaluateCadScene(h(Box, { materials: [material] }))).toThrow('Geometry Box id')
    ;['', 'with space', 'with.dot', '$part-1'].forEach((id) => {
      expect(() => evaluateCadScene(h(Box, { id, materials: [material] }))).toThrow('Geometry Box id')
    })
    expect(() => evaluateCadScene(h(Box, { id: 1, materials: [material] }))).toThrow('Geometry Box id')
    expect(evaluateCadScene(h(Box, { id: '한글-1', materials: [material] })).parts[0].id).toBe('한글-1')

    function DuplicateChildren() {
      return h('union', null, h(Box, { id: 'same' }), h(Box, { id: 'same' }))
    }

    expect(() => evaluateCadScene(h(DuplicateChildren, { id: 'root', materials: [material] }))).toThrow(
      'must be unique within parent "root"',
    )

    function Parent() {
      return h(Box, { id: 'leaf' })
    }

    const separateParents = evaluateCadScene(h(
      Fragment,
      null,
      h(Parent, { id: 'left', materials: [material] }),
      h(Parent, { id: 'right', materials: [material] }),
    ))
    expect(separateParents.parts.map((part) => part.id)).toEqual(['left.leaf', 'right.leaf'])
    expect(() => evaluateCadScene(h('box', { size: [1, 1, 1], materials: [material] }))).toThrow(
      'must be created within a Geometry component',
    )
    expect(() => evaluateCadScene(h(
      'union',
      null,
      h(Box, { id: 'first', materials: [material] }),
      h(Box, { id: 'second', materials: [material] }),
    ))).toThrow('must be created within a Geometry component')
  })

  it('accumulates reserved cell segments for nested arrays', () => {
    const material = new Material('Particle', {}, '#2563eb')

    function Particle() {
      return h('box', { size: [1, 1, 1] })
    }

    function Row() {
      return h(
        'array',
        { shape: [1, 2, 1], period: [0, 2, 0] },
        h(Particle, { id: 'particle' }),
      )
    }

    function Assembly() {
      return h(
        'array',
        { shape: [2, 1, 1], period: [2, 0, 0] },
        h(Row, { id: 'row' }),
      )
    }

    expect(evaluateCadScene(h(Assembly, { id: 'assembly', materials: [material] })).parts.map((part) => part.id)).toEqual([
      'assembly.$cell-0-0-0.row.$cell-0-0-0.particle',
      'assembly.$cell-0-0-0.row.$cell-0-1-0.particle',
      'assembly.$cell-1-0-0.row.$cell-0-0-0.particle',
      'assembly.$cell-1-0-0.row.$cell-0-1-0.particle',
    ])
  })

  it('resolves named Geometry and Surface groups while preserving missing members', () => {
    const material = new Material('Grouped', {}, '#2563eb')

    function Leaf() {
      return h('box', { size: [1, 1, 1] })
    }

    function Assembly() {
      return h(Fragment, null, h(Leaf, { id: 'left' }), h(Leaf, { id: 'right' }))
    }

    const scene = evaluateCadScene(h(Assembly, { id: 'assembly', materials: [material] }), {
      geometryGroup: {
        전체: ['assembly', 'assembly.left', 'missing.geometry'],
        empty: [],
        overlap: ['assembly.left'],
      },
      surfaceGroup: {
        contacts: ['assembly.left/surface-1', 'assembly.right/surface-2', 'missing/surface-1'],
      },
    })

    expect(scene.geometryGroups[0]).toEqual({
      id: '@geometry-group/%EC%A0%84%EC%B2%B4',
      name: '전체',
      kind: 'geometry',
      memberIds: ['assembly', 'assembly.left', 'missing.geometry'],
      geometryIds: ['assembly.left', 'assembly.right'],
      surfaceIds: [],
      missingMemberIds: ['missing.geometry'],
    })
    expect(scene.geometryGroups[1].geometryIds).toEqual([])
    expect(scene.geometryGroups[2].geometryIds).toEqual(['assembly.left'])
    expect(scene.surfaceGroups[0]).toMatchObject({
      id: '@surface-group/contacts',
      geometryIds: ['assembly.left', 'assembly.right'],
      surfaceIds: ['assembly.left/surface-1', 'assembly.right/surface-2'],
      missingMemberIds: ['missing/surface-1'],
    })
    expect(resolveCadSceneSelection(scene, '@geometry-group/%EC%A0%84%EC%B2%B4')).toMatchObject({
      kind: 'geometry-group',
      geometryIds: ['assembly.left', 'assembly.right'],
    })
    expect(resolveCadSceneSelection(scene, '@surface-group/contacts')).toMatchObject({
      kind: 'surface-group',
      surfaceIds: ['assembly.left/surface-1', 'assembly.right/surface-2'],
    })
    expect(resolveCadSceneSelection(scene, '@geometry-group/empty')).toMatchObject({
      kind: 'geometry-group',
      geometryIds: [],
    })
    expect(resolveCadSceneDraftSelection(scene, {
      kind: 'geometry',
      memberIds: ['assembly', 'assembly.left', 'missing.geometry'],
    })).toMatchObject({
      kind: 'geometry-group',
      geometryIds: ['assembly.left', 'assembly.right'],
    })
    expect(resolveCadSceneDraftSelection(scene, {
      kind: 'surface',
      memberIds: ['assembly.left/surface-1', 'assembly.right/surface-2', 'missing/surface-1'],
    })).toMatchObject({
      kind: 'surface-group',
      geometryIds: ['assembly.left', 'assembly.right'],
      surfaceIds: ['assembly.left/surface-1', 'assembly.right/surface-2'],
    })
  })
})
