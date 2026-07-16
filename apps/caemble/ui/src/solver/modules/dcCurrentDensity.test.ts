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
  conductivity?: number | null
  conductorSize?: Vec3
  cutter?: Readonly<{ position: Vec3; size: Vec3 }>
  legacyDensitySchema?: boolean
  parameterOverrides?: Readonly<Record<string, unknown>>
  referenceSurfaceId?: string
  referenceVoltage?: number
  sourceSurfaceId?: string
  sourceVoltage?: number
} = {}) {
  const {
    conductivity = 5.96e7,
    conductorSize = [100, 5, 5],
    cutter,
    legacyDensitySchema = false,
    parameterOverrides = {},
    referenceSurfaceId = 'conductor/surface-2',
    referenceVoltage = 0,
    sourceSurfaceId = 'conductor/surface-1',
    sourceVoltage = 0.001,
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
    geometry: () => h(Conductor, {
      id: 'conductor',
      materials: [new Material('Copper', conductivity === null ? {} : {
        electricalConductivity: conductivity,
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
    solver: {
      name: 'dc-current-density',
      version: '1.0.0',
      parameters: () => ({
        lengthScaleToMeters: 0.001,
        conductivityVariable: 'electricalConductivity',
        gridShape: [20, 11, 11],
        crossSectionPosition: 0.5,
        relativeTolerance: 1e-10,
        maxIterations: 1000,
        ...parameterOverrides,
      }),
    },
    geometry: () => h(Probe, { id: 'probe' }),
    varsSchema: {},
    boundaryConditions: () => [
      {
        target: ['structure.surface.sourceTerminal'],
        label: 'Source',
        methodId: 'dc.source-potential',
        parameters: { voltage: sourceVoltage },
      },
      {
        target: ['structure.surface.referenceTerminal'],
        label: 'Reference',
        methodId: 'dc.reference-potential',
        parameters: { voltage: referenceVoltage },
      },
    ],
    recordedData: () => [
      {
        target: ['structure.geometry.conductor'],
        label: 'Current density',
        methodId: 'dc.current-density',
        parameters: {},
        result: legacyDensitySchema
          ? {
              type: 'tensor',
              dimension: 1,
              shape: [3],
              dtype: 'float64',
              axes: [{ name: 'component', ticks: ['x', 'y', 'z'] }],
            }
          : {
              type: 'tensor',
              dimension: 2,
              shape: [-1, -1],
              dtype: 'float64',
              axes: [
                { name: 'cross-section v (m)' },
                { name: 'cross-section u (m)' },
              ],
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
    const result = await runPair(createDcPair({ sourceVoltage: 0, referenceVoltage: 0.001 }))
    const heatmap = result['Current density'].value as number[][]

    expect(heatmap.flat().every((value) => Math.abs(value + 596000) < 1e-6)).toBe(true)
    expect(result['Total current'].value).toBeCloseTo(14.9, 9)
  })

  it('applies lengthScaleToMeters to field length and cross-sectional area', async () => {
    const result = await runPair(createDcPair({ parameterOverrides: { lengthScaleToMeters: 1 } }))
    const heatmap = result['Current density'].value as number[][]

    expect(heatmap.flat().every((value) => Math.abs(value - 596) < 1e-9)).toBe(true)
    expect(result['Total current'].value).toBeCloseTo(14900, 8)
  })

  it('returns a 41 by 41 SI heatmap with notch zeros and current crowding', async () => {
    const notched = await runPair(createDcPair({
      conductorSize: [100, 12, 10],
      cutter: { position: [0, 4.5, 2.5], size: [30, 5, 5] },
      parameterOverrides: {
        gridShape: [100, 41, 41],
        crossSectionPosition: 0.35,
        relativeTolerance: 1e-8,
        maxIterations: 2000,
      },
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
        parameterOverrides: {
          gridShape: [30, 17, 17],
          crossSectionPosition,
          relativeTolerance: 1e-9,
        },
      }))
      return result['Total current'].value as number
    }))
    const mean = totals.reduce((sum, value) => sum + value, 0) / totals.length

    expect((Math.max(...totals) - Math.min(...totals)) / mean).toBeLessThan(1e-6)
  }, 30_000)

  it('rejects invalid numerical parameters, scale, and Material conductivity', async () => {
    const invalidCases = [
      [{ gridShape: [2, 11, 11] }, 'gridShape'],
      [{ gridShape: [101, 50, 50] }, 'at most 250000 voxels'],
      [{ relativeTolerance: 1 }, 'relativeTolerance must be less than 1'],
      [{ relativeTolerance: 0 }, 'relativeTolerance must be a finite positive number'],
      [{ maxIterations: 0 }, 'maxIterations must be a positive safe integer'],
      [{ crossSectionPosition: 0 }, 'crossSectionPosition'],
      [{ lengthScaleToMeters: 0 }, 'lengthScaleToMeters must be a finite positive number'],
    ] as const

    for (const [parameterOverrides, message] of invalidCases) {
      await expect(runPair(createDcPair({ parameterOverrides }))).rejects.toThrow(message)
    }
    await expect(runPair(createDcPair({ conductivity: 0 }))).rejects.toThrow(
      'electricalConductivity must be a finite positive number',
    )
    await expect(runPair(createDcPair({ conductivity: null }))).rejects.toThrow(
      'electricalConductivity must be a finite positive number',
    )
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

    await expect(runPair(createDcPair({
      sourceSurfaceId: 'conductor/surface-3',
    }))).rejects.toThrow('must be parallel, opposite, and normal')

    await expect(runPair(createDcPair({
      cutter: { position: [0, 0, 0], size: [10, 6, 6] },
      parameterOverrides: { gridShape: [30, 9, 9] },
    }))).rejects.toThrow('one connected domain')
  })

  it('rejects the former vector schema and forced PCG nonconvergence', async () => {
    await expect(runPair(createDcPair({ legacyDensitySchema: true }))).rejects.toThrow(
      'unsupported RecordedData schema',
    )

    await expect(runPair(createDcPair({
      conductorSize: [100, 12, 10],
      cutter: { position: [0, 4.5, 2.5], size: [30, 5, 5] },
      parameterOverrides: {
        gridShape: [30, 15, 15],
        relativeTolerance: 1e-14,
        maxIterations: 1,
      },
    }))).rejects.toThrow('did not converge within 1 iterations')
  })

  it('yields during occupancy generation so AbortSignal cancellation is effective', async () => {
    const controller = new SolverController([dcCurrentDensitySolver])
    const pair = createDcPair({ parameterOverrides: { gridShape: [80, 41, 41] } })
    setTimeout(() => controller.cancel(), 0)

    await expect(controller.run(pair.sample, pair.setup)).rejects.toMatchObject({ name: 'AbortError' })
    expect(controller.getProcess().status).toBe('cancelled')
  })
})
