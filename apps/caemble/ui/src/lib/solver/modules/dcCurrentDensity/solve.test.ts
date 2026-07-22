import { describe, expect, it } from 'vitest'
import { Fragment, h } from '../../../cad/evaluation/jsx'
import { Material } from '../../../cad/model/core'
import { experiment, structure } from '../../../cad/model/v2'
import { evaluateDocumentEntry } from '../../../cad/execution/userModule'
import { serializeEvaluatedDocumentSnapshotV2 } from '../../../cad/execution/snapshot'
import { buildSourceOnlyRealizationV2, type BuiltSampleV2, type BuiltSetupV2 } from '../../../cad/execution/realization'
import type { EvaluatedDocumentSnapshotV2 } from '../../../cad/execution/snapshot'
import type { Rotation, Vec3 } from '../../../cad/model/types'
import { identityCartesianBasis } from '../../../quantitykind/identityBasis'
import type { CartesianBasis } from '../../../quantitykind/runtime'
import { SolverController } from '../../controller'
import type { SolverModule } from '../../types'
import { dcCurrentDensitySolver } from '.'

function sample(snapshot: EvaluatedDocumentSnapshotV2) {
  return buildSourceOnlyRealizationV2(snapshot) as BuiltSampleV2
}

function setup(snapshot: EvaluatedDocumentSnapshotV2) {
  return buildSourceOnlyRealizationV2(snapshot) as BuiltSetupV2
}

const rotatedCartesianBasis = Object.freeze([
  Object.freeze([0, 1, 0]),
  Object.freeze([-1, 0, 0]),
  Object.freeze([0, 0, 1]),
]) as CartesianBasis

function createDcPair(
  options: {
    axisUnit?: string | null
    conductivity?: number | readonly (readonly number[])[] | null
    conductivityBasis?: CartesianBasis
    conductivityUnit?: string | null
    conductorRotation?: Rotation
    conductorSize?: Vec3
    cutter?: Readonly<{ position: Vec3; size: Vec3 }>
    densityCrossSectionPosition?: unknown
    densityBasis?: CartesianBasis
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
  } = {},
) {
  const {
    axisUnit = 'm',
    conductivity = 5.96e7,
    conductivityBasis = identityCartesianBasis,
    conductivityUnit = 'S.m-1',
    conductorRotation,
    conductorSize = [100, 5, 5],
    cutter,
    densityCrossSectionPosition = {
      dtype: 'float64',
      value: 0.5,
      unit: '{fraction}',
      quantityKind: 'DimensionlessRatio',
    },
    densityBasis = identityCartesianBasis,
    densityTarget = 'structure.geometry.conductor',
    densityUnit = 'A.m-2',
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
    totalCrossSectionPosition = {
      dtype: 'float64',
      value: 0.5,
      unit: '{fraction}',
      quantityKind: 'DimensionlessRatio',
    },
    totalCurrentUnit = 'A',
    totalTarget = 'structure.geometry.conductor',
  } = options

  function Conductor() {
    const base = h('box', { size: conductorSize })
    return cutter ? h('subtract', {}, base, h('box', { pos: cutter.position, size: cutter.size })) : base
  }
  function Probe() {
    return h('box', { size: [1, 1, 1] })
  }
  const structureDefinition = structure({
    lengthUnit: structureLengthUnit,
    geometry: () =>
      h(Conductor, {
        id: 'conductor',
        rotate: conductorRotation,
        materials: [
          new Material(
            'Copper',
            (conductivity === null
              ? {}
              : {
                  'electrical.conductivity': {
                    dtype: 'float64',
                    value:
                      typeof conductivity === 'number'
                        ? [
                            [conductivity, 0, 0],
                            [0, conductivity, 0],
                            [0, 0, conductivity],
                          ]
                        : conductivity,
                    errorRate: 0,
                    ...(conductivityUnit === null
                      ? {}
                      : {
                          unit: conductivityUnit,
                          basis: conductivityBasis,
                        }),
                  },
                  color: '#d97706',
                }) as never,
          ),
        ],
      }),
    varsSchema: {},
    geometryGroup: { conductor: ['conductor'] },
    surfaceGroup: {
      sourceTerminal: [sourceSurfaceId],
      referenceTerminal: [referenceSurfaceId],
    },
  })
  const experimentDefinition = experiment({
    lengthUnit: structureLengthUnit,
    solver: {
      name: 'dc-current-density',
      version: '0.0.0',
      parameters: () => ({
        relativeTolerance: {
          dtype: 'float64',
          value: 1e-10,
          unit: '{fraction}',
          quantityKind: 'DimensionlessRatio',
        },
        maxIterations: 1000,
        ...parameterOverrides,
      }),
    },
    geometry: () => h(Probe, { id: 'probe' }),
    varsSchema: {},
    initializations: () =>
      Array.from({ length: gridRuleCount }, (_value, index) => ({
        target: [gridTarget],
        label: gridRuleCount === 1 ? 'Voxel grid' : `Voxel grid ${index + 1}`,
        methodId: gridMethodId,
        parameters: {
          gridShape: {
            dtype: 'int32',
            axes: [{ length: 3 }],
            value: gridShape,
            ...gridDescriptorOverrides,
          },
        },
      })) as never,
    boundaryConditions: () =>
      [
        {
          target: ['structure.surface.sourceTerminal'],
          label: 'Source',
          methodId: 'dc.source-potential',
          parameters: {
            voltage: {
              dtype: 'float64',
              value: sourceVoltage,
              ...(sourceVoltageUnit === null
                ? {}
                : { unit: sourceVoltageUnit, quantityKind: 'electromagnetism.Voltage' }),
            },
          },
        },
        {
          target: ['structure.surface.referenceTerminal'],
          label: 'Reference',
          methodId: 'dc.reference-potential',
          parameters: {
            voltage: {
              dtype: 'float64',
              value: referenceVoltage,
              ...(referenceVoltageUnit === null
                ? {}
                : { unit: referenceVoltageUnit, quantityKind: 'electromagnetism.Voltage' }),
            },
          },
        },
      ] as never,
    recordedData: () =>
      [
        {
          target: [densityTarget],
          label: 'Current density',
          methodId: 'dc.current-density',
          parameters: omitDensityCrossSectionPosition
            ? {}
            : {
                crossSectionPosition: densityCrossSectionPosition,
              },
          result: legacyDensitySchema
            ? {
                dtype: 'float64',
                ...(densityUnit === null
                  ? {}
                  : {
                      unit: densityUnit,
                      quantityKind: 'electromagnetism.ElectricCurrentDensity',
                      basis: densityBasis,
                    }),
                axes: [{ length: 3, name: 'component', ticks: ['x', 'y', 'z'] }],
              }
            : {
                dtype: 'float64',
                ...(densityUnit === null
                  ? {}
                  : {
                      unit: densityUnit,
                      quantityKind: 'electromagnetism.ElectricCurrentDensity',
                      basis: densityBasis,
                    }),
                axes: [
                  {
                    name: 'cross-section v',
                    ...(axisUnit === null ? {} : { unit: axisUnit, quantityKind: 'Length' }),
                  },
                  {
                    name: 'cross-section u',
                    ...(axisUnit === null ? {} : { unit: axisUnit, quantityKind: 'Length' }),
                  },
                ],
              },
        },
        {
          target: [totalTarget],
          label: 'Total current',
          methodId: 'dc.total-current',
          parameters: omitTotalCrossSectionPosition
            ? {}
            : {
                crossSectionPosition: totalCrossSectionPosition,
              },
          result: {
            dtype: 'float64',
            ...(totalCurrentUnit === null
              ? {}
              : { unit: totalCurrentUnit, quantityKind: 'electromagnetism.ElectricCurrent' }),
          },
        },
      ] as never,
  })
  return { experimentDefinition, structureDefinition }
}

function evaluatePair(pair: ReturnType<typeof createDcPair>) {
  return {
    structureSnapshot: serializeEvaluatedDocumentSnapshotV2(
      evaluateDocumentEntry(pair.structureDefinition, 'structure', '4'.repeat(64), 101),
    ),
    experimentSnapshot: serializeEvaluatedDocumentSnapshotV2(
      evaluateDocumentEntry(pair.experimentDefinition, 'experiment', '5'.repeat(64), 103),
    ),
  }
}

async function runPair(pair: ReturnType<typeof createDcPair>) {
  const snapshots = evaluatePair(pair)
  return new SolverController([dcCurrentDensitySolver]).run(
    sample(snapshots.structureSnapshot),
    setup(snapshots.experimentSnapshot),
  )
}

describe('dc-current-density@0.0.0', () => {
  it('converges to the uniform-bar analytic heatmap and total current in SI units', async () => {
    const result = await runPair(createDcPair())
    const heatmap = result['Current density'].value as Vec3[][]

    expect(heatmap).toHaveLength(11)
    expect(heatmap.every((row) => row.length === 11 && row.every((value) => value.length === 3))).toBe(true)
    expect(heatmap.flat().every((value) => Math.abs(Math.hypot(...value) - 596000) < 1e-6)).toBe(true)
    expect(result['Current density'].axes?.[0].ticks).toHaveLength(11)
    expect(result['Current density'].axes?.[1].ticks).toHaveLength(11)
    expect(result['Total current'].value).toBeCloseTo(14.9, 9)
  })

  it('reverses every signed heatmap value while preserving total-current magnitude', async () => {
    const result = await runPair(createDcPair({ sourceVoltage: 0, referenceVoltage: 1 }))
    const heatmap = result['Current density'].value as Vec3[][]

    expect(heatmap.flat().every((value) => Math.abs(value[0] + 596000) < 1e-6)).toBe(true)
    expect(result['Total current'].value).toBeCloseTo(14.9, 9)
  })

  it('uses the Structure lengthUnit for field length and cross-sectional area', async () => {
    const result = await runPair(createDcPair({ structureLengthUnit: 'm' }))
    const heatmap = result['Current density'].value as Vec3[][]

    expect(heatmap.flat().every((value) => Math.abs(Math.hypot(...value) - 596) < 1e-9)).toBe(true)
    expect(result['Total current'].value).toBeCloseTo(14900, 8)
  })

  it('returns global vector components for a rotated conductor without changing total current', async () => {
    const result = await runPair(
      createDcPair({
        conductorRotation: { axis: [0, 0, 1], angle: Math.PI / 2 },
      }),
    )
    const heatmap = result['Current density'].value as Vec3[][]

    expect(heatmap.flat().every((value) => Math.abs(value[0]) < 1e-6)).toBe(true)
    expect(heatmap.flat().every((value) => Math.abs(value[1] - 596000) < 1e-6)).toBe(true)
    expect(heatmap.flat().every((value) => Math.abs(value[2]) < 1e-6)).toBe(true)
    expect(result['Total current'].value).toBeCloseTo(14.9, 9)
  })

  it('converts compatible input, output, axis, and dimensionless UCUM units', async () => {
    const result = await runPair(
      createDcPair({
        axisUnit: 'mm',
        conductivity: 5.96e5,
        conductivityUnit: 'S.cm-1',
        densityBasis: rotatedCartesianBasis,
        densityUnit: 'A.mm-2',
        sourceVoltage: 1000,
        sourceVoltageUnit: 'uV',
        totalCurrentUnit: 'mA',
        densityCrossSectionPosition: {
          dtype: 'float64',
          value: 50,
          unit: '%',
          quantityKind: 'DimensionlessRatio',
        },
      }),
    )
    const heatmap = result['Current density'].value as Vec3[][]
    const vTicks = result['Current density'].axes?.[0].ticks as number[]

    expect(heatmap.flat().every((value) => Math.abs(Math.hypot(...value) - 0.596) < 1e-9)).toBe(true)
    expect(
      heatmap
        .flat()
        .every(
          (value) => Math.abs(value[0]) < 1e-12 && Math.abs(value[1] + 0.596) < 1e-9 && Math.abs(value[2]) < 1e-12,
        ),
    ).toBe(true)
    expect(Math.max(...vTicks.map(Math.abs))).toBeLessThan(2.6)
    expect(result['Total current'].value).toBeCloseTo(14900, 7)

    const centimeters = await runPair(
      createDcPair({
        conductorSize: [10, 0.5, 0.5],
        structureLengthUnit: 'cm',
      }),
    )
    expect(centimeters['Total current'].value).toBeCloseTo(14.9, 9)
  })

  it('passes frozen conductivity to the solver in its declared unit and identity basis', async () => {
    const snapshots = evaluatePair(
      createDcPair({
        conductivity: [
          [1, 0, 0],
          [0, 2, 0],
          [0, 0, 3],
        ],
        conductivityBasis: rotatedCartesianBasis,
        conductivityUnit: 'S.cm-1',
      }),
    )
    let receivedConductivity: unknown
    const inspectingSolver: SolverModule = {
      spec: dcCurrentDensitySolver.spec,
      solve: async (input) => {
        receivedConductivity = input.structure.scene.parts[0].material?.variables['electrical.conductivity']
        return {
          'Current density': {
            value: [[[0, 0, 0]]],
            axes: [{ ticks: [0] }, { ticks: [0] }],
          },
          'Total current': { value: 0 },
        }
      },
    }

    await new SolverController([inspectingSolver]).run(
      sample(snapshots.structureSnapshot),
      setup(snapshots.experimentSnapshot),
    )

    const transformed = receivedConductivity as {
      unit: string
      basis: CartesianBasis
      value: readonly (readonly number[])[]
    }
    expect(transformed.unit).toBe('S.m-1')
    expect(transformed.basis).toEqual(identityCartesianBasis)
    expect(transformed.value[0]).toEqual([100, 0, 0])
    expect(transformed.value[1]).toEqual([0, 200, 0])
    expect(transformed.value[2][0]).toBe(0)
    expect(transformed.value[2][1]).toBe(0)
    expect(transformed.value[2][2]).toBeCloseTo(300, 12)
  })

  it('returns a 41 by 41 SI heatmap with notch zeros and current crowding', async () => {
    const notched = await runPair(
      createDcPair({
        conductorSize: [100, 12, 10],
        cutter: { position: [0, 4.5, 2.5], size: [30, 5, 5] },
        densityCrossSectionPosition: {
          dtype: 'float64',
          value: 0.35,
          unit: '{fraction}',
          quantityKind: 'DimensionlessRatio',
        },
        gridShape: [100, 41, 41],
        parameterOverrides: {
          relativeTolerance: {
            dtype: 'float64',
            value: 1e-8,
            unit: '{fraction}',
            quantityKind: 'DimensionlessRatio',
          },
          maxIterations: 2000,
        },
        totalCrossSectionPosition: {
          dtype: 'float64',
          value: 0.35,
          unit: '{fraction}',
          quantityKind: 'DimensionlessRatio',
        },
      }),
    )
    const heatmap = notched['Current density'].value as Vec3[][]
    const values = heatmap.flat().map((value) => value[0])
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
    const totals = await Promise.all(
      [0.01, 0.5, 0.99].map(async (crossSectionPosition) => {
        const result = await runPair(
          createDcPair({
            conductorSize: [100, 12, 10],
            cutter: { position: [0, 4.5, 2.5], size: [30, 5, 5] },
            densityCrossSectionPosition: {
              dtype: 'float64',
              value: crossSectionPosition,
              unit: '{fraction}',
              quantityKind: 'DimensionlessRatio',
            },
            gridShape: [30, 17, 17],
            parameterOverrides: {
              relativeTolerance: {
                dtype: 'float64',
                value: 1e-9,
                unit: '{fraction}',
                quantityKind: 'DimensionlessRatio',
              },
            },
            totalCrossSectionPosition: {
              dtype: 'float64',
              value: crossSectionPosition,
              unit: '{fraction}',
              quantityKind: 'DimensionlessRatio',
            },
          }),
        )
        return result['Total current'].value as number
      }),
    )
    const mean = totals.reduce((sum, value) => sum + value, 0) / totals.length

    expect((Math.max(...totals) - Math.min(...totals)) / mean).toBeLessThan(1e-6)
  }, 30_000)

  it('rejects invalid numerical parameters, scale, and Material conductivity', async () => {
    const invalidSolverParameters = [
      [
        {
          relativeTolerance: {
            dtype: 'float64',
            value: 1,
            unit: '{fraction}',
            quantityKind: 'DimensionlessRatio',
          },
        },
        'relativeTolerance.value: must be less than 1',
      ],
      [
        {
          relativeTolerance: {
            dtype: 'float64',
            value: 0,
            unit: '{fraction}',
            quantityKind: 'DimensionlessRatio',
          },
        },
        'relativeTolerance.value: must be greater than 0',
      ],
      [{ maxIterations: 0 }, 'maxIterations: must be greater than or equal to 1'],
    ] as const

    for (const [parameterOverrides, message] of invalidSolverParameters) {
      await expect(runPair(createDcPair({ parameterOverrides }))).rejects.toThrow(message)
    }
    await expect(runPair(createDcPair({ gridShape: [2, 11, 11] }))).rejects.toThrow('gridShape')
    await expect(runPair(createDcPair({ gridShape: [101, 50, 50] }))).rejects.toThrow('at most 250000 voxels')
    await expect(
      runPair(
        createDcPair({
          densityCrossSectionPosition: {
            dtype: 'float64',
            value: 0,
            unit: '{fraction}',
            quantityKind: 'DimensionlessRatio',
          },
        }),
      ),
    ).rejects.toThrow('crossSectionPosition')
    await expect(runPair(createDcPair({ densityCrossSectionPosition: 0.5 }))).rejects.toThrow(
      'raw numbers must be safe integers',
    )
    await expect(runPair(createDcPair({ conductivity: 0 }))).rejects.toThrow('electrical.conductivity')
    await expect(runPair(createDcPair({ conductivity: -1 }))).rejects.toThrow('must have positive diagonal components')
    await expect(
      runPair(
        createDcPair({
          conductivity: [
            [5.96e7, 0, 0],
            [0, 5.95e7, 0],
            [0, 0, 5.96e7],
          ],
        }),
      ),
    ).rejects.toThrow('must be isotropic σI; diagonal components differ')
    await expect(
      runPair(
        createDcPair({
          conductivity: [
            [5.96e7, 1e-4, 0],
            [0, 5.96e7, 0],
            [0, 0, 5.96e7],
          ],
        }),
      ),
    ).rejects.toThrow('must be isotropic σI; off-diagonal components exceed')
    await expect(runPair(createDcPair({ conductivity: null }))).rejects.toThrow('electrical.conductivity')
    await expect(runPair(createDcPair({ conductivityUnit: null }))).rejects.toThrow(
      'must contain exactly dtype, value, unit, errorRate',
    )
    await expect(runPair(createDcPair({ conductivityUnit: 'V' }))).rejects.toThrow('not applicable')
    await expect(runPair(createDcPair({ sourceVoltageUnit: null }))).rejects.toThrow(
      'must specify both unit and quantityKind for a float dtype',
    )
    await expect(runPair(createDcPair({ densityUnit: null }))).rejects.toThrow(
      'must specify both unit and quantityKind for a float dtype',
    )
    await expect(runPair(createDcPair({ axisUnit: null }))).rejects.toThrow('result.axes[0]')
    await expect(runPair(createDcPair({ axisUnit: 's' }))).rejects.toThrow('is not applicable to Quantity Kind Length')
    await expect(runPair(createDcPair({ totalCurrentUnit: 'V' }))).rejects.toThrow(
      'is not applicable to Quantity Kind electromagnetism.ElectricCurrent',
    )
    await expect(runPair(createDcPair({ totalCurrentUnit: null }))).rejects.toThrow(
      'must specify both unit and quantityKind for a float dtype',
    )
  })

  it('accepts σI perturbations at the relative 1e-12 boundary', async () => {
    const sigma = 5.96e7
    const result = await runPair(
      createDcPair({
        conductivity: [
          [sigma, sigma * 1e-12, 0],
          [0, sigma * (1 + 1e-12), 0],
          [0, 0, sigma],
        ],
      }),
    )

    expect(result['Total current'].value).toBeCloseTo(14.9, 8)
  })

  it('validates the voxel-grid initialization contract and preserves undeclared parameters', async () => {
    await expect(runPair(createDcPair({ gridRuleCount: 0 }))).rejects.toThrow('rules.initializations.dc.voxel-grid')
    await expect(runPair(createDcPair({ gridRuleCount: 2 }))).rejects.toThrow('rules.initializations.dc.voxel-grid')
    await expect(runPair(createDcPair({ gridMethodId: 'dc.other-grid' }))).rejects.toThrow(
      'dc.other-grid is not registered',
    )
    await expect(runPair(createDcPair({ gridTarget: 'structure.geometry.missing' }))).rejects.toThrow(
      'references missing structure.geometry.missing',
    )
    await expect(
      runPair(
        createDcPair({
          gridDescriptorOverrides: { dtype: 'int16' },
        }),
      ),
    ).rejects.toThrow('dtype: must be int32')
    await expect(
      runPair(
        createDcPair({
          gridDescriptorOverrides: {
            axes: [
              { length: 1, name: 'outer', ticks: ['grid'] },
              { length: 3, name: 'grid axis', ticks: ['s', 'u', 'v'] },
            ],
            value: [[20, 11, 11]],
          },
        }),
      ),
    ).rejects.toThrow('axes: must contain 1 axes')
    await expect(
      runPair(
        createDcPair({
          parameterOverrides: {
            gridShape: { dtype: 'int32', axes: [{ length: 3 }], value: [20, 11, 11] },
            crossSectionPosition: {
              dtype: 'float64',
              value: 0.5,
              unit: '{fraction}',
              quantityKind: 'DimensionlessRatio',
            },
          },
        }),
      ),
    ).resolves.toHaveProperty('Total current')
  })

  it('requires matching dimensionless cross-section positions on both recorded results', async () => {
    await expect(
      runPair(
        createDcPair({
          densityCrossSectionPosition: {
            dtype: 'float64',
            value: 0.4,
            unit: '{fraction}',
            quantityKind: 'DimensionlessRatio',
          },
          totalCrossSectionPosition: {
            dtype: 'float64',
            value: 0.6,
            unit: '{fraction}',
            quantityKind: 'DimensionlessRatio',
          },
        }),
      ),
    ).rejects.toThrow('must use the same crossSectionPosition')
    await expect(runPair(createDcPair({ omitDensityCrossSectionPosition: true }))).rejects.toThrow(
      'rules.recordedData[0].parameters.crossSectionPosition: is required',
    )
    await expect(runPair(createDcPair({ omitTotalCrossSectionPosition: true }))).rejects.toThrow(
      'rules.recordedData[1].parameters.crossSectionPosition: is required',
    )
    await expect(
      runPair(
        createDcPair({
          densityCrossSectionPosition: {
            dtype: 'float64',
            value: 0.5,
            unit: 'V',
            quantityKind: 'electromagnetism.Voltage',
          },
        }),
      ),
    ).rejects.toThrow('must be DimensionlessRatio')
  })

  it('rejects multiple parts, invalid terminals, and disconnected voxel domains', async () => {
    const valid = evaluatePair(createDcPair())
    function Conductor() {
      return h('box', { size: [100, 5, 5] })
    }
    function Extra() {
      return h('box', { size: [2, 2, 2] })
    }
    const multipleParts = structure({
      lengthUnit: 'mm',
      geometry: () =>
        h(
          Fragment,
          {},
          h(Conductor, {
            id: 'conductor',
            materials: [
              new Material('Copper', {
                'electrical.conductivity': {
                  dtype: 'float64',
                  value: [
                    [5.96e7, 0, 0],
                    [0, 5.96e7, 0],
                    [0, 0, 5.96e7],
                  ],
                  errorRate: 0,
                  unit: 'S.m-1',
                  basis: identityCartesianBasis,
                },
              }),
            ],
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
    await expect(
      new SolverController([dcCurrentDensitySolver]).run(
        sample(
          serializeEvaluatedDocumentSnapshotV2(evaluateDocumentEntry(multipleParts, 'structure', '6'.repeat(64), 107)),
        ),
        setup(valid.experimentSnapshot),
      ),
    ).rejects.toThrow('supports exactly one Structure Geometry part')

    await expect(
      runPair(
        createDcPair({
          sourceSurfaceId: 'conductor/surface-3',
        }),
      ),
    ).rejects.toThrow('must be parallel, opposite, and normal')

    await expect(
      runPair(
        createDcPair({
          cutter: { position: [0, 0, 0], size: [10, 6, 6] },
          gridShape: [30, 9, 9],
        }),
      ),
    ).rejects.toThrow('one connected domain')
  })

  it('rejects the former vector schema and forced PCG nonconvergence', async () => {
    await expect(runPair(createDcPair({ legacyDensitySchema: true }))).rejects.toThrow(
      'result.axes: must contain 2 axes',
    )

    await expect(
      runPair(
        createDcPair({
          conductorSize: [100, 12, 10],
          cutter: { position: [0, 4.5, 2.5], size: [30, 5, 5] },
          gridShape: [30, 15, 15],
          parameterOverrides: {
            relativeTolerance: {
              dtype: 'float64',
              value: 1e-14,
              unit: '{fraction}',
              quantityKind: 'DimensionlessRatio',
            },
            maxIterations: 1,
          },
        }),
      ),
    ).rejects.toThrow('did not converge within 1 iterations')
  })

  it('yields during occupancy generation so AbortSignal cancellation is effective', async () => {
    const controller = new SolverController([dcCurrentDensitySolver])
    const pair = evaluatePair(createDcPair({ gridShape: [80, 41, 41] }))
    setTimeout(() => controller.cancel(), 0)

    await expect(controller.run(sample(pair.structureSnapshot), setup(pair.experimentSnapshot))).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(controller.getProcess().status).toBe('cancelled')
  })
})
