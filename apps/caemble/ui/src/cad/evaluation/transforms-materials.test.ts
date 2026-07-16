import { measurements } from '@jscad/modeling'
import { describe, expect, it } from 'vitest'
import { Material } from '../model/core'
import { Fragment, evaluateCad, h } from '../index'

const size = [2, 2, 2]

function Box() {
  return h('box', { size })
}

function OffsetBox() {
  return h('box', { size, pos: [2, 0, 0] })
}

describe('CAD transforms-materials', () => {
  it('applies child geometry, then scale, axis-angle rotate, and pos', () => {
    const core = new Material('Core', { color: '#2563eb' })
    const rotated = evaluateCad(
      h(OffsetBox, {
        id: 'offset',
        rotate: { axis: [0, 0, 5], angle: Math.PI / 2 },
        pos: [10, 0, 0],
        materials: [core],
      }),
    )[0]
    const scaled = evaluateCad(
      h(OffsetBox, { id: 'offset', scale: [2, 1, 1], pos: [10, 0, 0], materials: [core] }),
    )[0]

    expect(measurements.measureBoundingBox(rotated.geometry)).toEqual([
      [9, 1, -1],
      [11, 3, 1],
    ])
    expect(measurements.measureBoundingBox(scaled.geometry)).toEqual([
      [12, -1, -1],
      [16, 1, 1],
    ])
  })

  it('applies scale, rotate, and pos to primitive and completed boolean results', () => {
    const core = new Material('Core', { color: '#2563eb' })
    function Primitive() {
      return h('box', {
        size: [2, 4, 2],
        scale: [2, 1, 1],
        rotate: { axis: [0, 0, 1], angle: Math.PI / 2 },
        pos: [10, 0, 0],
      })
    }

    function Combined() {
      return h(
        'union',
        {
          scale: [2, 1, 1],
          rotate: { axis: [0, 0, 5], angle: Math.PI / 2 },
          pos: [5, 0, 0],
        },
        h(Box, { id: 'first' }),
        h(Box, { id: 'second', pos: [2, 0, 0] }),
      )
    }

    const [primitive] = evaluateCad(h(Primitive, { id: 'primitive', materials: [core] }))
    const [combined] = evaluateCad(
      h(Combined, { id: 'combined', materials: [core] }),
    )

    expect(measurements.measureBoundingBox(primitive.geometry)).toEqual([
      [8, -2, -1],
      [12, 2, 1],
    ])
    expect(measurements.measureBoundingBox(combined.geometry)).toEqual([
      [4, -2, -1],
      [6, 6, 1],
    ])
  })

  it('treats proportional axis vectors as the same rotation', () => {
    const core = new Material('Core', { color: '#2563eb' })
    const evaluate = (axis: number[]) =>
      evaluateCad(
        h(OffsetBox, { id: 'offset', rotate: { axis, angle: Math.PI / 2 }, materials: [core] }),
      )[0].geometry

    expect(measurements.measureBoundingBox(evaluate([0, 0, 5]))).toEqual(
      measurements.measureBoundingBox(evaluate([0, 0, 1])),
    )
  })

  it('inherits materials through nested Geometry without registration', () => {
    const core = new Material('Core', { epsilon: 12, color: '#2563eb' })

    function Parent() {
      return h(Box, { id: 'child' })
    }

    const parts = evaluateCad(h(Parent, { id: 'parent', materials: [core] }))

    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({
      material: { symbol: 'Core', variables: { epsilon: 12, color: '#2563eb' } },
    })
  })

  it('allows a materialless Geometry to group children with their own Materials', () => {
    const core = new Material('Core', { color: '#2563eb' })
    const cladding = new Material('Cladding', { color: '#f59e0b' })
    let groupMaterials: unknown = 'not evaluated'

    function Group(input: Record<string, unknown>) {
      groupMaterials = input.materials
      return h(
        Fragment,
        null,
        h(Box, { id: 'core', materials: [core] }),
        h(Box, { id: 'cladding', pos: [3, 0, 0], materials: [cladding] }),
      )
    }

    const parts = evaluateCad(h(Group, { id: 'group' }))

    expect(groupMaterials).toBeUndefined()
    expect(parts.map((part) => part.material?.symbol)).toEqual(['Core', 'Cladding'])
  })

  it('allows a primitive to create an unassigned scene part', () => {
    function MateriallessBox() {
      return h('box', { size })
    }

    const [part] = evaluateCad(h(MateriallessBox, { id: 'box' }))

    expect(part.id).toBe('box')
    expect(part).not.toHaveProperty('material')
    expect(part.surfaces.length).toBeGreaterThan(0)
  })

  it('replaces the complete materials array and uses index zero', () => {
    const core = new Material('Core', { color: '#2563eb' })
    const cladding = new Material('Cladding', { color: '#f59e0b' })
    const root = h(
      Fragment,
      null,
      h(Box, { id: 'core', materials: [core, cladding] }),
      h(Box, { id: 'cladding', materials: [cladding, core] }),
    )

    expect(evaluateCad(root).map((part) => part.material?.symbol)).toEqual(['Core', 'Cladding'])
  })

  it('preserves different Material parts under positioned Geometry', () => {
    const core = new Material('Core', { color: '#2563eb' })
    const cladding = new Material('Cladding', { color: '#f59e0b' })
    const root = h(
      Fragment,
      null,
      h(Box, { id: 'core', pos: [0, 0, 2], materials: [core] }),
      h(Box, { id: 'cladding', materials: [cladding] }),
    )

    expect(evaluateCad(root).map((part) => part.material?.symbol)).toEqual(['Core', 'Cladding'])
  })

  it('rejects empty material arrays and allows duplicate symbol/version instances', () => {
    expect(() => evaluateCad(h(Box, { id: 'box', materials: [] }))).toThrow('non-empty array of Material instances')

    const first = new Material('Core', 'measured', { color: '#2563eb' })
    const second = new Material('Core', 'measured', { color: '#f59e0b' })
    const root = h(
      Fragment,
      null,
      h(Box, { id: 'first', materials: [first] }),
      h(Box, { id: 'second', materials: [second] }),
    )

    const parts = evaluateCad(root)
    expect(parts.map((part) => part.material?.symbol)).toEqual(['Core', 'Core'])
    expect(parts.map((part) => part.material?.version)).toEqual(['measured', 'measured'])
    expect(parts[0].material).not.toBe(parts[1].material)
  })

  it('shares one serializable snapshot for parts using the same Material instance', () => {
    const shared = new Material('Core', 'Kittel_1988', {
      density: { type: 'float', value: 2.7, unit: 'g/cm3' },
      color: '#2563eb',
    })
    const parts = evaluateCad(h(
      Fragment,
      null,
      h(Box, { id: 'first', materials: [shared] }),
      h(Box, { id: 'second', materials: [shared] }),
    ))
    const cloned = structuredClone(parts)

    expect(parts[0].material).toBe(parts[1].material)
    expect(parts[0].material).toEqual({
      symbol: 'Core',
      version: 'Kittel_1988',
      variables: { density: { type: 'float', value: 2.7, unit: 'g/cm3' }, color: '#2563eb' },
    })
    expect(cloned[0].material).toBe(cloned[1].material)
  })
})



