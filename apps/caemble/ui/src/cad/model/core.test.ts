import { describe, expect, it } from 'vitest'
import {
  CadModelError,
  evaluateExperimentRules,
  Material,
  Experiment,
  Sample,
  Setup,
  Structure,
  VariableObject,
  evaluateWithVars,
  vars,
  type Geometry,
  type GeometryAttributes,
} from './core'

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

  it('normalizes, deduplicates, and deeply freezes Structure groups', () => {
    const structure = new Structure({
      geometry: () => null,
      varsSchema: {},
      geometryGroup: {
        ' 본체 ': [' assembly.body ', 'assembly.body', 'missing'],
      },
      surfaceGroup: { 접촉면: [] },
    })

    expect(structure.geometryGroup).toEqual({ 본체: ['assembly.body', 'missing'] })
    expect(structure.surfaceGroup).toEqual({ 접촉면: [] })
    expect(Object.isFrozen(structure.geometryGroup)).toBe(true)
    expect(Object.isFrozen(structure.geometryGroup.본체)).toBe(true)
    expect(Object.isFrozen(structure.surfaceGroup.접촉면)).toBe(true)
    expect(createStructure().geometryGroup).toEqual({})
  })

  it('rejects malformed Structure group maps, names, and members', () => {
    const options = { geometry: () => null, varsSchema: {} }

    expect(() => new Structure({ ...options, geometryGroup: [] as never })).toThrow('geometryGroup must be an object')
    expect(() => new Structure({ ...options, geometryGroup: { ' ': [] } })).toThrow('group names must not be empty')
    expect(() => new Structure({
      ...options,
      geometryGroup: { duplicate: [], ' duplicate ': [] },
    })).toThrow('duplicated after trimming')
    expect(() => new Structure({
      ...options,
      geometryGroup: { invalid: 'assembly' as never },
    })).toThrow('must be an array')
    expect(() => new Structure({
      ...options,
      surfaceGroup: { invalid: [''] },
    })).toThrow('must be a non-empty string')
    expect(() => new Structure({
      ...options,
      surfaceGroup: { invalid: [1 as never] },
    })).toThrow('must be a non-empty string')
  })
})

describe('Experiment and Setup', () => {
  it('inherits Structure behavior and exposes VariableObject aliases', () => {
    const structure = createStructure()
    const sample = new Sample(structure, { width: 24 })
    const experiment = new Experiment({
      geometry: () => null,
      varsSchema: {
        initialValue: { shape: [], default: 0.25, min: 0, max: 1 },
      },
      geometryGroup: { domain: [] },
      surfaceGroup: { 'outer.boundary': [] },
    })
    const setup = new Setup(experiment, { initialValue: 0.75 })

    expect(experiment).toBeInstanceOf(Structure)
    expect(experiment.randomVars(7).initialValue).toBeGreaterThanOrEqual(0)
    expect(sample.object).toBe(structure)
    expect(sample.structure).toBe(structure)
    expect(setup.object).toBe(experiment)
    expect(setup.experiment).toBe(experiment)
    expect(setup.vars.initialValue).toBe(0.75)
    expect(Object.isFrozen(experiment)).toBe(true)
    expect(Object.isFrozen(sample)).toBe(true)
    expect(Object.isFrozen(setup)).toBe(true)
  })

  it('rejects invalid VariableObject pairings and direct abstract construction', () => {
    const structure = createStructure()
    const experiment = new Experiment({ geometry: () => null, varsSchema: {} })
    const DirectVariableObject = VariableObject as unknown as new (
      object: Structure,
    ) => VariableObject<Structure>

    expect(() => new Sample(experiment)).toThrow('Use Setup instead')
    expect(() => new Setup(structure as never)).toThrow('Setup requires an Experiment')
    expect(() => new DirectVariableObject(structure)).toThrow('abstract and cannot be instantiated directly')
  })

  it('normalizes ordered rule target arrays while preserving duplicates and opaque values', () => {
    const timeValue = (time: number) => time * 2
    const experiment = new Experiment<Readonly<{ initialValue: number }>, Readonly<{ value: number | typeof timeValue }>>({
      geometry: () => null,
      varsSchema: { initialValue: { shape: [], default: 0.5 } },
      geometryGroup: { domain: [] },
      surfaceGroup: { 'outer.boundary': [] },
      initialConditions: () => [
        {
          target: [
            ' experiment.geometry.domain ' as 'experiment.geometry.domain',
            'structure.geometry.sample',
            'structure.geometry.sample',
          ],
          value: { initialValue: vars.initialValue as number },
        },
        {
          target: ['structure.geometry.sample'],
          value: { initialValue: 1 },
        },
      ],
      boundaryConditions: () => [
        {
          target: ['experiment.surface.outer.boundary', 'structure.surface.sampleBoundary'],
          value: { value: timeValue },
        },
      ],
    })
    const setup = new Setup(experiment, { initialValue: 0.75 })
    const rules = evaluateWithVars(setup.vars, () => evaluateExperimentRules(experiment))

    expect(rules.initialConditions.map(({ target }) => target)).toEqual([
      ['experiment.geometry.domain', 'structure.geometry.sample', 'structure.geometry.sample'],
      ['structure.geometry.sample'],
    ])
    expect(rules.initialConditions[0].value).toEqual({ initialValue: 0.75 })
    expect(rules.boundaryConditions[0].target).toEqual([
      'experiment.surface.outer.boundary', 'structure.surface.sampleBoundary',
    ])
    expect(rules.boundaryConditions[0].value.value).toBe(timeValue)
    expect(Object.isFrozen(rules.initialConditions)).toBe(true)
    expect(Object.isFrozen(rules.initialConditions[0])).toBe(true)
    expect(Object.isFrozen(rules.initialConditions[0].target)).toBe(true)
  })

  it('rejects empty, malformed, non-string, or unresolved Experiment rule targets', () => {
    const createExperiment = (target: unknown) => new Experiment({
      geometry: () => null,
      varsSchema: {},
      geometryGroup: { domain: [] },
      initialConditions: () => [{ target, value: null }] as never,
    })

    expect(() => evaluateExperimentRules(createExperiment([]))).toThrow('target must be a non-empty array')
    expect(() => evaluateExperimentRules(createExperiment('experiment.geometry.domain'))).toThrow(
      'target must be a non-empty array',
    )
    expect(() => evaluateExperimentRules(createExperiment([42]))).toThrow('target[0] must be a string')

    ;['domain', 'other.geometry.domain', 'experiment.volume.domain', 'experiment.geometry.'].forEach((target) => {
      const experiment = createExperiment([target])
      expect(() => evaluateExperimentRules(experiment), target).toThrow('source.kind.group format')
    })

    const missing = createExperiment(['experiment.geometry.missing'])
    expect(() => evaluateExperimentRules(missing)).toThrow('missing geometry group "missing"')

    const nonArray = new Experiment({
      geometry: () => null,
      varsSchema: {},
      initialConditions: (() => null) as never,
    })
    expect(() => evaluateExperimentRules(nonArray)).toThrow('initialConditions must return an array')
  })
})

describe('Material and global vars', () => {
  it('supports every Material constructor overload', () => {
    expect(new Material('Al')).toMatchObject({ symbol: 'Al', variables: {} })
    expect(new Material('Al', { density: 2.7 })).toMatchObject({
      symbol: 'Al',
      variables: { density: 2.7 },
    })
    expect(new Material('Al', 'Kittel_1988')).toMatchObject({
      symbol: 'Al',
      version: 'Kittel_1988',
      variables: {},
    })
    expect(new Material('Al', 'Kittel_1988', { density: 2.7 })).toMatchObject({
      symbol: 'Al',
      version: 'Kittel_1988',
      variables: { density: 2.7 },
    })
    expect(new Material('Al').variables).not.toHaveProperty('color')
  })

  it('constructs Materials after vars are bound and deeply freezes JSON variables', () => {
    const sample = new Sample(createStructure(), { width: 24 })
    const source = {
      color: '#ABCDEF',
      metadata: { active: true, aliases: ['core', null] },
    }
    const material = evaluateWithVars(sample.vars, () => new Material('Core', 'measured', {
      epsilon: vars.width,
      source,
    }))

    expect(material.variables).toEqual({
      epsilon: 24,
      source: { color: '#ABCDEF', metadata: { active: true, aliases: ['core', null] } },
    })
    expect(Object.isFrozen(material.variables)).toBe(true)
    expect(Object.isFrozen(material.variables.source)).toBe(true)
    expect(Object.isFrozen((material.variables.source as { metadata: object }).metadata)).toBe(true)
    source.metadata.aliases[0] = 'changed'
    expect(material.variables).not.toEqual(expect.objectContaining({
      source: expect.objectContaining({ metadata: expect.objectContaining({ aliases: ['changed', null] }) }),
    }))
    expect(() => {
      ;(material.variables as Record<string, number>).epsilon = 3
    }).toThrow()

    const colored = new Material('SiO2', { color: '#A1B2C3' })
    expect(colored.variables.color).toBe('#a1b2c3')
  })

  it('does not expose global vars outside Sample evaluation', () => {
    expect(() => vars.width).toThrow(CadModelError)
  })

  it('rejects invalid Material metadata and non-JSON variables', () => {
    expect(() => new Material('', {})).toThrow('non-empty string')
    expect(() => new Material('Core', ' ')).toThrow('version must be a non-empty string')
    expect(() => new Material('Core', { values: [1, Number.POSITIVE_INFINITY] })).toThrow('finite number')
    expect(() => new Material('Core', { color: 'blue' })).toThrow('#RRGGBB')
    expect(() => new Material('Core', null as never)).toThrow('plain object')
    expect(() => new Material('Core', 'measured', null as never)).toThrow('plain object')
    expect(() => new Material('Core', { value: undefined } as never)).toThrow('JSON-compatible')
    expect(() => new Material('Core', { value: () => 1 } as never)).toThrow('JSON-compatible')
    expect(() => new Material('Core', { value: new Date() } as never)).toThrow('plain objects')

    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(() => new Material('Core', circular as never)).toThrow('circular references')

    const LegacyMaterial = Material as unknown as new (...args: unknown[]) => Material
    expect(() => new LegacyMaterial('Core', {}, '#2563eb')).toThrow('string version')
  })
})

describe('Geometry types', () => {
  it('combines custom props with shared Geometry attributes', () => {
    type LayoutProps = { gap: number; label: string }
    const attributes: GeometryAttributes<LayoutProps> = {
      id: 'layout',
      gap: 4,
      label: 'core',
      pos: [1, 2, 3],
      rotate: { axis: [0, 0, 1], angle: Math.PI / 4 },
      scale: [1, 2, 1],
    }
    const layout: Geometry<LayoutProps> = (input) => ({
      gap: input.gap,
      label: input.label,
      pos: input.pos,
    })

    expect(layout(attributes)).toEqual({ gap: 4, label: 'core', pos: [1, 2, 3] })
  })
})


