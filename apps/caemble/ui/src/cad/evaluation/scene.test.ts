import { describe, expect, it } from 'vitest'
import { Material } from '../model/core'
import { Fragment, evaluateCadScene, h } from '../index'
import type { CadSceneTreeNode } from './types'

function flattenTree(node: CadSceneTreeNode): CadSceneTreeNode[] {
  return [node, ...node.children.flatMap(flattenTree)]
}

describe('CAD scene identity and evaluated tree', () => {
  it('keeps the evaluated JSX hierarchy while attaching only final Geometry results', () => {
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
        h('array', { shape: [2, 1, 1], period: [2, 0, 0] }, h(Cell, null)),
        h('subtract', null, h(Base, null), h(Cutter, null)),
      )
    }

    const first = evaluateCadScene(h(Root, { materials: [material] }))
    const second = evaluateCadScene(h(Root, { materials: [material] }))
    const nodes = flattenTree(first.tree)

    expect(first.parts.map((part) => part.id)).toEqual(['geometry-1', 'geometry-2', 'geometry-3'])
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
    ]))
    expect(nodes.some((node) => node.label === 'Fragment')).toBe(false)
    expect(nodes.filter((node) => node.geometryId).map((node) => node.geometryId)).toEqual([
      'geometry-1',
      'geometry-2',
      'geometry-3',
    ])
    expect(nodes.filter((node) => node.surfaceId).map((node) => node.surfaceId)).toEqual(
      first.parts.flatMap((part) => part.surfaces.map((surface) => surface.id)),
    )

    const subtractNode = nodes.find((node) => node.label === '<subtract>')!
    const baseNode = subtractNode.children.find((node) => node.label === 'Base')!
    const cutterNode = subtractNode.children.find((node) => node.label === 'Cutter')!
    expect(flattenTree(baseNode).some((node) => node.geometryId)).toBe(false)
    expect(flattenTree(cutterNode).some((node) => node.geometryId)).toBe(false)
    expect(subtractNode.children[subtractNode.children.length - 1]).toMatchObject({
      label: 'Geometry 3 · Scene material',
      geometryId: 'geometry-3',
    })

    expect(second.parts.map((part) => ({
      id: part.id,
      surfaceIds: part.surfaces.map((surface) => surface.id),
    }))).toEqual(first.parts.map((part) => ({
      id: part.id,
      surfaceIds: part.surfaces.map((surface) => surface.id),
    })))
    expect(second.tree).toEqual(first.tree)
  })
})
