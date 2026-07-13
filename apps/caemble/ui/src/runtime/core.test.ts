import { describe, expect, it } from 'vitest'
import { CadModelError, Material, Sample, Structure, evaluateWithVars, vars } from './core'

function createStructure() {
  return new Structure({
    geometry: () => null,
    varsSchema: {
      width: { shape: [], default: 20, min: 10, max: 30 },
      offset: {
        shape: [2],
        default: [0, 1],
        min: -2,
        max: [2, 3],
      },
      fixed: { shape: [2, 2], default: [[1, 2], [3, 4]] },
    },
  })
}

describe('Structure and Sample vars', () => {
  it('fills defaults and applies validated partial vars', () => {
    const sample = new Sample(createStructure(), { width: 25 })

    expect(sample.vars).toEqual({
      width: 25,
      offset: [0, 1],
      fixed: [[1, 2], [3, 4]],
    })
    expect(Object.isFrozen(sample.vars)).toBe(true)
    expect(Object.isFrozen(sample.vars.fixed)).toBe(true)
  })

  it('rejects unknown, malformed, non-finite, and out-of-range vars', () => {
    const structure = createStructure()

    expect(() => new Sample(structure, { extra: 1 })).toThrow('Unknown Sample var: extra')
    expect(() => new Sample(structure, { offset: [1] })).toThrow('must have shape [2]')
    expect(() => new Sample(structure, { fixed: [[1, 2], [3]] })).toThrow('must have shape [2]')
    expect(() => new Sample(structure, { width: Number.NaN })).toThrow('must be a finite number')
    expect(() => new Sample(structure, { width: 31 })).toThrow('less than or equal to 30')
  })

  it('validates schema defaults and scalar or tensor bounds', () => {
    expect(
      () =>
        new Structure({
          geometry: () => null,
          varsSchema: {
            invalid: { shape: [2], default: [0, 3], min: [0, 0], max: [2, 2] },
          },
        }),
    ).toThrow('less than or equal to 2')

    expect(
      () =>
        new Structure({
          geometry: () => null,
          varsSchema: {
            invalid: { shape: [], default: 1, min: 0 },
          },
        }),
    ).toThrow('must define both min and max')
  })

  it('generates deterministic seeded vars within scalar-broadcast and tensor bounds', () => {
    const structure = createStructure()
    const first = structure.randomVars(260713)
    const second = structure.randomVars(260713)

    expect(first).toEqual(second)
    expect(first.width).toBeGreaterThanOrEqual(10)
    expect(first.width).toBeLessThanOrEqual(30)
    expect((first.offset as readonly number[])[0]).toBeGreaterThanOrEqual(-2)
    expect((first.offset as readonly number[])[0]).toBeLessThanOrEqual(2)
    expect((first.offset as readonly number[])[1]).toBeLessThanOrEqual(3)
    expect(first.fixed).toEqual([[1, 2], [3, 4]])
  })
})

describe('Material and global vars', () => {
  it('constructs Materials after vars are bound and keeps Material vars immutable', () => {
    const sample = new Sample(createStructure(), { width: 24 })
    const material = evaluateWithVars(sample.vars, () => new Material('Core', { epsilon: vars.width }, '#2563eb'))

    expect(material.vars).toEqual({ epsilon: 24 })
    expect(Object.isFrozen(material.vars)).toBe(true)
    expect(() => {
      ;(material.vars as Record<string, number>).epsilon = 3
    }).toThrow()
  })

  it('does not expose global vars outside Sample evaluation', () => {
    expect(() => vars.width).toThrow(CadModelError)
  })

  it('rejects invalid Material names, tensors, and colors', () => {
    expect(() => new Material('', {})).toThrow('non-empty string')
    expect(() => new Material('Core', { values: [1, Number.POSITIVE_INFINITY] })).toThrow('finite number')
    expect(() => new Material('Core', {}, 'blue')).toThrow('#RRGGBB')
  })
})
