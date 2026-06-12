export const defaultCode = `type Vec3 = [number, number, number]

type RaisedBossProps = {
  at: Vec3
  radius?: number
  height?: number
  children?: unknown
}

// A custom component receives JSX props as the first function argument.
// Nested JSX is injected as props.children.
function RaisedBoss({ at, radius = 7, height = 10, children }: RaisedBossProps) {
  return (
    <translate offset={at}>
      <union>
        <cylinder radius={radius} height={height} />
        {children}
      </union>
    </translate>
  )
}

type DrillHoleProps = {
  at: Vec3
  radius?: number
  height?: number
}

function DrillHole({ at, radius = 2, height = 18 }: DrillHoleProps) {
  return (
    <translate offset={at}>
      <cylinder radius={radius} height={height} />
    </translate>
  )
}

export default function Model() {
  const holeX = 10

  return (
    <subtract>
      <union>
        <box size={[34, 24, 4]} />

        <RaisedBoss at={[0, 0, 7]} radius={6} height={10}>
          <translate offset={[0, 0, 7]}>
            <sphere radius={4} />
          </translate>
        </RaisedBoss>
      </union>

      <DrillHole at={[-holeX, -6, 0]} />
      <DrillHole at={[holeX, -6, 0]} />
      <DrillHole at={[-holeX, 6, 0]} />
      <DrillHole at={[holeX, 6, 0]} />
    </subtract>
  )
}
`
