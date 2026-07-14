export const defaultCode = `import {
  Material,
  Sample,
  Structure,
  type FiberFourierMode,
  type Geometry,
  type Vec3,
} from '@caemble/core'

class Polymer extends Material {
  toSolverModel() {
    return this.vars
  }
}

const strandFrom = [0, 0, -45] as const
const strandTo = [0, 0, 45] as const

const Strand: Geometry<{
  bend: Vec3
  bundleRadius: number
  fiberRadius: number
  fourier: readonly FiberFourierMode[]
  phase: number
  turns: number
}> = ({ bend, bundleRadius, fiberRadius, fourier, phase, turns }) => {
  const basePath = (t: number) => {
    const arc = Math.sin(Math.PI * t)
    return [
      strandFrom[0] + (strandTo[0] - strandFrom[0]) * t + bend[0] * arc,
      strandFrom[1] + (strandTo[1] - strandFrom[1]) * t + bend[1] * Math.sin(Math.PI * 2 * t),
      strandFrom[2] + (strandTo[2] - strandFrom[2]) * t + bend[2] * arc,
    ] as const
  }

  return (
    <fiber
      from={strandFrom}
      to={strandTo}
      basePath={basePath}
      radius={(s) => fiberRadius * (1 - 0.6 * s)}
      helix={{
        turns,
        phase,
        radius: (_u, theta) => bundleRadius * Math.exp(0.08 * Math.cos(2 * theta)),
      }}
      fourier={fourier}
      envelopePower={2}
      up={[1, 0, 0]}
      pathSegments={128}
      radialSegments={12}
    />
  )
}

const Bundle: Geometry<{
  materials: Material[]
  bend: Vec3
  bundleRadius: number
  fiberRadius: number
  fourier: readonly FiberFourierMode[]
  turns: number
}> = ({ bend, bundleRadius, fiberRadius, fourier, turns }) => (
  <>
    <Strand
      id="1"
      bend={bend}
      bundleRadius={bundleRadius}
      fiberRadius={fiberRadius}
      fourier={fourier}
      phase={0}
      turns={turns}
    />
    <Strand
      id="2"
      bend={bend}
      bundleRadius={bundleRadius}
      fiberRadius={fiberRadius}
      fourier={fourier}
      phase={(Math.PI * 2) / 3}
      turns={turns}
    />
    <Strand
      id="3"
      bend={bend}
      bundleRadius={bundleRadius}
      fiberRadius={fiberRadius}
      fourier={fourier}
      phase={(Math.PI * 4) / 3}
      turns={turns}
    />
  </>
)

const structure = new Structure({
  geometry: () => {
    const fourier = (vars.fourierModes as number[][]).map(([amplitude, phase]) => ({
      amplitude,
      phase,
    }))

    return (
      <Bundle
        id="bundle"
        bend={vars.bend as Vec3}
        bundleRadius={vars.bundleRadius as number}
        fiberRadius={vars.fiberRadius as number}
        fourier={fourier}
        turns={vars.turns as number}
        materials={[
          new Polymer('Tapered Fiber', { density: vars.density }, '#7c3aed'),
        ]}
      />
    )
  },
  varsSchema: {
    bend: {
      shape: [3],
      default: [8, 4, 0],
      min: [-12, -8, -4],
      max: [12, 8, 4],
    },
    bundleRadius: { shape: [], default: 5, min: 3, max: 7 },
    fiberRadius: { shape: [], default: 1.2, min: 0.8, max: 1.6 },
    turns: { shape: [], default: 8, min: 5, max: 11 },
    density: { shape: [], default: 1.18 },
    fourierModes: {
      shape: [3, 2],
      default: [[0.8, 0.3], [0.35, 1.7], [0.16, 3.1]],
      min: [[0, 0], [0, 0], [0, 0]],
      max: [[1.2, Math.PI * 2], [0.6, Math.PI * 2], [0.3, Math.PI * 2]],
    },
  },
  geometryGroup: {
    bundle: ['bundle'],
  },
  surfaceGroup: {
    starts: ['bundle.1/surface-1', 'bundle.2/surface-1', 'bundle.3/surface-1'],
  },
})

// The Fourier amplitudes and phases are ordinary Sample vars. Reroll resamples only those coefficients.
const randomVars = structure.randomVars()

export default new Sample(structure, {
  fourierModes: randomVars.fourierModes,
})
`
