export const defaultCode = `import { Material, Sample, Structure } from '@caemble/core'

class Dielectric extends Material {
  toSolverModel() {
    return this.vars
  }

  validateKK() {
    return []
  }
}

function Core({ materials }: { materials?: Material[] }) {
  return (
    <translate offset={vars.offset}>
      <union>
        <box size={[vars.width, 12, 3]} />
        <translate z={3}>
          <cylinder radius={3} height={6} />
        </translate>
      </union>
    </translate>
  )
}

function Cladding({ materials }: { materials?: Material[] }) {
  return <box size={[vars.width + 8, 20, 2]} />
}

function Device({ materials }: { materials: Material[] }) {
  return (
    <>
      <Core materials={[materials[0]]} />
      <translate z={-2.5}>
        <Cladding materials={[materials[1]]} />
      </translate>
    </>
  )
}

const structure = new Structure({
  geometry: () => (
    <Device
      materials={[
        new Dielectric('Core', { epsilon: vars.coreEpsilon }, '#2563eb'),
        new Dielectric('Cladding', { epsilon: 2.1 }, '#f59e0b'),
      ]}
    />
  ),
  varsSchema: {
    width: { shape: [], default: 24, min: 12, max: 36 },
    coreEpsilon: { shape: [], default: 12, min: 10, max: 14 },
    offset: {
      shape: [3],
      default: [0, 0, 0],
      min: -4,
      max: 4,
    },
  },
})

export default new Sample(structure)

// Seeded random vars:
// export default new Sample(structure, structure.randomVars(260713))
`
