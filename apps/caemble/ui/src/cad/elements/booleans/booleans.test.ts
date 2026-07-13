import { geometries, measurements } from '@jscad/modeling'
import { describe, expect, it } from 'vitest'
import { Material } from '../../model/core'
import { Fragment, evaluateCad, h } from '../../index'

const size = [2, 2, 2]

function Box() {
  return h('box', { size })
}

describe('CAD booleans', () => {
  it('allows same-Material union and rejects cross-Material union and intersect', () => {
    const core = new Material('Core', {}, '#2563eb')
    const cladding = new Material('Cladding', {}, '#f59e0b')

    expect(evaluateCad(h('union', null, h(Box, { materials: [core] }), h(Box, { materials: [core] })))).toHaveLength(1)
    expect(() =>
      evaluateCad(h('union', null, h(Box, { materials: [core] }), h(Box, { materials: [cladding] }))),
    ).toThrow('cannot combine Geometry with different Materials')
    expect(() =>
      evaluateCad(h('intersect', null, h(Box, { materials: [core] }), h(Box, { materials: [cladding] }))),
    ).toThrow('cannot combine Geometry with different Materials')
  })

  it('subtracts every cutter from each base part while preserving Material and order', () => {
    const first = new Material('First', {}, '#2563eb')
    const second = new Material('Second', {}, '#f59e0b')
    const cutter = new Material('Cutter', {}, '#64748b')
    const parts = evaluateCad(
      h(
        'subtract',
        null,
        h(
          Fragment,
          null,
          h(Box, { pos: [-2, 0, 0], scale: [2, 2, 2], materials: [first] }),
          h(Box, { pos: [2, 0, 0], scale: [2, 2, 2], materials: [second] }),
        ),
        h(Box, { pos: [0, -2, 0], scale: [6, 2, 3], materials: [cutter] }),
      ),
    )

    expect(parts.map((part) => part.materialName)).toEqual(['First', 'Second'])
    parts.forEach((part) => {
      expect(() => geometries.geom3.validate(part.geometry)).not.toThrow()
      expect(measurements.measureVolume(part.geometry)).toBeCloseTo(32, 6)
      expect(measurements.measureBoundingBox(part.geometry)[0][1]).toBeCloseTo(0, 6)
    })
  })
})
