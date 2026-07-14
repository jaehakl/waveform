export const defaultExperimentCode = `import {
  Experiment,
  Material,
  Setup,
  type Geometry,
  type Vec3,
} from '@caemble/core'

type InitialCondition = Readonly<{
  initialValue: number
}>

type BoundaryCondition = Readonly<{
  value: number | ((time: number) => number)
}>

const Domain: Geometry<{ size: Vec3 }> = ({ size }) => (
  <box size={size} />
)

const experiment = new Experiment<InitialCondition, BoundaryCondition>({
  geometry: () => (
    <Domain
      id="domain"
      size={vars.domainSize as Vec3}
      materials={[
        new Material('Experiment Domain', { weight: vars.displayWeight }, '#0ea5e9'),
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
    initialValue: { shape: [], default: 0.25, min: 0, max: 1 },
    outerBoundaryValue: { shape: [], default: 1, min: 0.5, max: 1.5 },
    amplitude: { shape: [], default: 0.2, min: 0.1, max: 0.4 },
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
      value: { initialValue: vars.initialValue as number },
    },
  ],
  boundaryConditions: () => [
    {
      target: ['experiment.surface.outerBoundary'],
      value: { value: vars.outerBoundaryValue as number },
    },
    {
      target: ['structure.surface.sampleBoundary'],
      value: {
        value: (time: number) => (vars.amplitude as number) * Math.sin(time),
      },
    },
  ],
})

export default new Setup(experiment, experiment.randomVars())
`
