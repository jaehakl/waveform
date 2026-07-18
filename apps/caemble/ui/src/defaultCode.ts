export const defaultCode = `import {
  Mat,
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
            dtype: 'float64',
            value: Mat(vars.electricalConductivity as number),
            errorRate: 0.001,
            unit: 'S.m-1',
            quantityKind: 'ElectricConductivity',
          },
          color: '#d97706',
        }),
      ]}
    />
  ),
  varsSchema: {
    conductorSize: { min: [100, 12, 10], max: [100, 12, 10] },
    notchSize: { min: [20, 4, 5], max: [40, 6, 7] },
    notchPosition: { min: [-10, 4, 2.5], max: [10, 5, 3.5] },
    electricalConductivity: { min: 5.96e7, max: 5.96e7 },
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
