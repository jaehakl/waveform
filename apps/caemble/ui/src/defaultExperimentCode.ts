export const defaultExperimentCode = `import {
  Experiment,
  Material,
  Setup,
  type Geometry,
  type Vec3,
} from '@caemble/core'

const Terminal: Geometry<{ size: Vec3 }> = ({ size }) => (
  <box size={size} />
)

const experiment = new Experiment({
  solver: {
    name: 'dc-current-density',
    version: '1.0.0',
    parameters: () => ({
      lengthScaleToMeters: 0.001,
      conductivityVariable: 'electricalConductivity',
    }),
  },
  geometry: () => (
    <>
      <Terminal
        id="source-electrode"
        pos={[-(vars.electrodeOffset as number), 0, 0]}
        size={vars.electrodeSize as Vec3}
        materials={[new Material('Source Electrode', { color: '#ef4444' })]}
      />
      <Terminal
        id="reference-electrode"
        pos={[vars.electrodeOffset as number, 0, 0]}
        size={vars.electrodeSize as Vec3}
        materials={[new Material('Reference Electrode', { color: '#2563eb' })]}
      />
    </>
  ),
  varsSchema: {
    electrodeOffset: { shape: [], default: 50.5 },
    electrodeSize: { shape: [3], default: [1, 7, 7] },
    sourceVoltage: { shape: [], default: 0.001 },
    referenceVoltage: { shape: [], default: 0 },
  },
  geometryGroup: {
    terminals: ['source-electrode', 'reference-electrode'],
  },
  boundaryConditions: () => [
    {
      target: ['structure.surface.sourceTerminal'],
      label: 'Applied potential',
      methodId: 'dc.source-potential',
      parameters: { voltage: vars.sourceVoltage as number },
    },
    {
      target: ['structure.surface.referenceTerminal'],
      label: 'Reference potential',
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

export default new Setup(experiment)
`
