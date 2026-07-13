const structureExample = `import { Material, Sample, Structure } from '@caemble/core'

class Dielectric extends Material {}

function Core({ materials }: { materials?: Material[] }) {
  return <box size={[vars.width, 10, 2]} />
}

function Device({ materials }: { materials: Material[] }) {
  return <Core materials={[materials[0]]} />
}

const structure = new Structure({
  geometry: () => (
    <Device
      materials={[
        new Dielectric('Core', { epsilon: vars.epsilon }, '#2563eb'),
      ]}
    />
  ),
  varsSchema: {
    width: { shape: [], default: 20, min: 10, max: 30 },
    epsilon: { shape: [], default: 12 },
  },
})

export default new Sample(structure)`

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
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-950">Caemble Syntax Help</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            A file exports one <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">Sample</code>. Its
            Structure resolves vars first, then lazily creates Materials and evaluates the root Geometry in the
            Worker.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Structure And Sample</h3>
            <pre className="overflow-auto rounded border border-slate-200 bg-slate-950 p-4 text-xs leading-5 text-slate-100">
              <code>{structureExample}</code>
            </pre>
          </div>

          <div className="space-y-5">
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
            </div>

            <div className="rounded border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <p className="font-semibold text-slate-800">Vars</p>
              <p className="mt-1">
                Every schema item declares a fixed shape and default. Optional min and max values may be scalars or
                tensors with the same shape. Use <code className="rounded bg-white px-1 py-0.5 text-xs">vars.key</code>
                inside the lazy geometry factory and Geometry functions.
              </p>

              <p className="mt-3 font-semibold text-slate-800">Materials</p>
              <p className="mt-1">
                A Geometry inherits its parent materials array unless it supplies a replacement. Its own primitives
                use index zero. Geometry with different Materials may be siblings, but cannot share a boolean
                operation.
              </p>

              <p className="mt-3 font-semibold text-slate-800">Imports</p>
              <p className="mt-1">
                Only <code className="rounded bg-white px-1 py-0.5 text-xs">@caemble/core</code> is available. Define
                reusable Geometry and Material subclasses in the same file.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default SyntaxHelp
