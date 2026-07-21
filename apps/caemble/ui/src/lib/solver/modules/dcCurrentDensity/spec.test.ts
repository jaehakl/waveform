import { describe, expect, it } from 'vitest'
import type { MaterialVariables } from '../../../cad/model/core'
import { identityCartesianBasis } from '../../../quantitykind/identityBasis'
import type { SolverMaterialParameterMap } from '../../spec'
import { dcCurrentDensitySpec } from './spec'

function assertCompileTimeMaterialContracts() {
  const localSolverKey: SolverMaterialParameterMap = {
    // @ts-expect-error Solver Material parameters must use a canonical catalog key.
    electricalConductivity: {},
  }
  const duplicateQuantityKind: SolverMaterialParameterMap = {
    'electrical.conductivity': {
      description: 'Invalid duplicate metadata.',
      value: {
        dtype: 'float64',
        referenceUnit: 'S.m-1',
        referenceBasis: identityCartesianBasis,
        // @ts-expect-error The canonical QuantityKind is derived from the property key.
        quantityKind: 'electromagnetism.ElectricConductivity',
      },
    },
  }
  const unknownMaterialKey: MaterialVariables = {
    // @ts-expect-error Material authoring accepts catalog keys and color only.
    density: {},
  }
  const modelRelation: SolverMaterialParameterMap = {
    'model.magnetic_hysteresis.b_h_curve': {
      description: 'Canonical B-H relation.',
      value: {
        kind: 'sampled_relation',
        input: { referenceUnit: 'A.m-1', referenceBasis: identityCartesianBasis },
        output: { referenceUnit: 'T', referenceBasis: identityCartesianBasis },
      },
    },
  }
  void [localSolverKey, duplicateQuantityKind, unknownMaterialKey, modelRelation]
}
void assertCompileTimeMaterialContracts

describe('dc-current-density spec', () => {
  it('declares the complete versioned external contract', () => {
    expect(dcCurrentDensitySpec).toMatchObject({
      name: 'dc-current-density',
      version: '0.0.0',
      parameters: {
        relativeTolerance: { value: { quantityKind: 'DimensionlessRatio', referenceUnit: '{fraction}' } },
        maxIterations: { value: { dtype: 'int32' } },
      },
    })
    expect(dcCurrentDensitySpec.parameters).not.toHaveProperty('conductivityVariable')
    expect(dcCurrentDensitySpec.materials[0].parameters['electrical.conductivity']?.value).toMatchObject({
      referenceUnit: 'S.m-1',
      dtype: 'float64',
      referenceBasis: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    })
    expect(dcCurrentDensitySpec.materials[0].parameters['electrical.conductivity']?.value)
      .not.toHaveProperty('quantityKind')
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
      quantityKind: 'electromagnetism.ElectricCurrentDensity',
      referenceUnit: 'A.m-2',
      referenceBasis: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
      axes: [
        { quantityKind: 'Length', referenceUnit: 'm' },
        { quantityKind: 'Length', referenceUnit: 'm' },
      ],
    })
    expect(dcCurrentDensitySpec.methods.recordedData[1].result).toMatchObject({
      quantityKind: 'electromagnetism.ElectricCurrent',
      referenceUnit: 'A',
    })
  })
})
