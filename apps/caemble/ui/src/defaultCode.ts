export const defaultCode = `import {
  Material,
  Sample,
  Structure,
  type Geometry,
  type Vec3,
} from '@caemble/core'

class Dielectric extends Material {
  toSolverModel() {
    return this.vars
  }

  validateKK() {
    return []
  }
}

const Core: Geometry<{ size: Vec3; holeRadius: number }> = ({ size, holeRadius }) => (
  <union>
    <subtract>
      <box size={size} />
      <cylinder pos={[-size[0] / 4, 0, 0]} radius={holeRadius} height={size[2] * 2} />
    </subtract>

    <intersect pos={[size[0] / 4, 0, size[2] / 2 + 1]}>
      <sphere radius={Math.max(size[1] / 3, holeRadius * 2)} />
      <box size={[size[1] / 2, size[1] / 2, size[2] + 2]} />
    </intersect>
  </union>
)

const Cladding: Geometry<{ size: Vec3 }> = ({ size }) => <box size={size} />

const zeroRotationTensor = [
  [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
  [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
  [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
] as const

const Device: Geometry<{
  materials: Material[]
  gap: number
  profileScale: number
  twistRatio: number
}> = ({
  materials,
  pos = [0, 0, 0],
  rotate,
  scale = [1, 1, 1],
  gap,
  profileScale,
  twistRatio,
}) => {
  const localGap = gap + Math.hypot(...pos) * 0.05
  const baseSize = [vars.width, 12 * scale[1], 3 * scale[2]] as const
  const baseHoleRadius = 2 * profileScale
  const latticePeriod = Math.hypot(...baseSize) + localGap
  const layerPeriod = Math.sqrt(2 / 3) * latticePeriod
  const hcpOffset = [latticePeriod / 2, (Math.sqrt(3) * latticePeriod) / 6, 0] as const
  const layerOffsets = [
    [-hcpOffset[0] / 3, -hcpOffset[1] / 3, 0],
    [(hcpOffset[0] * 2) / 3, (hcpOffset[1] * 2) / 3, 0],
    [-hcpOffset[0] / 3, -hcpOffset[1] / 3, 0],
  ] as const
  const azimuthTensor = vars.rotationAzimuth as number[][][]
  const cosPolarTensor = vars.rotationCosPolar as number[][][]
  const angleTensor = vars.rotationAngle as number[][][]
  const baseTwist = (rotate?.angle ?? 0) * twistRatio
  const rotateAxisTensor = azimuthTensor.map((plane, x) =>
    plane.map((row, y) =>
      row.map((azimuth, z) => {
        const cosPolar = cosPolarTensor[x][y][z]
        const radial = Math.sqrt(Math.max(0, 1 - cosPolar * cosPolar))
        return [radial * Math.cos(azimuth), radial * Math.sin(azimuth), cosPolar]
      }),
    ),
  )
  const rotateAngleTensor = angleTensor.map((plane) =>
    plane.map((row) => row.map((angle) => (angle + baseTwist) % (Math.PI * 2))),
  )
  const layerPosTensor = angleTensor.map((plane) =>
    plane.map((row) => row.map((_angle, z) => layerOffsets[z])),
  )
  const claddingSize = [
    latticePeriod * 5,
    latticePeriod * 4,
    2 * scale[2],
  ] as const
  const claddingPos = [0, 0, -layerPeriod - latticePeriod / 2 - baseSize[2]] as const

  return (
    <>
      <array
        shape={[3, 3, 3]}
        period={[latticePeriod, latticePeriod, layerPeriod]}
        axes={{
          x: [1, 0, 0],
          y: [0.5, Math.sqrt(3) / 2, 0],
          z: [0, 0, 1],
        }}
        inject={{
          pos: layerPosTensor,
          rotate: {
            axis: rotateAxisTensor,
            angle: rotateAngleTensor,
          },
        }}
      >
        <Core
          size={baseSize}
          holeRadius={baseHoleRadius}
          scale={[profileScale, 1, 1]}
          materials={[materials[0]]}
        />
      </array>
      <Cladding size={claddingSize} pos={claddingPos} materials={[materials[1]]} />
    </>
  )
}

const structure = new Structure({
  geometry: () => (
    <Device
      pos={vars.devicePos}
      rotate={{ axis: [0, 0, 1], angle: Math.PI / 18 }}
      scale={[1, 0.9, 1]}
      gap={4}
      profileScale={0.95}
      twistRatio={0.5}
      materials={[
        new Dielectric('Core', { epsilon: vars.coreEpsilon }, '#2563eb'),
        new Dielectric('Cladding', { epsilon: 2.1 }, '#f59e0b'),
      ]}
    />
  ),
  varsSchema: {
    width: { shape: [], default: 24, min: 12, max: 36 },
    coreEpsilon: { shape: [], default: 12, min: 10, max: 14 },
    devicePos: {
      shape: [3],
      default: [0, 0, 0],
      min: -4,
      max: 4,
    },
    rotationAzimuth: {
      shape: [3, 3, 3],
      default: zeroRotationTensor,
      min: 0,
      max: Math.PI * 2,
    },
    rotationCosPolar: {
      shape: [3, 3, 3],
      default: zeroRotationTensor,
      min: -1,
      max: 1,
    },
    rotationAngle: {
      shape: [3, 3, 3],
      default: zeroRotationTensor,
      min: 0,
      max: Math.PI * 2,
    },
  },
})

// Pass a seed to randomVars(...) when reproducible rotations are needed.
const randomRotationVars = structure.randomVars()

export default new Sample(structure, {
  rotationAzimuth: randomRotationVars.rotationAzimuth,
  rotationCosPolar: randomRotationVars.rotationCosPolar,
  rotationAngle: randomRotationVars.rotationAngle,
})
`
