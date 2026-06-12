const componentExample = `type Vec3 = [number, number, number]

type PartProps = {
  at: Vec3
  radius?: number
  children?: unknown
}

function Part({ at, radius = 5, children }: PartProps) {
  return (
    <translate offset={at}>
      <union>
        <sphere radius={radius} />
        {children}
      </union>
    </translate>
  )
}

export default function Model() {
  return (
    <Part at={[0, 0, 10]} radius={8}>
      <box size={[6, 6, 6]} />
    </Part>
  )
}`

const tags = [
  ['box', '<box size={[x, y, z]} />'],
  ['cylinder', '<cylinder radius={r} height={h} segments={32} />'],
  ['sphere', '<sphere radius={r} segments={32} />'],
  ['translate', '<translate offset={[x, y, z]}>shape</translate>'],
  ['rotate', '<rotate angles={[x, y, z]}>shape</rotate>'],
  ['scale', '<scale factors={[x, y, z]}>shape</scale>'],
  ['union', '<union>shapeA shapeB</union>'],
  ['subtract', '<subtract>base cutter</subtract>'],
  ['intersect', '<intersect>shapeA shapeB</intersect>'],
]

function SyntaxHelp() {
  return (
    <section className="min-h-0 flex-1 overflow-auto bg-white">
      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-950">Code to CAD Syntax Help</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            TSX tags do not create React DOM here. They call the CAD JSX runtime directly and return CAD geometry.
            The runtime uses an internal JSX factory named
            <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-xs">h()</code>, similar to React's JSX
            factory, but it returns geometry instead of UI elements. There is no separate JSCAD source-code generation
            step.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Custom Components And Props</h3>
            <p className="mb-3 text-sm leading-6 text-slate-600">
              Custom components are plain functions. Props are passed as the first argument, and nested JSX is available
              as <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">children</code>.
            </p>
            <pre className="overflow-auto rounded border border-slate-200 bg-slate-950 p-4 text-xs leading-5 text-slate-100">
              <code>{componentExample}</code>
            </pre>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Supported Tags</h3>
            <div className="overflow-hidden rounded border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="border-b border-slate-200 px-3 py-2 font-semibold">Tag</th>
                    <th className="border-b border-slate-200 px-3 py-2 font-semibold">Shape</th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map(([tag, syntax]) => (
                    <tr key={tag} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 align-top font-mono text-xs text-slate-700">{tag}</td>
                      <td className="px-3 py-2 align-top">
                        <code className="break-all rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-700">
                          {syntax}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 rounded border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <p className="font-semibold text-slate-800">Entry Points</p>
              <p className="mt-1">
                Use either <code className="rounded bg-white px-1 py-0.5 text-xs">export default function Model()</code>
                or <code className="rounded bg-white px-1 py-0.5 text-xs">export function main()</code>. The function
                should return one geometry or an array of geometries.
              </p>
              <p className="mt-3 font-semibold text-slate-800">Children</p>
              <p className="mt-1">
                A component that renders <code className="rounded bg-white px-1 py-0.5 text-xs">{'{children}'}</code>
                can receive nested CAD tags, arrays, or other custom components. Nested arrays are flattened by the
                runtime before CAD operations run.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default SyntaxHelp
