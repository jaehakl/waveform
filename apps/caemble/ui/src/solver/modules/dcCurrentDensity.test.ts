import { describe, expect, it } from 'vitest'
import { Fragment, h } from '../../cad/evaluation/jsx'
import {
  Experiment,
  Material,
  Sample,
  Setup,
  Structure,
  vars,
} from '../../cad/model/core'
import { SolverController } from '../controller'
import { dcCurrentDensitySolver } from './dcCurrentDensity'

function createDcPair({
  conductivity = 5.96e7,
  lengthScaleToMeters = 0.001,
  referenceVoltage = 0,
  sourceVoltage = 0.001,
} = {}) {
  function Conductor() {
    return h('box', { size: [100, 5, 5] })
  }
  function Probe() {
    return h('box', { size: [1, 1, 1] })
  }
  const structure = new Structure({
    geometry: () => h(Conductor, {
      id: 'conductor',
      materials: [new Material('Copper', { electricalConductivity: conductivity, color: '#d97706' })],
    }),
    varsSchema: {},
    geometryGroup: { conductor: ['conductor'] },
    surfaceGroup: {
      sourceTerminal: ['conductor/surface-1'],
      referenceTerminal: ['conductor/surface-2'],
    },
  })
  const experiment = new Experiment({
    solver: {
      name: 'dc-current-density',
      version: '1.0.0',
      parameters: () => ({ lengthScaleToMeters, conductivityVariable: 'electricalConductivity' }),
    },
    geometry: () => h(Probe, { id: 'probe' }),
    varsSchema: {
      sourceVoltage: { shape: [], default: sourceVoltage },
      referenceVoltage: { shape: [], default: referenceVoltage },
    },
    boundaryConditions: () => [
      {
        target: ['structure.surface.sourceTerminal'],
        label: 'Source',
        methodId: 'dc.source-potential',
        parameters: { voltage: vars.sourceVoltage as number },
      },
      {
        target: ['structure.surface.referenceTerminal'],
        label: 'Reference',
        methodId: 'dc.reference-potential',
        parameters: { voltage: vars.referenceVoltage as number },
      },
    ],
    recordedData: () => [
      {
        target: ['structure.geometry.conductor'],
        label: 'Current density',
        methodId: 'dc.current-density',
        parameters: {},
        result: {
          type: 'tensor',
          dimension: 1,
          shape: [3],
          dtype: 'float64',
          axes: [{ name: 'component', ticks: ['x', 'y', 'z'] }],
        },
      },
      {
        target: ['structure.geometry.conductor'],
        label: 'Total current',
        methodId: 'dc.total-current',
        parameters: {},
        result: { type: 'tensor', dimension: 0, shape: [], dtype: 'float64' },
      },
    ],
  })
  return { sample: new Sample(structure), setup: new Setup(experiment) }
}

describe('dc-current-density@1.0.0', () => {
  it('computes the default current density vector and total current in SI units', async () => {
    const { sample, setup } = createDcPair()
    const result = await new SolverController([dcCurrentDensitySolver]).run(sample, setup)

    expect(result['Current density'].value).toEqual([596000, 0, 0])
    expect(result['Current density'].axes).toEqual([{ ticks: ['x', 'y', 'z'] }])
    expect(result['Total current'].value).toBeCloseTo(14.9, 10)
  })

  it('reverses vector direction with voltage while preserving total-current magnitude', async () => {
    const { sample, setup } = createDcPair({ sourceVoltage: 0, referenceVoltage: 0.001 })
    const result = await new SolverController([dcCurrentDensitySolver]).run(sample, setup)

    expect(result['Current density'].value).toEqual([-596000, 0, 0])
    expect(result['Total current'].value).toBeCloseTo(14.9, 10)
  })

  it('applies lengthScaleToMeters to both field length and cross-sectional area', async () => {
    const { sample, setup } = createDcPair({ lengthScaleToMeters: 1 })
    const result = await new SolverController([dcCurrentDensitySolver]).run(sample, setup)

    expect(result['Current density'].value).toEqual([596, 0, 0])
    expect(result['Total current'].value).toBeCloseTo(14900, 10)
  })

  it('rejects invalid scale and conductor Material data', async () => {
    const invalidScale = createDcPair({ lengthScaleToMeters: 0 })
    await expect(new SolverController([dcCurrentDensitySolver]).run(
      invalidScale.sample,
      invalidScale.setup,
    )).rejects.toThrow('lengthScaleToMeters must be a finite positive number')

    const invalidMaterial = createDcPair({ conductivity: 0 })
    await expect(new SolverController([dcCurrentDensitySolver]).run(
      invalidMaterial.sample,
      invalidMaterial.setup,
    )).rejects.toThrow('electricalConductivity must be a finite positive number')
  })

  it('rejects multiple Structure parts and non-planar terminal surfaces', async () => {
    const valid = createDcPair()
    function Conductor() {
      return h('box', { size: [100, 5, 5] })
    }
    function Extra() {
      return h('box', { size: [2, 2, 2] })
    }
    const multipleParts = new Structure({
      geometry: () => h(Fragment, {},
        h(Conductor, {
          id: 'conductor',
          materials: [new Material('Copper', { electricalConductivity: 5.96e7 })],
        }),
        h(Extra, { id: 'extra', pos: [0, 10, 0] }),
      ),
      varsSchema: {},
      geometryGroup: { conductor: ['conductor'] },
      surfaceGroup: {
        sourceTerminal: ['conductor/surface-1'],
        referenceTerminal: ['conductor/surface-2'],
      },
    })
    await expect(new SolverController([dcCurrentDensitySolver]).run(
      new Sample(multipleParts),
      valid.setup,
    )).rejects.toThrow('supports exactly one Structure Geometry part')

    function CurvedConductor() {
      return h('cylinder', {
        radius: 2.5,
        height: 100,
        rotate: { axis: [0, 1, 0], angle: Math.PI / 2 },
      })
    }
    const curvedTerminal = new Structure({
      geometry: () => h(CurvedConductor, {
        id: 'conductor',
        materials: [new Material('Copper', { electricalConductivity: 5.96e7 })],
      }),
      varsSchema: {},
      geometryGroup: { conductor: ['conductor'] },
      surfaceGroup: {
        sourceTerminal: ['conductor/surface-2'],
        referenceTerminal: ['conductor/surface-3'],
      },
    })
    await expect(new SolverController([dcCurrentDensitySolver]).run(
      new Sample(curvedTerminal),
      valid.setup,
    )).rejects.toThrow('must be planar')
  })

  it('rejects missing potential rules and unsupported RecordedData schemas', async () => {
    const valid = createDcPair()

    function Probe() {
      return h('box', { size: [1, 1, 1] })
    }
    const invalidExperiment = new Experiment({
      solver: valid.setup.experiment.solver,
      geometry: () => h(Probe, { id: 'probe' }),
      varsSchema: {},
      recordedData: valid.setup.experiment.recordedData,
    })
    await expect(new SolverController([dcCurrentDensitySolver]).run(
      valid.sample,
      new Setup(invalidExperiment),
    )).rejects.toThrow('supports no initial conditions, two potential rules, and two recorded-data rules')

    const [densityRule, totalCurrentRule] = valid.setup.experiment.recordedData()
    const invalidSchema = new Experiment({
      solver: valid.setup.experiment.solver,
      geometry: () => h(Probe, { id: 'probe' }),
      varsSchema: valid.setup.experiment.varsSchema,
      boundaryConditions: valid.setup.experiment.boundaryConditions,
      recordedData: () => [
        {
          ...densityRule,
          result: { ...densityRule.result, dtype: 'float32' },
        },
        totalCurrentRule,
      ],
    })
    await expect(new SolverController([dcCurrentDensitySolver]).run(
      valid.sample,
      new Setup(invalidSchema),
    )).rejects.toThrow('unsupported RecordedData schema')
  })
})
