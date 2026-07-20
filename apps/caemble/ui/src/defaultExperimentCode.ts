export const defaultExperimentCode = `import {
  experiment,
  Material,
  type Geometry,
  type Vec3,
} from '@caemble/core/v2'

const Terminal: Geometry<{ size: Vec3 }> = ({ size }) => (
  <box size={size} />
)

export default experiment({
  lengthUnit: 'mm',
  solver: {
    name: 'dc-current-density',
    version: '2.0.0',
    parameters: () => ({
      relativeTolerance: {
        dtype: 'float64',
        value: 1e-8,
        unit: '{fraction}',
        quantityKind: 'DimensionlessRatio',
      },
      maxIterations: 2000,
    }),
  },
  geometry: ({ vars }) => (
    <>
      <Terminal
        id="source-electrode"
        pos={[-vars.electrodeOffset, 0, 0]}
        size={vars.electrodeSize}
        materials={[new Material('Source Electrode', { color: '#ef4444' })]}
      />
      <Terminal
        id="reference-electrode"
        pos={[vars.electrodeOffset, 0, 0]}
        size={vars.electrodeSize}
        materials={[new Material('Reference Electrode', { color: '#2563eb' })]}
      />
    </>
  ),
  varsSchema: {
    electrodeOffset: { min: 50.5, max: 50.5 },
    electrodeSize: { min: [1, 14, 12], max: [1, 14, 12] },
    sourceVoltage: { min: 1, max: 1 },
    referenceVoltage: { min: 0, max: 0 },
  },
  geometryGroup: {
    terminals: ['source-electrode', 'reference-electrode'],
  },
  initializations: () => [
    {
      target: ['structure.geometry.conductor'],
      label: 'Voxel grid',
      methodId: 'dc.voxel-grid',
      parameters: {
        gridShape: {
          dtype: 'int32',
          axes: [{ length: 3 }],
          value: [100, 41, 41],
        },
      },
    },
  ],
  boundaryConditions: ({ vars }) => [
    {
      target: ['structure.surface.sourceTerminal'],
      label: 'Applied potential',
      methodId: 'dc.source-potential',
      parameters: {
        voltage: {
          dtype: 'float64',
          value: vars.sourceVoltage,
          unit: 'mV',
          quantityKind: 'electromagnetism.Voltage',
        },
      },
    },
    {
      target: ['structure.surface.referenceTerminal'],
      label: 'Reference potential',
      methodId: 'dc.reference-potential',
      parameters: {
        voltage: {
          dtype: 'float64',
          value: vars.referenceVoltage,
          unit: 'mV',
          quantityKind: 'electromagnetism.Voltage',
        },
      },
    },
  ],
  recordedData: () => [
    {
      target: ['structure.geometry.conductor'],
      label: 'Current density',
      methodId: 'dc.current-density',
      parameters: {
        crossSectionPosition: {
          dtype: 'float64',
          value: 0.35,
          unit: '{fraction}',
          quantityKind: 'DimensionlessRatio',
        },
      },
      result: {
        dtype: 'float64',
        unit: 'A.m-2',
        quantityKind: 'electromagnetism.ElectricCurrentDensity',
        axes: [
          { name: 'cross-section v', unit: 'm', quantityKind: 'Length' },
          { name: 'cross-section u', unit: 'm', quantityKind: 'Length' },
        ],
      },
    },
    {
      target: ['structure.geometry.conductor'],
      label: 'Total current',
      methodId: 'dc.total-current',
      parameters: {
        crossSectionPosition: {
          dtype: 'float64',
          value: 0.35,
          unit: '{fraction}',
          quantityKind: 'DimensionlessRatio',
        },
      },
      result: {
        dtype: 'float64',
        unit: 'A',
        quantityKind: 'electromagnetism.ElectricCurrent',
      },
    },
  ],
})
`
