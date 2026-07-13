import { defaultCode } from '../defaultCode'
import { cadElementCatalog } from '../cad/catalog'

const structureExample = defaultCode.trim()

function SyntaxHelp() {
  return (
    <section className="min-h-0 flex-1 overflow-auto bg-white">
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-950">Caemble Syntax Help</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            A file exports one <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">Sample</code>. Its
            Structure resolves vars first, then lazily creates Materials and evaluates the root Geometry in the
            Worker. Workspace auto-runs edited code and the Reroll button immediately executes the current source
            again, producing new values for seedless random vars.
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
                      <th className="border-b border-slate-200 px-3 py-2 font-semibold">Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cadElementCatalog.map((element) => (
                      <tr key={element.tag} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2 align-top font-mono text-xs text-slate-700">{element.tag}</td>
                        <td className="px-3 py-2 align-top">
                          <code className="break-all rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-700">
                            {element.syntax}
                          </code>
                        </td>
                        <td className="px-3 py-2 align-top text-xs leading-5 text-slate-600">{element.summary}</td>
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
                A Geometry inherits its parent materials array unless it supplies a replacement. Materialless
                Geometry may group children; a primitive requires a Material and uses index zero. Geometry with
                different Materials may be siblings. Union and intersect require one shared Material. Subtract
                applies every cutter to each part of its first child independently, preserves those base Materials,
                and does not include cutter Materials in the result.
              </p>

              <p className="mt-3 font-semibold text-slate-800">Geometry Components</p>
              <p className="mt-1">
                Use the type-only <code className="rounded bg-white px-1 py-0.5 text-xs">Geometry&lt;P&gt;</code> for
                shared attributes plus custom props, or{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">GeometryAttributes&lt;P&gt;</code> when the
                combined props type is needed directly. A parent may calculate child-local size and transforms from
                its normalized transform values and custom props. The evaluator still applies the parent transform
                once to the completed result.
              </p>

              <p className="mt-3 font-semibold text-slate-800">Transforms</p>
              <p className="mt-1">
                Geometry and CAD elements accept <code className="rounded bg-white px-1 py-0.5 text-xs">pos</code>,{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">rotate</code>, and{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">scale</code>. Rotation uses a local axis and a
                radians angle with the right-hand rule. Child operations run first, followed by scale, rotation, and
                position.
              </p>

              <p className="mt-3 font-semibold text-slate-800">Curved Edge Cylinders</p>
              <p className="mt-1">
                A <code className="rounded bg-white px-1 py-0.5 text-xs">curvedEdgeCylinder</code> is a capped,
                z-axis solid centered on the local origin. Its radius is{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">A(theta) * V(z)</code>, where the
                azimuthal curve is an amplitude/phase Fourier series and the vertical curve is a Taylor series in{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">z - origin</code>.
              </p>
              <p className="mt-1">
                Array indices give Fourier modes and Taylor orders starting at zero. Angles use radians and local z
                runs from <code className="rounded bg-white px-1 py-0.5 text-xs">-height / 2</code> to{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">height / 2</code>. Increase{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">azimuthalSegments</code> or{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">verticalSegments</code> for rapidly varying
                curves; every sampled product radius must remain positive.
              </p>

              <p className="mt-3 font-semibold text-slate-800">Curved Surface Spheres</p>
              <p className="mt-1">
                A <code className="rounded bg-white px-1 py-0.5 text-xs">curvedSurfaceSphere</code> is a closed,
                origin-centered surface with radius{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">A(theta) * P(phi)</code>. Both factors are
                amplitude/phase Fourier series whose array indices are modes starting at zero.
              </p>
              <p className="mt-1">
                Azimuth <code className="rounded bg-white px-1 py-0.5 text-xs">theta</code> runs around the z-axis
                from zero to 2π, and polar angle{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">phi</code> runs from +z to -z over zero to
                π. The single north and south pole vertices evaluate the azimuthal curve at theta zero. Increase{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">azimuthalSegments</code> or{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">polarSegments</code> for rapidly varying
                curves; every sampled product radius must remain positive.
              </p>

              <p className="mt-3 font-semibold text-slate-800">Procedural Fibers</p>
              <p className="mt-1">
                A <code className="rounded bg-white px-1 py-0.5 text-xs">fiber</code> is a capped circular solid
                joining <code className="rounded bg-white px-1 py-0.5 text-xs">from</code> and{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">to</code>. Optional{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">basePath(t)</code> returns a complete local
                path whose endpoints must match those points. Helix and amplitude/phase Fourier modes displace the
                path in a parallel-transport Bishop frame, while the endpoint envelope keeps both centers fixed.
              </p>
              <p className="mt-1">
                Top-level <code className="rounded bg-white px-1 py-0.5 text-xs">radius(s)</code> is the positive
                physical cross-section radius along normalized final arc length.{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">helix.radius(u, theta)</code> is a separate,
                non-negative centerline displacement along normalized base-curve arc length. Increase{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">pathSegments</code> or{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">radialSegments</code> when the curve needs
                more resolution. Exact zero-radius tips and self-intersection repair are not supported.
              </p>

              <p className="mt-3 font-semibold text-slate-800">Surface Coatings</p>
              <p className="mt-1">
                A <code className="rounded bg-white px-1 py-0.5 text-xs">coating</code> creates layers between signed{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">offsets</code> of one closed child solid.
                Negative values point inward and positive values point outward. Offsets must be finite, non-zero,
                and strictly increasing; the original surface at zero is inserted automatically. Child transforms
                run before offsetting, and the coating&apos;s own transform runs after every layer is complete.
              </p>
              <p className="mt-1">
                Layers are returned from the most inward boundary to the most outward boundary. The enclosing
                Geometry must provide exactly one Material per explicit offset in that same order; child Materials
                do not select layer Materials. Only coating layers are returned, not the core below the innermost
                boundary, so placing the original solid beside an inward coating can create overlap.
              </p>
              <p className="mt-1">
                Offsets follow the child mesh resolution and preserve its topology, with mitered sharp edges.
                Boundaries that collapse or invert local triangles are rejected. Distant self-intersections caused
                by narrow gaps are not detected or repaired automatically.
              </p>

              <p className="mt-3 font-semibold text-slate-800">Geometry Arrays</p>
              <p className="mt-1">
                The <code className="rounded bg-white px-1 py-0.5 text-xs">array</code> tag repeats one direct
                Geometry child around its local center. Shape and period follow x/y/z order, optional direction axes
                may be non-orthogonal, and every injected tensor starts with{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">[shape.x][shape.y][shape.z]</code>. Injected
                custom props and per-cell pos, scale, or axis-angle rotate replace the child&apos;s base values. The
                child transform runs before the lattice offset and the array&apos;s own scale, rotate, and pos. The
                default example uses 60-degree x/y axes and centered A/B/A layers. Its B layer is offset by one-third
                of both planar basis vectors, adjacent layers use ideal HCP spacing, and seedless random vars produce
                unit-sphere-uniform rotation axes for all 27 cells.
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
