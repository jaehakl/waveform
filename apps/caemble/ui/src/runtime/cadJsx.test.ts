import { describe, expect, it } from 'vitest'
import { measurements } from '@jscad/modeling'
import { Material } from './core'
import { Fragment, evaluateCad, h } from './cadJsx'

const size = [2, 2, 2]

function Box() {
  return h('box', { size })
}

function OffsetBox() {
  return h('box', { size, pos: [2, 0, 0] })
}

describe('lazy CAD Geometry evaluation', () => {
  it('passes normalized frozen transforms to Geometry with identity defaults', () => {
    const core = new Material('Core', {}, '#2563eb')
    const received: Record<string, unknown>[] = []

    function Positioned(input: Record<string, unknown>) {
      received.push(input)
      return h('box', { size })
    }

    const [part] = evaluateCad(h(Positioned, { materials: [core] }))
    evaluateCad(
      h(Positioned, {
        pos: [2, 3, 4],
        rotate: { axis: [0, 0, 5], angle: Math.PI / 2 },
        scale: [2, 3, 4],
        materials: [core],
      }),
    )

    expect(received[0]).toMatchObject({ pos: [0, 0, 0], rotate: undefined, scale: [1, 1, 1] })
    expect(received[1]).toMatchObject({
      pos: [2, 3, 4],
      rotate: { axis: [0, 0, 1], angle: Math.PI / 2 },
      scale: [2, 3, 4],
    })
    expect(Object.isFrozen(received[0].pos)).toBe(true)
    expect(Object.isFrozen(received[0].scale)).toBe(true)
    expect(Object.isFrozen(received[1].rotate)).toBe(true)
    expect(Object.isFrozen((received[1].rotate as { axis: unknown }).axis)).toBe(true)
    expect(measurements.measureBoundingBox(part.geometry)).toEqual([
      [-1, -1, -1],
      [1, 1, 1],
    ])
  })

  it('accumulates primitive and nested Geometry positions relative to their parents', () => {
    const core = new Material('Core', {}, '#2563eb')

    function Child() {
      return h('box', { size, pos: [1, 1, 1] })
    }

    function Parent() {
      return h(Child, { pos: [4, 5, 6] })
    }

    const [part] = evaluateCad(h(Parent, { pos: [1, 2, 3], materials: [core] }))

    expect(measurements.measureBoundingBox(part.geometry)).toEqual([
      [5, 7, 9],
      [7, 9, 11],
    ])
  })

  it('applies child geometry, then scale, axis-angle rotate, and pos', () => {
    const core = new Material('Core', {}, '#2563eb')
    const rotated = evaluateCad(
      h(OffsetBox, {
        rotate: { axis: [0, 0, 5], angle: Math.PI / 2 },
        pos: [10, 0, 0],
        materials: [core],
      }),
    )[0]
    const scaled = evaluateCad(
      h(OffsetBox, { scale: [2, 1, 1], pos: [10, 0, 0], materials: [core] }),
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

  it('preserves custom props used to derive child-local transforms before applying the parent once', () => {
    const core = new Material('Core', {}, '#2563eb')
    let parentInput: Record<string, unknown> | undefined
    let childInput: Record<string, unknown> | undefined

    function Child(input: Record<string, unknown>) {
      childInput = input
      return h('box', { size: input.size })
    }

    function Parent(input: Record<string, unknown>) {
      parentInput = input
      const pos = input.pos as readonly number[]
      const rotate = input.rotate as { axis: readonly number[]; angle: number }
      const scale = input.scale as readonly number[]
      const gap = input.gap as number
      const profileScale = input.profileScale as number

      return h(Child, {
        size: [2 * scale[0], 2, 2],
        pos: [gap + pos[0] * 0.1, 0, 0],
        rotate: { axis: rotate.axis, angle: rotate.angle / 2 },
        scale: [profileScale, 1, 1],
      })
    }

    const [part] = evaluateCad(
      h(Parent, {
        pos: [10, 0, 0],
        rotate: { axis: [0, 0, 1], angle: Math.PI / 2 },
        scale: [2, 1, 1],
        gap: 1,
        profileScale: 0.5,
        materials: [core],
      }),
    )

    expect(parentInput).toMatchObject({ gap: 1, profileScale: 0.5 })
    expect(childInput).toMatchObject({
      size: [4, 2, 2],
      pos: [2, 0, 0],
      rotate: { axis: [0, 0, 1], angle: Math.PI / 4 },
      scale: [0.5, 1, 1],
    })

    const bounds = measurements.measureBoundingBox(part.geometry)
    expect(bounds[0][0]).toBeCloseTo(10 - Math.SQRT2)
    expect(bounds[1][0]).toBeCloseTo(10 + Math.SQRT2)
    expect(bounds[0][1]).toBeCloseTo(4 - 2 * Math.SQRT2)
    expect(bounds[1][1]).toBeCloseTo(4 + 2 * Math.SQRT2)
  })

  it('centers array cells and supports normalized non-orthogonal lattice axes', () => {
    const core = new Material('Core', {}, '#2563eb')

    function Cell() {
      return h('box', { size })
    }

    function Parent() {
      return h('array', { shape: [2, 1, 1], period: [4, 0, 0] }, h(Cell, null))
    }

    const centered = evaluateCad(h(Parent, { materials: [core] }))
    const oriented = evaluateCad(
      h(
        'array',
        {
          shape: [2, 2, 1],
          period: [4, 2, 0],
          axes: { x: [0, 2, 0], y: [1, 1, 0], z: [0, 0, 3] },
        },
        h(Cell, { materials: [core] }),
      ),
    )

    expect(centered.map((part) => measurements.measureBoundingBox(part.geometry))).toEqual([
      [[-3, -1, -1], [-1, 1, 1]],
      [[1, -1, -1], [3, 1, 1]],
    ])
    expect(oriented).toHaveLength(4)

    const centers = oriented.map((part) => {
      const bounds = measurements.measureBoundingBox(part.geometry)
      return bounds[0].map((minimum, axis) => (minimum + bounds[1][axis]) / 2)
    })
    const diagonal = 1 / Math.sqrt(2)
    const expected = [
      [-diagonal, -2 - diagonal, 0],
      [diagonal, -2 + diagonal, 0],
      [-diagonal, 2 - diagonal, 0],
      [diagonal, 2 + diagonal, 0],
    ]

    centers.forEach((center, cell) => {
      center.forEach((coordinate, axis) => expect(coordinate).toBeCloseTo(expected[cell][axis]))
    })
  })

  it('injects multiple custom and transform tensors over the child base props', () => {
    const core = new Material('Core', {}, '#2563eb')
    const received: Record<string, unknown>[] = []

    function Cell(input: Record<string, unknown>) {
      received.push(input)
      return h('box', { size: input.size })
    }

    const parts = evaluateCad(
      h(
        'array',
        {
          shape: [2, 1, 1],
          period: [10, 0, 0],
          inject: {
            size: [[[[2, 2, 2]]], [[[4, 2, 2]]]],
            holeRadius: [[[1]], [[2]]],
            pos: [[[[1, 0, 0]]], [[[-1, 0, 0]]]],
            scale: [[[[1, 1, 1]]], [[[0.5, 2, 1]]]],
            rotate: {
              axis: [[[[0, 0, 1]]], [[[0, 0, 5]]]],
              angle: [[[0]], [[Math.PI / 2]]],
            },
          },
        },
        h(Cell, {
          size: [1, 1, 1],
          holeRadius: 0,
          label: 'preserved',
          pos: [99, 0, 0],
          materials: [core],
        }),
      ),
    )

    expect(received).toHaveLength(2)
    expect(received[0]).toMatchObject({
      size: [2, 2, 2],
      holeRadius: 1,
      label: 'preserved',
      pos: [1, 0, 0],
      scale: [1, 1, 1],
      rotate: { axis: [0, 0, 1], angle: 0 },
    })
    expect(received[1]).toMatchObject({
      size: [4, 2, 2],
      holeRadius: 2,
      pos: [-1, 0, 0],
      scale: [0.5, 2, 1],
      rotate: { axis: [0, 0, 1], angle: Math.PI / 2 },
    })
    expect(parts.map((part) => part.materialName)).toEqual(['Core', 'Core'])

    const centers = parts.map((part) => {
      const bounds = measurements.measureBoundingBox(part.geometry)
      return bounds[0].map((minimum, axis) => (minimum + bounds[1][axis]) / 2)
    })
    expect(centers).toEqual([[-4, 0, 0], [4, 0, 0]])
  })

  it('applies child transforms, lattice offset, array transforms, and parent transforms in order', () => {
    const core = new Material('Core', {}, '#2563eb')

    function Cell() {
      return h('box', { size })
    }

    function Parent() {
      return h(
        'array',
        {
          shape: [2, 1, 1],
          period: [4, 0, 0],
          inject: { pos: [[[[1, 0, 0]]], [[[1, 0, 0]]]] },
          scale: [2, 1, 1],
          rotate: { axis: [0, 0, 1], angle: Math.PI / 2 },
          pos: [10, 0, 0],
        },
        h(Cell, null),
      )
    }

    const parts = evaluateCad(h(Parent, { pos: [0, 5, 0], materials: [core] }))
    const centers = parts.map((part) => {
      const bounds = measurements.measureBoundingBox(part.geometry)
      return bounds[0].map((minimum, axis) => (minimum + bounds[1][axis]) / 2)
    })

    expect(centers[0][0]).toBeCloseTo(10)
    expect(centers[0][1]).toBeCloseTo(3)
    expect(centers[1][0]).toBeCloseTo(10)
    expect(centers[1][1]).toBeCloseTo(11)
  })

  it('applies scale, rotate, and pos to primitive and completed boolean results', () => {
    const core = new Material('Core', {}, '#2563eb')
    function Primitive() {
      return h('box', {
        size: [2, 4, 2],
        scale: [2, 1, 1],
        rotate: { axis: [0, 0, 1], angle: Math.PI / 2 },
        pos: [10, 0, 0],
      })
    }

    const [primitive] = evaluateCad(h(Primitive, { materials: [core] }))
    const [combined] = evaluateCad(
      h(
        'union',
        {
          scale: [2, 1, 1],
          rotate: { axis: [0, 0, 5], angle: Math.PI / 2 },
          pos: [5, 0, 0],
        },
        h(Box, { materials: [core] }),
        h(Box, { pos: [2, 0, 0], materials: [core] }),
      ),
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
    const core = new Material('Core', {}, '#2563eb')
    const evaluate = (axis: number[]) =>
      evaluateCad(
        h(OffsetBox, { rotate: { axis, angle: Math.PI / 2 }, materials: [core] }),
      )[0].geometry

    expect(measurements.measureBoundingBox(evaluate([0, 0, 5]))).toEqual(
      measurements.measureBoundingBox(evaluate([0, 0, 1])),
    )
  })

  it('inherits materials through nested Geometry without registration', () => {
    const core = new Material('Core', { epsilon: 12 }, '#2563eb')

    function Parent() {
      return h(Box, null)
    }

    const parts = evaluateCad(h(Parent, { materials: [core] }))

    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({ materialName: 'Core', displayColor: '#2563eb' })
  })

  it('allows a materialless Geometry to group children with their own Materials', () => {
    const core = new Material('Core', {}, '#2563eb')
    const cladding = new Material('Cladding', {}, '#f59e0b')
    let groupMaterials: unknown = 'not evaluated'

    function Group(input: Record<string, unknown>) {
      groupMaterials = input.materials
      return h(
        Fragment,
        null,
        h(Box, { materials: [core] }),
        h(Box, { pos: [3, 0, 0], materials: [cladding] }),
      )
    }

    const parts = evaluateCad(h(Group, null))

    expect(groupMaterials).toBeUndefined()
    expect(parts.map((part) => part.materialName)).toEqual(['Core', 'Cladding'])
  })

  it('requires an effective Material only when a primitive is created', () => {
    function MateriallessBox() {
      return h('box', { size })
    }

    expect(() => evaluateCad(h(MateriallessBox, null))).toThrow(
      '<box> requires an explicit or inherited Material',
    )
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

  it('preserves different Material parts under positioned Geometry', () => {
    const core = new Material('Core', {}, '#2563eb')
    const cladding = new Material('Cladding', {}, '#f59e0b')
    const root = h(Fragment, null, h(Box, { pos: [0, 0, 2], materials: [core] }), h(Box, { materials: [cladding] }))

    expect(evaluateCad(root).map((part) => part.materialName)).toEqual(['Core', 'Cladding'])
  })

  it('rejects invalid transforms, Fragment transforms, and removed transform elements', () => {
    const core = new Material('Core', {}, '#2563eb')

    ;[null, 1, [1, 2], [1, 2, 3, 4], [1, '2', 3], [1, Number.NaN, 3], [1, Number.POSITIVE_INFINITY, 3]].forEach(
      (pos) => {
        expect(() => evaluateCad(h('box', { size, pos, materials: [core] }))).toThrow(
          'pos must be an array of exactly three finite numbers',
        )
      },
    )

    expect(() => evaluateCad(h(Fragment, { pos: [1, 2, 3] }, h(Box, { materials: [core] })))).toThrow(
      'Fragment does not accept pos, rotate, or scale',
    )

    ;[null, 1, [1, 2, 3], { axis: [0, 0, 1] }].forEach((rotate) => {
      expect(() => evaluateCad(h(Box, { rotate, materials: [core] }))).toThrow()
    })
    ;[[0, 0, 0], [1, 2], [1, Number.NaN, 0]].forEach((axis) => {
      expect(() => evaluateCad(h(Box, { rotate: { axis, angle: 1 }, materials: [core] }))).toThrow(
        'rotate.axis',
      )
    })
    ;[Number.NaN, Number.POSITIVE_INFINITY, '1'].forEach((angle) => {
      expect(() => evaluateCad(h(Box, { rotate: { axis: [0, 0, 1], angle }, materials: [core] }))).toThrow(
        'rotate.angle must be a finite number',
      )
    })
    ;[[1, 2], [1, 2, 3, 4], [1, Number.NaN, 1]].forEach((scale) => {
      expect(() => evaluateCad(h(Box, { scale, materials: [core] }))).toThrow(
        'scale must be an array of exactly three finite numbers',
      )
    })

    expect(() => evaluateCad(h('translate', { pos: [1, 2, 3], materials: [core] }, h(Box, null)))).toThrow(
      'Use the relative pos attribute instead',
    )
    expect(() => evaluateCad(h('rotate', null, h(Box, { materials: [core] })))).toThrow(
      'Use the axis-angle rotate attribute instead',
    )
    expect(() => evaluateCad(h('scale', null, h(Box, { materials: [core] })))).toThrow(
      'Use the scale attribute instead',
    )
  })

  it('rejects invalid array shape, period, and axes', () => {
    const core = new Material('Core', {}, '#2563eb')
    const child = h(Box, { materials: [core] })

    ;[null, [1, 1], [1, 1, 0], [1, 1, 1.5], [1, 1, Number.NaN]].forEach((shape) => {
      expect(() => evaluateCad(h('array', { shape, period: [1, 1, 1] }, child))).toThrow(
        '<array> shape must be an array of exactly three positive integers',
      )
    })

    ;[[0, 0, 0], [-1, 0, 0], [1, Number.NaN, 0], [1, 0]].forEach((period) => {
      expect(() => evaluateCad(h('array', { shape: [2, 1, 1], period }, child))).toThrow(
        '<array> period',
      )
    })

    ;[
      null,
      { x: [1, 0, 0], z: [0, 0, 1] },
      { x: [0, 0, 0], y: [0, 1, 0], z: [0, 0, 1] },
      { x: [1, 0, 0], y: [0, Number.POSITIVE_INFINITY, 0], z: [0, 0, 1] },
    ].forEach((axes) => {
      expect(() => evaluateCad(h('array', { shape: [1, 1, 1], period: [0, 0, 0], axes }, child))).toThrow(
        '<array> axes',
      )
    })
  })

  it('rejects malformed or forbidden array injection tensors', () => {
    const core = new Material('Core', {}, '#2563eb')
    const child = h(Box, { materials: [core] })
    const evaluate = (inject: unknown) =>
      evaluateCad(h('array', { shape: [2, 1, 1], period: [2, 0, 0], inject }, child))

    expect(() => evaluate(null)).toThrow('<array> inject must be an object')
    expect(() => evaluate({ materials: [[[1]], [[1]]] })).toThrow('inject.materials is not supported')
    expect(() => evaluate({ children: [[[1]], [[1]]] })).toThrow('inject.children is not supported')
    expect(() => evaluate({ radius: [[[1]]] })).toThrow('must start with shape [2, 1, 1]')
    expect(() => evaluate({ radius: [[[1]], [[1, 2]]] })).toThrow('dense rectangular tensor')
    expect(() => evaluate({ radius: [[[1]], [[Number.NaN]]] })).toThrow('finite numbers')
    expect(() => evaluate({ pos: [[[[0, 0]]], [[[0, 0]]]] })).toThrow('must have shape [2, 1, 1, 3]')
    expect(() =>
      evaluate({ rotate: { axis: [[[[0, 0, 1]]], [[[0, 0, 1]]]], angle: [[[0]]] } }),
    ).toThrow('inject.rotate.angle must have shape [2, 1, 1]')
    expect(() => evaluate({ rotate: [[[[0, 0, 1, 0]]], [[[0, 0, 1, 0]]]] })).toThrow(
      'inject.rotate must be an object with axis and angle tensors',
    )
  })

  it('requires exactly one direct function Geometry child for array', () => {
    const core = new Material('Core', {}, '#2563eb')
    const props = { shape: [1, 1, 1], period: [0, 0, 0] }

    expect(() => evaluateCad(h('array', props))).toThrow('exactly one direct child Geometry')
    expect(() => evaluateCad(h('array', props, h(Box, { materials: [core] }), h(Box, { materials: [core] })))).toThrow(
      'exactly one direct child Geometry',
    )
    expect(() => evaluateCad(h('array', props, h('box', { size, materials: [core] })))).toThrow(
      'exactly one direct child Geometry',
    )
    expect(() => evaluateCad(h('array', props, h(Fragment, null, h(Box, { materials: [core] }))))).toThrow(
      'exactly one direct child Geometry',
    )
  })

  it('keeps array cells independent and preserves existing Material boolean rules', () => {
    const core = new Material('Core', {}, '#2563eb')
    const cladding = new Material('Cladding', {}, '#f59e0b')
    const arrayProps = { shape: [2, 1, 1], period: [3, 0, 0] }

    expect(evaluateCad(h('array', arrayProps, h(Box, { materials: [core] })))).toHaveLength(2)
    expect(evaluateCad(h('union', null, h('array', arrayProps, h(Box, { materials: [core] }))))).toHaveLength(1)

    function MixedCell() {
      return h(
        Fragment,
        null,
        h(Box, { materials: [core] }),
        h(Box, { pos: [1, 0, 0], materials: [cladding] }),
      )
    }

    expect(() =>
      evaluateCad(
        h('union', null, h('array', { shape: [1, 1, 1], period: [0, 0, 0] }, h(MixedCell, null))),
      ),
    ).toThrow('cannot combine Geometry with different Materials')
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
    expect(() => evaluateCad(h(Box, { materials: [] }))).toThrow('non-empty array of Material instances')

    const first = new Material('Core', {}, '#2563eb')
    const second = new Material('Core', {}, '#f59e0b')
    const root = h(Fragment, null, h(Box, { materials: [first] }), h(Box, { materials: [second] }))

    expect(() => evaluateCad(root)).toThrow('used by more than one Material instance')
  })
})
