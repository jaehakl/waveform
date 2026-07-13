import { describe, expect, it } from 'vitest'
import { Material } from '../../model/core'
import { evaluateCad, h } from '../../index'

const size = [2, 2, 2]

function Box() {
  return h('box', { size })
}

describe('CAD booleans', () => {
  it('allows same-Material CSG and rejects cross-Material CSG', () => {
    const core = new Material('Core', {}, '#2563eb')
    const cladding = new Material('Cladding', {}, '#f59e0b')

    expect(evaluateCad(h('union', null, h(Box, { materials: [core] }), h(Box, { materials: [core] })))).toHaveLength(1)
    expect(() =>
      evaluateCad(h('union', null, h(Box, { materials: [core] }), h(Box, { materials: [cladding] }))),
    ).toThrow('cannot combine Geometry with different Materials')
  })
})
