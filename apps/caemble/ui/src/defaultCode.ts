export const defaultCode = `import {
  Material,
  Sample,
  Structure,
  type Geometry,
  type Vec3,
} from '@caemble/core'

const Conductor: Geometry<{
  notchPosition: Vec3
  notchSize: Vec3
  size: Vec3
}> = ({ notchPosition, notchSize, size }) => (
  <subtract>
    <box size={size} />
    <box pos={notchPosition} size={notchSize} />
  </subtract>
)

const structure = new Structure({
  lengthUnit: 'mm',
  geometry: () => (
    <Conductor
      id="conductor"
      size={vars.conductorSize as Vec3}
      notchPosition={vars.notchPosition as Vec3}
      notchSize={vars.notchSize as Vec3}
      materials={[
        new Material('Copper', 'reference', {
          electricalConductivity: {
            type: 'float',
            value: vars.electricalConductivity as number,
            unit: 'S/m',
          },
          color: '#d97706',
        }),
      ]}
    />
  ),
  varsSchema: {
    conductorSize: { shape: [3], default: [100, 12, 10] },
    notchSize: { shape: [3], default: [30, 5, 5] },
    notchPosition: { shape: [3], default: [0, 4.5, 2.5] },
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
