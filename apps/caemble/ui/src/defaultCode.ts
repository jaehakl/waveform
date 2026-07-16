export const defaultCode = `import {
  Material,
  Sample,
  Structure,
  type Geometry,
  type Vec3,
} from '@caemble/core'

const Conductor: Geometry<{ size: Vec3 }> = ({ size }) => (
  <box size={size} />
)

const structure = new Structure({
  geometry: () => (
    <Conductor
      id="conductor"
      size={vars.conductorSize as Vec3}
      materials={[
        new Material('Copper', 'reference', {
          electricalConductivity: vars.electricalConductivity,
          color: '#d97706',
        }),
      ]}
    />
  ),
  varsSchema: {
    conductorSize: { shape: [3], default: [100, 5, 5] },
    electricalConductivity: { shape: [], default: 5.96e7 },
  },
  geometryGroup: {
    conductor: ['conductor'],
  },
  surfaceGroup: {
    sourceTerminal: ['conductor/surface-1'],
    referenceTerminal: ['conductor/surface-2'],
  },
})

export default new Sample(structure)
`
