import type { CaembleProgramExample } from './types'

export const dcUniformBarStructureCode = `import {
  Mat,
  Material,
  structure,
  type Geometry,
  type Vec3,
} from '@caemble/core/v2'

const Conductor: Geometry<{ size: Vec3 }> = ({ size }) => <box size={size} />

export default structure({
  lengthUnit: 'mm',

  varsSchema: {
    conductorSize: { min: [100, 5, 5], max: [100, 5, 5] },
    electricalConductivity: { min: 5.96e7, max: 5.96e7 },
  },

  geometry: ({ vars }) => (
    <Conductor
      id="conductor"
      size={vars.conductorSize}
      materials={[
        new Material('Copper', 'reference', {
          errorRate: 0,
          'electrical.conductivity': {
            dtype: 'float64',
            value: Mat(vars.electricalConductivity),
            unit: 'S.m-1',
          },
          color: '#d97706',
        }),
      ]}
    />
  ),

  geometryGroup: {
    conductor: ['conductor'],
  },

  surfaceGroup: {
    sourceTerminal: ['conductor/surface-1'],
    referenceTerminal: ['conductor/surface-2'],
  },
})
`

export const dcUniformBarExperimentCode = `import { defineTask, experiment } from '@caemble/core/v3'
import { dcCurrentDensity } from '@caemble/kernels/v1'

const solveCurrent = defineTask(dcCurrentDensity, ({ vars }) => ({
  parameters: {
    relativeTolerance: {
      dtype: 'float64',
      value: 1e-10,
      unit: '{fraction}',
      quantityKind: 'DimensionlessRatio',
    },
    maxIterations: 1000,
  },

  initializations: [
    {
      target: ['structure.geometry.conductor'],
      methodId: 'dc.voxel-grid',
      parameters: {
        gridShape: {
          dtype: 'int32',
          axes: [{ length: 3 }],
          value: [20, 11, 11],
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
          value: 0.5,
          unit: '{fraction}',
          quantityKind: 'DimensionlessRatio',
        },
      },
    },
  ],
}))

function Probe() {
  return <box size={[2, 2, 2]} />
}

export default experiment({
  lengthUnit: 'mm',

  varsSchema: {
    sourceVoltage: { min: 1, max: 1 },
    referenceVoltage: { min: 0, max: 0 },
  },

  geometry: () => <Probe id="probe" pos={[0, -10, 0]} />,

  tasks: {
    solveCurrent,
  },

  outputs: {
    totalCurrent: {
      dtype: 'float64',
      unit: 'A',
      quantityKind: 'electromagnetism.ElectricCurrent',
    },
  },

  simulate: async ({ sim, tasks, initialState }) => {
    const result = await sim.run(tasks.solveCurrent, {
      state: initialState,
    })

    sim.record('totalCurrent', result.artifacts.totalCurrent)
    return result.state
  },
})
`

export const dcUniformBarExample = Object.freeze({
  id: 'dc-uniform-bar',
  title: 'DC Uniform Bar',
  description: '가장 작은 v3 Experiment Program으로 균일 구리 막대의 전체 전류를 계산합니다.',
  concepts: Object.freeze([
    'Structure group과 surface target',
    'defineTask()와 단일 sim.run()',
    'ArtifactRef를 output으로 기록',
  ]),
  structureCode: dcUniformBarStructureCode,
  experimentCode: dcUniformBarExperimentCode,
  verification: Object.freeze({
    kernelTasks: Object.freeze(['solveCurrent']),
    outputs: Object.freeze(['totalCurrent']),
    expectations: Object.freeze([
      'totalCurrent = 14.9 A ± 1e-6',
      'dc-current-density@0.0.0 호출 1회',
      '최종 state revision = 1, body 수 = 2',
    ]),
  }),
}) satisfies CaembleProgramExample
