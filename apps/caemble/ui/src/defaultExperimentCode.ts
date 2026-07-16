export const defaultExperimentCode = `import {
  Experiment,
  Material,
  Setup,
  type ExperimentTensorParameter,
  type Geometry,
  type Vec3,
} from '@caemble/core'

type InitialConditionParameters = Readonly<{
  initialValue: number
  initialProfile: ExperimentTensorParameter
}>

type BoundaryConditionParameters = Readonly<{
  value: number
}>

type RecordedDataParameters = Readonly<{
  interval: number
}>

const Domain: Geometry<{ size: Vec3 }> = ({ size }) => (
  <box size={size} />
)

// Keep tensor raw data in a top-level variable so Experimental Parameters can update it.
const initialProfileData = [
  [0.1, 0.2, 0.3],
  [0.4, 0.5, 0.6],
] as const

const experiment = new Experiment<
  InitialConditionParameters,
  BoundaryConditionParameters,
  RecordedDataParameters
>({
  solver: {
    name: 'generic-field-solver',
    version: '1.0.0',
    parameters: () => ({
      timeStep: vars.timeStep as number,
      iterations: 100,
    }),
  },
  geometry: () => (
    <Domain
      id="domain"
      size={vars.domainSize as Vec3}
      materials={[
        new Material('Experiment Domain', { weight: vars.displayWeight, color: '#0ea5e9' }),
      ]}
    />
  ),
  varsSchema: {
    domainSize: {
      shape: [3],
      default: [36, 24, 18],
      min: [28, 18, 14],
      max: [44, 30, 22],
    },
    displayWeight: { shape: [], default: 1 },
    timeStep: { shape: [], default: 0.01, min: 0.001, max: 0.1 },
    initialValue: { shape: [], default: 0.25, min: 0, max: 1 },
    outerBoundaryValue: { shape: [], default: 1, min: 0.5, max: 1.5 },
    amplitude: { shape: [], default: 0.2, min: 0.1, max: 0.4 },
    recordInterval: { shape: [], default: 10, min: 1, max: 20 },
  },
  geometryGroup: {
    domain: ['domain'],
  },
  surfaceGroup: {
    outerBoundary: ['domain/surface-1'],
  },
  initialConditions: () => [
    {
      target: [
        'experiment.geometry.domain',
        'structure.geometry.sample',
      ],
      label: 'Initial field',
      methodId: 'field.initialize',
      parameters: {
        initialValue: vars.initialValue as number,
        initialProfile: {
          type: 'tensor',
          dimension: 2,
          shape: [2, 3],
          dtype: 'float32',
          value: initialProfileData,
        },
      },
    },
  ],
  boundaryConditions: () => [
    {
      target: ['experiment.surface.outerBoundary'],
      label: 'Outer boundary',
      methodId: 'field.fixed-boundary',
      parameters: { value: vars.outerBoundaryValue as number },
    },
    {
      target: ['structure.surface.sampleBoundary'],
      label: 'Sample boundary',
      methodId: 'field.sample-boundary',
      parameters: { value: vars.amplitude as number },
    },
  ],
  recordedData: () => [
    {
      target: ['experiment.geometry.domain'],
      label: 'Domain average',
      methodId: 'field.average',
      parameters: { interval: vars.recordInterval as number },
      result: { type: 'tensor', dimension: 0, shape: [], dtype: 'float64' },
    },
  ],
})

export default new Setup(experiment, experiment.randomVars())
`
