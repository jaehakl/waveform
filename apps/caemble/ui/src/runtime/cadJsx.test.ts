import { describe, expect, it } from 'vitest'
import { Material } from './core'
import { Fragment, evaluateCad, h } from './cadJsx'

const size = [2, 2, 2]

function Box() {
  return h('box', { size })
}

describe('lazy CAD Geometry evaluation', () => {
  it('inherits materials through nested Geometry without registration', () => {
    const core = new Material('Core', { epsilon: 12 }, '#2563eb')

    function Parent() {
      return h(Box, null)
    }

    const parts = evaluateCad(h(Parent, { materials: [core] }))

    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({ materialName: 'Core', displayColor: '#2563eb' })
  })

  it('replaces the complete materials array and uses index zero', () => {
    const core = new Material('Core', {}, '#2563eb')
    const cladding = new Material('Cladding', {}, '#f59e0b')
    const root = h(
      Fragment,
      null,
      h(Box, { materials: [core, cladding] }),
      h(Box, { materials: [cladding, core] }),
    )

    expect(evaluateCad(root).map((part) => part.materialName)).toEqual(['Core', 'Cladding'])
  })

  it('preserves different Material parts under transforms', () => {
    const core = new Material('Core', {}, '#2563eb')
    const cladding = new Material('Cladding', {}, '#f59e0b')
    const root = h(
      'translate',
      { z: 2 },
      h(Fragment, null, h(Box, { materials: [core] }), h(Box, { materials: [cladding] })),
    )

    expect(evaluateCad(root).map((part) => part.materialName)).toEqual(['Core', 'Cladding'])
  })

  it('allows same-Material CSG and rejects cross-Material CSG', () => {
    const core = new Material('Core', {}, '#2563eb')
    const cladding = new Material('Cladding', {}, '#f59e0b')

    expect(evaluateCad(h('union', null, h(Box, { materials: [core] }), h(Box, { materials: [core] })))).toHaveLength(1)
    expect(() =>
      evaluateCad(h('union', null, h(Box, { materials: [core] }), h(Box, { materials: [cladding] }))),
    ).toThrow('cannot combine Geometry with different Materials')
  })

  it('rejects empty material arrays and duplicate names from different instances', () => {
    expect(() => evaluateCad(h(Box, { materials: [] }))).toThrow('non-empty materials array')

    const first = new Material('Core', {}, '#2563eb')
    const second = new Material('Core', {}, '#f59e0b')
    const root = h(Fragment, null, h(Box, { materials: [first] }), h(Box, { materials: [second] }))

    expect(() => evaluateCad(root)).toThrow('used by more than one Material instance')
  })
})
