import { describe, expect, it } from 'vitest'
import { dcCurrentDensitySpec } from './spec'

describe('dc-current-density spec', () => {
  it('declares the complete versioned external contract', () => {
    expect(dcCurrentDensitySpec).toMatchObject({
      name: 'dc-current-density',
      version: '2.0.0',
      parameters: {
        relativeTolerance: { value: { quantityKind: 'DimensionlessRatio', referenceUnit: '{fraction}' } },
        maxIterations: { value: { dtype: 'int32' } },
      },
    })
    expect(dcCurrentDensitySpec.parameters).not.toHaveProperty('conductivityVariable')
    expect(dcCurrentDensitySpec.materials[0].parameters.electricalConductivity.value).toMatchObject({
      quantityKind: 'ElectricConductivity',
      referenceUnit: 'S.m-1',
      dtype: 'float64',
      referenceBasis: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    })
  })

  it('declares exact method IDs, quantities, results, and axes', () => {
    expect(dcCurrentDensitySpec.methods.initializations.map(({ methodId }) => methodId)).toEqual([
      'dc.voxel-grid',
    ])
    expect(dcCurrentDensitySpec.methods.boundaryConditions.map(({ methodId }) => methodId)).toEqual([
      'dc.source-potential',
      'dc.reference-potential',
    ])
    expect(dcCurrentDensitySpec.methods.recordedData.map(({ methodId }) => methodId)).toEqual([
      'dc.current-density',
      'dc.total-current',
    ])
    expect(dcCurrentDensitySpec.methods.initializations[0].parameters.gridShape.value).toMatchObject({
      axes: [{ length: 3 }],
    })
    expect(dcCurrentDensitySpec.methods.initializations[0].parameters.gridShape.value).not.toHaveProperty('shape')
    expect(dcCurrentDensitySpec.methods.recordedData[0].result).toMatchObject({
      quantityKind: 'ElectricCurrentDensity',
      referenceUnit: 'A.m-2',
      referenceBasis: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
      axes: [
        { quantityKind: 'Length', referenceUnit: 'm' },
        { quantityKind: 'Length', referenceUnit: 'm' },
      ],
    })
    expect(dcCurrentDensitySpec.methods.recordedData[1].result).toMatchObject({
      quantityKind: 'ElectricCurrent',
      referenceUnit: 'A',
    })
  })
})
