import { describe, expect, it } from 'vitest'
import {
  CadModelError,
  evaluateExperimentRules,
  evaluateExperimentSolver,
  normalizeExperimentTensorParameter,
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
  type ExperimentTensorDType,
  type ExperimentTensorParameter,
} from './core'

function createSolver(parameters: () => Record<string, never> = () => ({})) {
  return { name: 'test-solver', version: '1.0.0', parameters }
}

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
      solver: createSolver(),
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
    expect(experiment.recordedData()).toEqual([])
    expect(Object.isFrozen(experiment)).toBe(true)
    expect(Object.isFrozen(sample)).toBe(true)
    expect(Object.isFrozen(setup)).toBe(true)
  })

  it('rejects invalid VariableObject pairings and direct abstract construction', () => {
    const structure = createStructure()
    const experiment = new Experiment({ solver: createSolver(), geometry: () => null, varsSchema: {} })
    const DirectVariableObject = VariableObject as unknown as new (
      object: Structure,
    ) => VariableObject<Structure>

    expect(() => new Sample(experiment)).toThrow('Use Setup instead')
    expect(() => new Setup(structure as never)).toThrow('Setup requires an Experiment')
    expect(() => new DirectVariableObject(structure)).toThrow('abstract and cannot be instantiated directly')
  })

  it('evaluates, copies, and freezes all method rows in order under Setup vars', () => {
    const order: string[] = []
    const profile = [[0.1, 0.2], [0.3, 0.4]]
    const experiment = new Experiment<
      Readonly<{
        initialValue: number
        profile: ExperimentTensorParameter
      }>,
      Readonly<{ active: boolean; label: Readonly<{ type: 'string'; value: string }> }>,
      Readonly<{ interval: Readonly<{ type: 'int'; value: number }> }>
    >({
      solver: createSolver(),
      geometry: () => {
        order.push('geometry')
        return null
      },
      varsSchema: { initialValue: { shape: [], default: 0.5 } },
      geometryGroup: { domain: [] },
      surfaceGroup: { 'outer.boundary': [] },
      initialConditions: () => {
        order.push('initialConditions')
        return [{
          target: [
            ' experiment.geometry.domain ' as 'experiment.geometry.domain',
            'structure.geometry.sample',
            'structure.geometry.sample',
          ],
          label: ' Shared label ',
          methodId: ' field.apply ',
          parameters: {
            initialValue: vars.initialValue as number,
            profile: {
              type: 'tensor',
              dimension: 2,
              shape: [2, 2],
              dtype: 'float32',
              value: profile,
            },
          },
        }]
      },
      boundaryConditions: () => {
        order.push('boundaryConditions')
        return [{
          target: ['experiment.surface.outer.boundary', 'structure.surface.sampleBoundary'],
          label: 'Shared label',
          methodId: 'field.apply',
          parameters: { active: true, label: { type: 'string', value: 'fixed' } },
        }]
      },
      recordedData: () => {
        order.push('recordedData')
        return [{
          target: [
            'experiment.geometry.domain',
            'structure.geometry.sample',
            'experiment.surface.outer.boundary',
            'structure.surface.sampleBoundary',
          ],
          label: ' Recorded field ',
          methodId: ' field.record ',
          parameters: { interval: { type: 'int', value: 10 } },
          result: { type: 'tensor', dimension: 0, shape: [], dtype: 'float64' },
        }]
      },
    })
    const setup = new Setup(experiment, { initialValue: 0.75 })
    const rules = evaluateWithVars(setup.vars, () => {
      experiment.geometry()
      return evaluateExperimentRules(experiment)
    })

    expect(order).toEqual(['geometry', 'initialConditions', 'boundaryConditions', 'recordedData'])
    expect(rules.initialConditions[0]).toMatchObject({
      target: ['experiment.geometry.domain', 'structure.geometry.sample', 'structure.geometry.sample'],
      label: 'Shared label',
      methodId: 'field.apply',
      parameters: { initialValue: 0.75 },
    })
    expect(rules.initialConditions[0].parameters.profile).toEqual({
      type: 'tensor',
      dimension: 2,
      shape: [2, 2],
      dtype: 'float32',
      axes: [
        { name: 'axis 0', ticks: [0, 1] },
        { name: 'axis 1', ticks: [0, 1] },
      ],
      value: profile,
    })
    expect(rules.boundaryConditions[0].target).toEqual([
      'experiment.surface.outer.boundary', 'structure.surface.sampleBoundary',
    ])
    expect(rules.boundaryConditions[0].parameters).toEqual({
      active: true,
      label: { type: 'string', value: 'fixed' },
    })
    expect(rules.recordedData[0]).toMatchObject({
      target: [
        'experiment.geometry.domain',
        'structure.geometry.sample',
        'experiment.surface.outer.boundary',
        'structure.surface.sampleBoundary',
      ],
      label: 'Recorded field',
      methodId: 'field.record',
      result: { type: 'tensor', dimension: 0, shape: [], dtype: 'float64' },
    })
    expect(rules.recordedData[0].parameters).toEqual({ interval: { type: 'int', value: 10 } })
    expect(Object.isFrozen(rules.initialConditions)).toBe(true)
    expect(Object.isFrozen(rules.initialConditions[0])).toBe(true)
    expect(Object.isFrozen(rules.initialConditions[0].target)).toBe(true)
    expect(Object.isFrozen(rules.initialConditions[0].parameters)).toBe(true)
    expect(Object.isFrozen(rules.initialConditions[0].parameters.profile)).toBe(true)
    expect(Object.isFrozen(rules.initialConditions[0].parameters.profile.shape)).toBe(true)
    expect(Object.isFrozen(rules.initialConditions[0].parameters.profile.axes)).toBe(true)
    expect(Object.isFrozen(rules.initialConditions[0].parameters.profile.axes?.[0])).toBe(true)
    expect(Object.isFrozen(rules.initialConditions[0].parameters.profile.axes?.[0].ticks)).toBe(true)
    expect(Object.isFrozen(rules.initialConditions[0].parameters.profile.value)).toBe(true)
    expect(Object.isFrozen(rules.recordedData)).toBe(true)
    expect(Object.isFrozen(rules.recordedData[0].result)).toBe(true)
    expect(Object.isFrozen(rules.recordedData[0].result.shape)).toBe(true)
    expect(Object.isFrozen(rules.recordedData[0].result.axes)).toBe(true)
    profile[0][0] = 9
    expect(rules.initialConditions[0].parameters.profile.value).toEqual([[0.1, 0.2], [0.3, 0.4]])
  })

  it('accepts raw and explicit scalar parameters and rejects every unsupported parameter form', () => {
    const evaluateParameter = (parameter: unknown) => evaluateExperimentRules(new Experiment({
      solver: createSolver(),
      geometry: () => null,
      varsSchema: {},
      initialConditions: () => [{
        target: ['structure.geometry.sample'],
        label: 'Scalar',
        methodId: 'scalar.apply',
        parameters: { value: parameter },
      }] as never,
    })).initialConditions[0].parameters.value

    expect(evaluateParameter(true)).toBe(true)
    expect(evaluateParameter('text')).toBe('text')
    expect(evaluateParameter(12)).toBe(12)
    expect(evaluateParameter(1.25)).toBe(1.25)
    expect(evaluateParameter({ type: 'bool', value: false })).toEqual({ type: 'bool', value: false })
    expect(evaluateParameter({ type: 'string', value: 'value' })).toEqual({ type: 'string', value: 'value' })
    expect(evaluateParameter({ type: 'int', value: 4 })).toEqual({ type: 'int', value: 4 })
    expect(evaluateParameter({ type: 'float', value: 4 })).toEqual({ type: 'float', value: 4 })

    ;[
      () => 1,
      null,
      [1, 2],
      { nested: true },
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
      { type: 'bool', value: 1 },
      { type: 'string', value: false },
      { type: 'int', value: 1.5 },
      { type: 'float', value: Number.NEGATIVE_INFINITY },
    ].forEach((parameter) => {
      expect(() => evaluateParameter(parameter)).toThrow(CadModelError)
    })
  })

  it('validates every tensor dtype without rounding accepted values', () => {
    const valid: readonly [ExperimentTensorDType, unknown][] = [
      ['bool', [true]],
      ['string', ['value']],
      ['int8', [-128, 127]],
      ['int16', [-32768, 32767]],
      ['int32', [-2147483648, 2147483647]],
      ['int64', [-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]],
      ['uint8', [0, 255]],
      ['uint16', [0, 65535]],
      ['uint32', [0, 4294967295]],
      ['uint64', [0, Number.MAX_SAFE_INTEGER]],
      ['float16', [-65504, 65504]],
      ['float32', [0.1, 3.4028234e38]],
      ['float64', [Number.MIN_VALUE, Number.MAX_VALUE]],
    ]

    valid.forEach(([dtype, value]) => {
      const normalized = normalizeExperimentTensorParameter({
        type: 'tensor',
        dimension: 1,
        shape: [(value as unknown[]).length],
        dtype,
        value,
      })
      expect(normalized.value).toEqual(value)
    })

    const invalid: readonly [ExperimentTensorDType, unknown][] = [
      ['bool', [1]],
      ['string', [true]],
      ['int8', [128]],
      ['int16', [32768]],
      ['int32', [2147483648]],
      ['int64', [Number.MAX_SAFE_INTEGER + 1]],
      ['uint8', [-1]],
      ['uint16', [65536]],
      ['uint32', [4294967296]],
      ['uint64', [-1]],
      ['float16', [65505]],
      ['float32', [3.5e38]],
      ['float64', [Number.POSITIVE_INFINITY]],
    ]
    invalid.forEach(([dtype, value]) => {
      expect(() => normalizeExperimentTensorParameter({
        type: 'tensor',
        dimension: 1,
        shape: [1],
        dtype,
        value,
      }), dtype).toThrow(CadModelError)
    })
  })

  it('normalizes optional tensor axes with 0-based defaults and deeply freezes them', () => {
    const sourceAxes = [
      { name: ' layer ', ticks: ['lower', 'upper'] },
      { ticks: [0, 0.5, 1] },
    ]
    const explicit = normalizeExperimentTensorParameter({
      type: 'tensor',
      dimension: 2,
      shape: [2, 3],
      dtype: 'float32',
      axes: sourceAxes,
      value: [[1, 2, 3], [4, 5, 6]],
    })
    const defaults = normalizeExperimentTensorParameter({
      type: 'tensor',
      dimension: 1,
      shape: [3],
      dtype: 'float32',
      value: [1, 2, 3],
    })

    expect(explicit.axes).toEqual([
      { name: 'layer', ticks: ['lower', 'upper'] },
      { name: 'axis 1', ticks: [0, 0.5, 1] },
    ])
    expect(defaults.axes).toEqual([{ name: 'axis 0', ticks: [0, 1, 2] }])
    expect(Object.isFrozen(explicit.axes)).toBe(true)
    expect(Object.isFrozen(explicit.axes?.[0])).toBe(true)
    expect(Object.isFrozen(explicit.axes?.[0].ticks)).toBe(true)
    sourceAxes[0].name = 'changed'
    sourceAxes[0].ticks[0] = 'changed'
    expect(explicit.axes?.[0]).toEqual({ name: 'layer', ticks: ['lower', 'upper'] })
  })

  it('rejects malformed tensor axes and reports actual and expected lengths', () => {
    const descriptor = {
      type: 'tensor',
      dimension: 2,
      shape: [2, 2],
      dtype: 'float64',
      value: [[1, 2], [3, 4]],
    }

    expect(() => normalizeExperimentTensorParameter({ ...descriptor, axes: {} })).toThrow(
      '.axes must be an array',
    )
    expect(() => normalizeExperimentTensorParameter({ ...descriptor, axes: [{}] })).toThrow(
      '.axes has length 1; expected 2',
    )
    expect(() => normalizeExperimentTensorParameter({ ...descriptor, axes: [null, {}] })).toThrow(
      '.axes[0] must be a plain object',
    )
    expect(() => normalizeExperimentTensorParameter({ ...descriptor, axes: [{ unit: 'm' }, {}] })).toThrow(
      '.axes[0] must contain exactly',
    )
    expect(() => normalizeExperimentTensorParameter({ ...descriptor, axes: [{ name: ' ' }, {}] })).toThrow(
      '.axes[0].name must be a non-empty string',
    )
    expect(() => normalizeExperimentTensorParameter({ ...descriptor, axes: [{ ticks: null }, {}] })).toThrow(
      '.axes[0].ticks must be an array',
    )
    expect(() => normalizeExperimentTensorParameter({ ...descriptor, axes: [{ ticks: [0] }, {}] })).toThrow(
      '.axes[0].ticks has length 1; expected 2 for shape[0]',
    )
    ;[true, null, Number.POSITIVE_INFINITY].forEach((tick) => {
      expect(() => normalizeExperimentTensorParameter({
        ...descriptor,
        axes: [{ ticks: [0, tick] }, {}],
      })).toThrow('.axes[0].ticks[1] must be a string or finite number')
    })
  })

  it('reports actual and expected tensor shapes and enforces schema dimensions', () => {
    expect(() => normalizeExperimentTensorParameter({
      type: 'tensor',
      dimension: 2,
      shape: [2, 2],
      dtype: 'float64',
      value: [[1, 2], [3]],
    }, 'Experiment initialConditions[0].parameters.profile')).toThrow(
      'Experiment initialConditions[0].parameters.profile.value has actual shape [2, ragged [2] | [1]]; expected shape [2,2]',
    )
    expect(() => normalizeExperimentTensorParameter({
      type: 'tensor', dimension: 2, shape: [2], dtype: 'float64', value: [1, 2],
    })).toThrow('shape [2] has dimension 1')
    expect(() => normalizeExperimentTensorParameter({
      type: 'tensor', dimension: 0, shape: [], dtype: 'float64', value: 1,
    })).toThrow('dimension must be a safe integer greater than or equal to 1')
    expect(() => normalizeExperimentTensorParameter({
      type: 'tensor', dimension: 1, shape: [0], dtype: 'float64', value: [],
    })).toThrow('must be a positive safe integer')
    expect(() => normalizeExperimentTensorParameter({
      type: 'tensor', dimension: 1, shape: [-1], dtype: 'float64', value: [],
    })).toThrow('must be a positive safe integer')
  })

  it('rejects invalid common row fields and duplicate labels within a category', () => {
    const createExperiment = (row: unknown) => new Experiment({
      solver: createSolver(),
      geometry: () => null,
      varsSchema: {},
      initialConditions: () => [row] as never,
    })
    const validRow = {
      target: ['structure.geometry.sample'] as const,
      label: 'Sample field',
      methodId: 'field.apply',
      parameters: {},
    }

    expect(() => evaluateExperimentRules(createExperiment({ target: [] }))).toThrow(
      'must contain target, label, methodId, and parameters',
    )
    expect(() => evaluateExperimentRules(createExperiment({ ...validRow, label: ' ' }))).toThrow(
      'label must be a non-empty string',
    )
    expect(() => evaluateExperimentRules(createExperiment({ ...validRow, methodId: '' }))).toThrow(
      'methodId must be a non-empty string',
    )
    ;[null, []].forEach((parameters) => {
      expect(() => evaluateExperimentRules(createExperiment({ ...validRow, parameters }))).toThrow(
        'parameters must be an object',
      )
    })

    const duplicated = new Experiment({
      solver: createSolver(),
      geometry: () => null,
      varsSchema: {},
      recordedData: () => [
        {
          ...validRow,
          label: 'Recorded field',
          result: { type: 'tensor' as const, dimension: 0, shape: [], dtype: 'float64' as const },
        },
        {
          ...validRow,
          label: ' Recorded field ',
          result: { type: 'tensor' as const, dimension: 0, shape: [], dtype: 'float64' as const },
        },
      ],
    })
    expect(() => evaluateExperimentRules(duplicated)).toThrow('recordedData label "Recorded field" is duplicated')
    expect(() => new Experiment({
      solver: createSolver(),
      geometry: () => null,
      varsSchema: {},
      recordedData: [] as never,
    })).toThrow('recordedData must be a function')
  })

  it('requires a tensor result schema and permits 0D and dynamic recorded result shapes', () => {
    const createRecordedExperiment = (result: unknown, includeResult = true) => new Experiment({
      solver: createSolver(),
      geometry: () => null,
      varsSchema: {},
      recordedData: () => [{
        target: ['structure.geometry.sample'],
        label: 'Recorded value',
        methodId: 'field.record',
        parameters: {},
        ...(includeResult ? { result } : {}),
      }] as never,
    })

    const rules = evaluateExperimentRules(createRecordedExperiment({
      type: 'tensor', dimension: 0, shape: [], dtype: 'float64',
    }))
    expect(rules.recordedData[0].result).toEqual({
      type: 'tensor', dimension: 0, shape: [], dtype: 'float64', axes: [],
    })
    expect(evaluateExperimentRules(createRecordedExperiment({
      type: 'tensor', dimension: 0, shape: [], dtype: 'float64', axes: [],
    })).recordedData[0].result.axes).toEqual([])
    const dynamicResult = evaluateExperimentRules(createRecordedExperiment({
      type: 'tensor',
      dimension: 2,
      shape: [-1, -1],
      dtype: 'float32',
      axes: [{ name: 'row' }, {}],
    })).recordedData[0].result
    expect(dynamicResult).toEqual({
      type: 'tensor',
      dimension: 2,
      shape: [-1, -1],
      dtype: 'float32',
      axes: [{ name: 'row' }, { name: 'axis 1' }],
    })
    expect(Object.isFrozen(dynamicResult.shape)).toBe(true)
    expect(Object.isFrozen(dynamicResult.axes)).toBe(true)
    expect(Object.isFrozen(dynamicResult.axes?.[0])).toBe(true)
    expect(() => evaluateExperimentRules(createRecordedExperiment({
      type: 'tensor',
      dimension: 1,
      shape: [-1],
      dtype: 'float64',
      axes: [{ name: 'time', ticks: [0] }],
    }))).toThrow('ticks must be omitted when shape[0] is -1')
    ;[0, -2].forEach((size) => {
      expect(() => evaluateExperimentRules(createRecordedExperiment({
        type: 'tensor', dimension: 1, shape: [size], dtype: 'float64',
      }))).toThrow('must be -1 or a positive safe integer')
    })
    expect(() => evaluateExperimentRules(createRecordedExperiment(undefined, false))).toThrow(
      'must contain a result tensor descriptor',
    )
    expect(() => evaluateExperimentRules(createRecordedExperiment({
      type: 'tensor', dimension: 0, shape: [1], dtype: 'float64',
    }))).toThrow('shape [1] has dimension 1')
    expect(() => evaluateExperimentRules(createRecordedExperiment({
      type: 'tensor', dimension: 1, shape: [1], dtype: 'unknown',
    }))).toThrow('dtype must be a supported tensor dtype')
    expect(() => evaluateExperimentRules(createRecordedExperiment({
      type: 'tensor', dimension: 1, shape: [1], dtype: 'float64', value: [1],
    }))).toThrow('must contain exactly type, dimension, shape, dtype')
  })

  it('rejects empty, malformed, non-string, or unresolved Experiment rule targets', () => {
    const createExperiment = (target: unknown) => new Experiment({
      solver: createSolver(),
      geometry: () => null,
      varsSchema: {},
      geometryGroup: { domain: [] },
      initialConditions: () => [{
        target,
        label: 'Initial field',
        methodId: 'field.initialize',
        parameters: {},
      }] as never,
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
      solver: createSolver(),
      geometry: () => null,
      varsSchema: {},
      recordedData: (() => null) as never,
    })
    expect(() => evaluateExperimentRules(nonArray)).toThrow('recordedData must return an array')
  })

  it('normalizes required Solver metadata and evaluates deeply frozen parameters before geometry', () => {
    const order: string[] = []
    const source = { nested: { values: [true, null, 2] } }
    const experiment = new Experiment({
      solver: {
        name: ' generic-field-solver ',
        version: ' 1.0.0 ',
        parameters: () => {
          order.push('solver')
          return { timeStep: vars.timeStep as number, source }
        },
      },
      geometry: () => {
        order.push('geometry')
        return null
      },
      varsSchema: { timeStep: { shape: [], default: 0.01 } },
    })
    const setup = new Setup(experiment, { timeStep: 0.02 })
    const solver = evaluateWithVars(setup.vars, () => {
      const normalized = evaluateExperimentSolver(experiment)
      experiment.geometry()
      return normalized
    })

    expect(order).toEqual(['solver', 'geometry'])
    expect(experiment.solver).toMatchObject({ name: 'generic-field-solver', version: '1.0.0' })
    expect(Object.isFrozen(experiment.solver)).toBe(true)
    expect(solver).toEqual({
      name: 'generic-field-solver',
      version: '1.0.0',
      parameters: { timeStep: 0.02, source },
    })
    expect(Object.isFrozen(solver)).toBe(true)
    expect(Object.isFrozen(solver.parameters)).toBe(true)
    expect(Object.isFrozen(solver.parameters.source)).toBe(true)
    source.nested.values[0] = false
    expect(solver.parameters.source).not.toEqual(source)
  })

  it('rejects invalid Solver metadata and non-JSON parameter results', () => {
    const options = { geometry: () => null, varsSchema: {} }

    expect(() => new Experiment(options as never)).toThrow('solver must be a plain object')
    ;[null, []].forEach((solver) => {
      expect(() => new Experiment({ ...options, solver } as never)).toThrow('solver must be a plain object')
    })
    expect(() => new Experiment({
      ...options,
      solver: { name: ' ', version: '1', parameters: () => ({}) },
    })).toThrow('solver name must be a non-empty string')
    expect(() => new Experiment({
      ...options,
      solver: { name: 'solver', version: '', parameters: () => ({}) },
    })).toThrow('solver version must be a non-empty string')
    expect(() => new Experiment({
      ...options,
      solver: { name: 'solver', version: '1', parameters: {} },
    } as never)).toThrow('solver parameters must be a function')

    const rejectsParameters = (parameters: unknown) => {
      const experiment = new Experiment({
        ...options,
        solver: { name: 'solver', version: '1', parameters: () => parameters as never },
      })
      expect(() => evaluateExperimentSolver(experiment)).toThrow(CadModelError)
    }

    rejectsParameters([])
    rejectsParameters({ value: undefined })
    rejectsParameters({ value: () => 1 })
    rejectsParameters({ value: Number.NaN })
    rejectsParameters({ value: Number.POSITIVE_INFINITY })
    rejectsParameters({ value: new Date() })

    const circular: Record<string, unknown> = {}
    circular.self = circular
    rejectsParameters(circular)
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


