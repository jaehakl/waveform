import { describe, expect, it } from 'vitest'
import { Fragment, h } from '../../cad/evaluation/jsx'
import {
  Experiment,
  Material,
  Sample,
  Setup,
  Structure,
} from '../../cad/model/core'
import type { Vec3 } from '../../cad/model/types'
import { SolverController } from '../controller'
import { dcCurrentDensitySolver } from './dcCurrentDensity'

function createDcPair(options: {
  axisUnit?: string | null
  conductivity?: number | null
  conductivityUnit?: string | null
  conductorSize?: Vec3
  cutter?: Readonly<{ position: Vec3; size: Vec3 }>
  densityCrossSectionPosition?: unknown
  densityTarget?: string
  densityUnit?: string | null
  gridDescriptorOverrides?: Readonly<Record<string, unknown>>
  gridMethodId?: string
  gridRuleCount?: number
  gridShape?: readonly number[]
  gridTarget?: string
  legacyDensitySchema?: boolean
  omitDensityCrossSectionPosition?: boolean
  omitTotalCrossSectionPosition?: boolean
  parameterOverrides?: Readonly<Record<string, unknown>>
  referenceSurfaceId?: string
  referenceVoltage?: number
  referenceVoltageUnit?: string | null
  sourceSurfaceId?: string
  sourceVoltage?: number
  sourceVoltageUnit?: string | null
  structureLengthUnit?: string
  totalCrossSectionPosition?: unknown
  totalCurrentUnit?: string | null
  totalTarget?: string
} = {}) {
  const {
    axisUnit = 'm',
    conductivity = 5.96e7,
    conductivityUnit = 'S/m',
    conductorSize = [100, 5, 5],
    cutter,
    densityCrossSectionPosition = { type: 'float', value: 0.5 },
    densityTarget = 'structure.geometry.conductor',
    densityUnit = 'A/m2',
    gridDescriptorOverrides = {},
    gridMethodId = 'dc.voxel-grid',
    gridRuleCount = 1,
    gridShape = [20, 11, 11],
    gridTarget = 'structure.geometry.conductor',
    legacyDensitySchema = false,
    omitDensityCrossSectionPosition = false,
    omitTotalCrossSectionPosition = false,
    parameterOverrides = {},
    referenceSurfaceId = 'conductor/surface-2',
    referenceVoltage = 0,
    referenceVoltageUnit = 'mV',
    sourceSurfaceId = 'conductor/surface-1',
    sourceVoltage = 1,
    sourceVoltageUnit = 'mV',
    structureLengthUnit = 'mm',
    totalCrossSectionPosition = { type: 'float', value: 0.5 },
    totalCurrentUnit = 'A',
    totalTarget = 'structure.geometry.conductor',
  } = options

  function Conductor() {
    const base = h('box', { size: conductorSize })
    return cutter
      ? h('subtract', {}, base, h('box', { pos: cutter.position, size: cutter.size }))
      : base
  }
  function Probe() {
    return h('box', { size: [1, 1, 1] })
  }
  const structure = new Structure({
    lengthUnit: structureLengthUnit,
    geometry: () => h(Conductor, {
      id: 'conductor',
      materials: [new Material('Copper', conductivity === null ? {} : {
        electricalConductivity: {
          type: 'float',
          value: conductivity,
          errorRate: 0,
          ...(conductivityUnit === null ? {} : { unit: conductivityUnit }),
        },
        color: '#d97706',
      })],
    }),
    varsSchema: {},
    geometryGroup: { conductor: ['conductor'] },
    surfaceGroup: {
      sourceTerminal: [sourceSurfaceId],
      referenceTerminal: [referenceSurfaceId],
    },
  })
  const experiment = new Experiment({
    lengthUnit: structureLengthUnit,
    solver: {
      name: 'dc-current-density',
      version: '1.0.0',
      parameters: () => ({
        conductivityVariable: 'electricalConductivity',
        relativeTolerance: { type: 'float', value: 1e-10 },
        maxIterations: 1000,
        ...parameterOverrides,
      }),
    },
    geometry: () => h(Probe, { id: 'probe' }),
    varsSchema: {},
    initializations: () => Array.from({ length: gridRuleCount }, (_value, index) => ({
      target: [gridTarget],
      label: gridRuleCount === 1 ? 'Voxel grid' : `Voxel grid ${index + 1}`,
      methodId: gridMethodId,
      parameters: {
        gridShape: {
          type: 'tensor',
          dimension: 1,
          shape: [3],
          dtype: 'int32',
          axes: [{ name: 'grid axis', ticks: ['s', 'u', 'v'] }],
          value: gridShape,
          ...gridDescriptorOverrides,
        },
      },
    })) as never,
    boundaryConditions: () => [
      {
        target: ['structure.surface.sourceTerminal'],
        label: 'Source',
        methodId: 'dc.source-potential',
        parameters: {
          voltage: {
            type: 'float',
            value: sourceVoltage,
            ...(sourceVoltageUnit === null ? {} : { unit: sourceVoltageUnit }),
          },
        },
      },
      {
        target: ['structure.surface.referenceTerminal'],
        label: 'Reference',
        methodId: 'dc.reference-potential',
        parameters: {
          voltage: {
            type: 'float',
            value: referenceVoltage,
            ...(referenceVoltageUnit === null ? {} : { unit: referenceVoltageUnit }),
          },
        },
      },
    ],
    recordedData: () => [
      {
        target: [densityTarget],
        label: 'Current density',
        methodId: 'dc.current-density',
        parameters: omitDensityCrossSectionPosition ? {} : {
          crossSectionPosition: densityCrossSectionPosition,
        },
        result: legacyDensitySchema
          ? {
              type: 'tensor',
              dimension: 1,
              shape: [3],
              dtype: 'float64',
              ...(densityUnit === null ? {} : { unit: densityUnit }),
              axes: [{ name: 'component', ticks: ['x', 'y', 'z'] }],
            }
          : {
              type: 'tensor',
              dimension: 2,
              shape: [-1, -1],
              dtype: 'float64',
              ...(densityUnit === null ? {} : { unit: densityUnit }),
              axes: [
                { name: 'cross-section v', ...(axisUnit === null ? {} : { unit: axisUnit }) },
                { name: 'cross-section u', ...(axisUnit === null ? {} : { unit: axisUnit }) },
              ],
            },
      },
      {
        target: [totalTarget],
        label: 'Total current',
        methodId: 'dc.total-current',
        parameters: omitTotalCrossSectionPosition ? {} : {
          crossSectionPosition: totalCrossSectionPosition,
        },
        result: {
          type: 'tensor',
          dimension: 0,
          shape: [],
          dtype: 'float64',
          ...(totalCurrentUnit === null ? {} : { unit: totalCurrentUnit }),
        },
      },
    ] as never,
  })
  return { sample: new Sample(structure), setup: new Setup(experiment) }
}

async function runPair(pair: ReturnType<typeof createDcPair>) {
  return new SolverController([dcCurrentDensitySolver]).run(pair.sample, pair.setup)
}

describe('dc-current-density@1.0.0', () => {
  it('converges to the uniform-bar analytic heatmap and total current in SI units', async () => {
    const result = await runPair(createDcPair())
    const heatmap = result['Current density'].value as number[][]

    expect(heatmap).toHaveLength(11)
    expect(heatmap.every((row) => row.length === 11)).toBe(true)
    expect(heatmap.flat().every((value) => Math.abs(value - 596000) < 1e-6)).toBe(true)
    expect(result['Current density'].axes?.[0].ticks).toHaveLength(11)
    expect(result['Current density'].axes?.[1].ticks).toHaveLength(11)
    expect(result['Total current'].value).toBeCloseTo(14.9, 9)
  })

  it('reverses every signed heatmap value while preserving total-current magnitude', async () => {
    const result = await runPair(createDcPair({ sourceVoltage: 0, referenceVoltage: 1 }))
    const heatmap = result['Current density'].value as number[][]

    expect(heatmap.flat().every((value) => Math.abs(value + 596000) < 1e-6)).toBe(true)
    expect(result['Total current'].value).toBeCloseTo(14.9, 9)
  })

  it('uses the Structure lengthUnit for field length and cross-sectional area', async () => {
    const result = await runPair(createDcPair({ structureLengthUnit: 'm' }))
    const heatmap = result['Current density'].value as number[][]

    expect(heatmap.flat().every((value) => Math.abs(value - 596) < 1e-9)).toBe(true)
    expect(result['Total current'].value).toBeCloseTo(14900, 8)
  })

  it('converts compatible input, output, axis, and dimensionless UCUM units', async () => {
    const result = await runPair(createDcPair({
      axisUnit: 'mm',
      conductivityUnit: 'mS/mm',
      densityUnit: 'mA/mm2',
      sourceVoltage: 1000,
      sourceVoltageUnit: 'uV',
      totalCurrentUnit: 'mA',
      densityCrossSectionPosition: { type: 'float', value: 50, unit: '%' },
    }))
    const heatmap = result['Current density'].value as number[][]
    const vTicks = result['Current density'].axes?.[0].ticks as number[]

    expect(heatmap.flat().every((value) => Math.abs(value - 596) < 1e-6)).toBe(true)
    expect(Math.max(...vTicks.map(Math.abs))).toBeLessThan(2.6)
    expect(result['Total current'].value).toBeCloseTo(14900, 7)

    const centimeters = await runPair(createDcPair({
      conductorSize: [10, 0.5, 0.5],
      structureLengthUnit: 'cm',
    }))
    expect(centimeters['Total current'].value).toBeCloseTo(14.9, 9)
  })

  it('returns a 41 by 41 SI heatmap with notch zeros and current crowding', async () => {
    const notched = await runPair(createDcPair({
      conductorSize: [100, 12, 10],
      cutter: { position: [0, 4.5, 2.5], size: [30, 5, 5] },
      densityCrossSectionPosition: { type: 'float', value: 0.35 },
      gridShape: [100, 41, 41],
      parameterOverrides: {
        relativeTolerance: { type: 'float', value: 1e-8 },
        maxIterations: 2000,
      },
      totalCrossSectionPosition: { type: 'float', value: 0.35 },
    }))
    const heatmap = notched['Current density'].value as number[][]
    const values = heatmap.flat()
    const conductingValues = values.filter((value) => value > 0)
    const vTicks = notched['Current density'].axes?.[0].ticks as number[]
    const uTicks = notched['Current density'].axes?.[1].ticks as number[]

    expect(heatmap).toHaveLength(41)
    expect(heatmap.every((row) => row.length === 41)).toBe(true)
    expect(vTicks).toHaveLength(41)
    expect(uTicks).toHaveLength(41)
    expect(vTicks.every((tick) => Math.abs(tick) < 0.006)).toBe(true)
    expect(uTicks.every((tick) => Math.abs(tick) < 0.007)).toBe(true)
    expect(values.filter((value) => value === 0).length).toBeGreaterThan(100)
    expect(conductingValues.length).toBeGreaterThan(0)
    expect(Math.max(...conductingValues) / Math.min(...conductingValues)).toBeGreaterThan(1.05)
    expect(notched['Total current'].value as number).toBeLessThan(71.52)

    const du = Math.abs(uTicks[1] - uTicks[0])
    const dv = Math.abs(vTicks[1] - vTicks[0])
    const integrated = Math.abs(values.reduce((sum, value) => sum + value, 0) * du * dv)
    expect(integrated).toBeCloseTo(notched['Total current'].value as number, 9)
  }, 30_000)

  it('conserves signed flux across axial sections of the notched conductor', async () => {
    const totals = await Promise.all([0.01, 0.5, 0.99].map(async (crossSectionPosition) => {
      const result = await runPair(createDcPair({
        conductorSize: [100, 12, 10],
        cutter: { position: [0, 4.5, 2.5], size: [30, 5, 5] },
        densityCrossSectionPosition: { type: 'float', value: crossSectionPosition },
        gridShape: [30, 17, 17],
        parameterOverrides: {
          relativeTolerance: { type: 'float', value: 1e-9 },
        },
        totalCrossSectionPosition: { type: 'float', value: crossSectionPosition },
      }))
      return result['Total current'].value as number
    }))
    const mean = totals.reduce((sum, value) => sum + value, 0) / totals.length

    expect((Math.max(...totals) - Math.min(...totals)) / mean).toBeLessThan(1e-6)
  }, 30_000)

  it('rejects invalid numerical parameters, scale, and Material conductivity', async () => {
    const invalidSolverParameters = [
      [{ relativeTolerance: { type: 'float', value: 1 } }, 'relativeTolerance must be less than 1'],
      [{ relativeTolerance: { type: 'float', value: 0 } }, 'relativeTolerance must be a finite positive float descriptor'],
      [{ maxIterations: 0 }, 'maxIterations must be a positive safe integer'],
    ] as const

    for (const [parameterOverrides, message] of invalidSolverParameters) {
      await expect(runPair(createDcPair({ parameterOverrides }))).rejects.toThrow(message)
    }
    await expect(runPair(createDcPair({ gridShape: [2, 11, 11] }))).rejects.toThrow('gridShape')
    await expect(runPair(createDcPair({ gridShape: [101, 50, 50] }))).rejects.toThrow(
      'at most 250000 voxels',
    )
    await expect(runPair(createDcPair({
      densityCrossSectionPosition: { type: 'float', value: 0 },
    }))).rejects.toThrow('crossSectionPosition')
    await expect(runPair(createDcPair({ densityCrossSectionPosition: 0.5 }))).rejects.toThrow(
      'raw numbers must be safe integers',
    )
    await expect(runPair(createDcPair({ conductivity: 0 }))).rejects.toThrow(
      'electricalConductivity must be a finite positive float descriptor',
    )
    await expect(runPair(createDcPair({ conductivity: null }))).rejects.toThrow(
      'electricalConductivity must be a finite positive float descriptor',
    )
    await expect(runPair(createDcPair({ conductivityUnit: null }))).rejects.toThrow(
      'compatible with S/m',
    )
    await expect(runPair(createDcPair({ conductivityUnit: 'V' }))).rejects.toThrow(
      'compatible with S/m',
    )
    await expect(runPair(createDcPair({ sourceVoltageUnit: null }))).rejects.toThrow(
      'cannot convert 1 to V',
    )
    await expect(runPair(createDcPair({ densityUnit: null }))).rejects.toThrow(
      'unsupported RecordedData schema',
    )
    await expect(runPair(createDcPair({ axisUnit: null }))).rejects.toThrow(
      'unsupported RecordedData schema',
    )
    await expect(runPair(createDcPair({ axisUnit: 's' }))).rejects.toThrow(
      'unsupported RecordedData schema',
    )
    await expect(runPair(createDcPair({ totalCurrentUnit: 'V' }))).rejects.toThrow(
      'unsupported RecordedData schema',
    )
    await expect(runPair(createDcPair({ totalCurrentUnit: null }))).rejects.toThrow(
      'unsupported RecordedData schema',
    )
  })

  it('validates the voxel-grid initialization contract and rejects legacy solver placement', async () => {
    await expect(runPair(createDcPair({ gridRuleCount: 0 }))).rejects.toThrow(
      'requires one voxel-grid rule',
    )
    await expect(runPair(createDcPair({ gridRuleCount: 2 }))).rejects.toThrow(
      'requires one voxel-grid rule',
    )
    await expect(runPair(createDcPair({ gridMethodId: 'dc.other-grid' }))).rejects.toThrow(
      'requires exactly one dc.voxel-grid rule',
    )
    await expect(runPair(createDcPair({ gridTarget: 'structure.geometry.missing' }))).rejects.toThrow(
      'references a missing structure geometry group',
    )
    await expect(runPair(createDcPair({
      gridDescriptorOverrides: { dtype: 'int16' },
    }))).rejects.toThrow('must be an int32 [3] tensor')
    await expect(runPair(createDcPair({
      gridDescriptorOverrides: { axes: [{ name: 'grid axis', ticks: ['x', 'y', 'z'] }] },
    }))).rejects.toThrow('grid-axis ticks s/u/v')
    await expect(runPair(createDcPair({
      gridDescriptorOverrides: {
        dimension: 2,
        shape: [1, 3],
        axes: [
          { name: 'outer', ticks: ['grid'] },
          { name: 'grid axis', ticks: ['s', 'u', 'v'] },
        ],
        value: [[20, 11, 11]],
      },
    }))).rejects.toThrow('must be an int32 [3] tensor')
    await expect(runPair(createDcPair({
      parameterOverrides: { gridShape: [20, 11, 11] },
    }))).rejects.toThrow('gridShape belongs to dc.voxel-grid')
    await expect(runPair(createDcPair({
      parameterOverrides: { crossSectionPosition: { type: 'float', value: 0.5 } },
    }))).rejects.toThrow('crossSectionPosition belongs to each RecordedData rule')
  })

  it('requires matching dimensionless cross-section positions on both recorded results', async () => {
    await expect(runPair(createDcPair({
      densityCrossSectionPosition: { type: 'float', value: 0.4 },
      totalCrossSectionPosition: { type: 'float', value: 0.6 },
    }))).rejects.toThrow('must use the same crossSectionPosition')
    await expect(runPair(createDcPair({ omitDensityCrossSectionPosition: true }))).rejects.toThrow(
      'dc.current-density parameters.crossSectionPosition must be a finite float descriptor',
    )
    await expect(runPair(createDcPair({ omitTotalCrossSectionPosition: true }))).rejects.toThrow(
      'dc.total-current parameters.crossSectionPosition must be a finite float descriptor',
    )
    await expect(runPair(createDcPair({
      densityCrossSectionPosition: { type: 'float', value: 0.5, unit: 'V' },
    }))).rejects.toThrow('cannot convert V to 1')
  })

  it('rejects multiple parts, invalid terminals, and disconnected voxel domains', async () => {
    const valid = createDcPair()
    function Conductor() {
      return h('box', { size: [100, 5, 5] })
    }
    function Extra() {
      return h('box', { size: [2, 2, 2] })
    }
    const multipleParts = new Structure({
      lengthUnit: 'mm',
      geometry: () => h(Fragment, {},
        h(Conductor, {
          id: 'conductor',
          materials: [new Material('Copper', {
            electricalConductivity: { type: 'float', value: 5.96e7, errorRate: 0, unit: 'S/m' },
          })],
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

    await expect(runPair(createDcPair({
      sourceSurfaceId: 'conductor/surface-3',
    }))).rejects.toThrow('must be parallel, opposite, and normal')

    await expect(runPair(createDcPair({
      cutter: { position: [0, 0, 0], size: [10, 6, 6] },
      gridShape: [30, 9, 9],
    }))).rejects.toThrow('one connected domain')
  })

  it('rejects the former vector schema and forced PCG nonconvergence', async () => {
    await expect(runPair(createDcPair({ legacyDensitySchema: true }))).rejects.toThrow(
      'unsupported RecordedData schema',
    )

    await expect(runPair(createDcPair({
      conductorSize: [100, 12, 10],
      cutter: { position: [0, 4.5, 2.5], size: [30, 5, 5] },
      gridShape: [30, 15, 15],
      parameterOverrides: {
        relativeTolerance: { type: 'float', value: 1e-14 },
        maxIterations: 1,
      },
    }))).rejects.toThrow('did not converge within 1 iterations')
  })

  it('yields during occupancy generation so AbortSignal cancellation is effective', async () => {
    const controller = new SolverController([dcCurrentDensitySolver])
    const pair = createDcPair({ gridShape: [80, 41, 41] })
    setTimeout(() => controller.cancel(), 0)

    await expect(controller.run(pair.sample, pair.setup)).rejects.toMatchObject({ name: 'AbortError' })
    expect(controller.getProcess().status).toBe('cancelled')
  })
})
