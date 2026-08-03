export const defaultExperimentProgramCode = `import { defineTask, experiment } from '@caemble/core/v3'
import { dcCurrentDensity } from '@caemble/kernels/v1'

const solveCurrent = defineTask(dcCurrentDensity, ({ vars }) => ({
  parameters: {
    relativeTolerance: {
      dtype: 'float64',
      value: 1e-8,
      unit: '{fraction}',
      quantityKind: 'DimensionlessRatio',
    },
    maxIterations: 2000,
  },
  initializations: [
    {
      target: ['structure.geometry.conductor'],
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
  boundaryConditions: [
    {
      target: ['structure.surface.sourceTerminal'],
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
  recordedData: [
    {
      key: 'totalCurrent',
      target: ['structure.geometry.conductor'],
      methodId: 'dc.total-current',
      parameters: {
        crossSectionPosition: {
          dtype: 'float64',
          value: 0.35,
          unit: '{fraction}',
          quantityKind: 'DimensionlessRatio',
        },
      },
    },
  ],
}))

function ExperimentDevice() {
  return <box size={[1, 1, 1]} />
}

export default experiment({
  lengthUnit: 'mm',
  varsSchema: {
    sourceVoltage: { min: 1, max: 1 },
    referenceVoltage: { min: 0, max: 0 },
  },
  geometry: () => <ExperimentDevice id="experiment-device" />,
  initialState: ({ world }) => ({
    bodies: world.bodies.map((body) => ({
      body,
      pose: body.referencePose,
      velocity: [0, 0, 0],
    })),
  }),
  tasks: { solveCurrent },
  outputs: {
    totalCurrent: {
      dtype: 'float64',
      unit: 'A',
      quantityKind: 'electromagnetism.ElectricCurrent',
    },
  },
  simulate: async ({ sim, tasks, initialState }) => {
    const result = await sim.run(tasks.solveCurrent, { state: initialState })
    sim.record('totalCurrent', result.artifacts.totalCurrent)
    return result.state
  },
})
`
