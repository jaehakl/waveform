import { cadElementCatalog } from '../cad/catalog'

function SyntaxHelp() {
  return (
    <section className="min-h-0 flex-1 overflow-auto bg-white">
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-950">Caemble Help</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            A Structure file exports one <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">Sample</code>,
            while an Experiment file exports one <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">Setup</code>.
            Both resolve vars before lazily creating Materials and evaluating root Geometry in the Worker. Each
            editor auto-runs changed code, and Reroll immediately executes its current source again. Experiment
            tensor values are available in the Experimental Parameters tab while the 3D Viewer remains visible.
          </p>
        </div>

        <div className="space-y-5">
          {(['primitive', 'operation'] as const).map((category) => (
            <div key={category}>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">
                {category === 'primitive' ? 'Primitives' : 'Geometry Operations'}
              </h3>
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
                    {cadElementCatalog.filter((element) => element.category === category).map((element) => (
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
          ))}

          <div className="rounded border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <p className="font-semibold text-slate-800">Vars</p>
              <p className="mt-1">
                Every schema item declares a fixed shape and default. Optional min and max values may be scalars or
                tensors with the same shape. Use <code className="rounded bg-white px-1 py-0.5 text-xs">vars.key</code>
                inside the lazy geometry factory and Geometry functions.
              </p>

              <p className="mt-3 font-semibold text-slate-800">Materials</p>
              <p className="mt-1">
                A Material contains a symbol, an optional version, and a deeply read-only JSON-compatible variables
                dictionary. Put an optional <code className="rounded bg-white px-1 py-0.5 text-xs">color</code> in
                that dictionary using <code className="rounded bg-white px-1 py-0.5 text-xs">#RRGGBB</code>.
                Geometry without a Material or color is shown as a neutral wireframe. Different instances may share
                a symbol and version.
              </p>
              <p className="mt-1">
                A Geometry inherits its parent materials array unless it supplies a replacement. Materialless
                Geometry may group children or produce unassigned primitive parts. Geometry with different Materials
                may be siblings. Union and intersect accept one shared Material or fully unassigned operands, but do
                not mix the two. Subtract applies every cutter to each part of its first child independently,
                preserves those optional base Materials, and does not include cutter Materials in the result.
                Material Grid samples colored parts and keeps unassigned parts visible as wireframe overlays.
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
              <p className="mt-1">
                Every Geometry invocation requires a case-sensitive string{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">id</code> containing Unicode letters,
                numbers, underscores, or hyphens. Sibling IDs must be unique under their nearest Geometry parent.
                Global IDs join local IDs with dots; intrinsic tags and Fragment do not add path segments. Raw CAD
                results without a Geometry ancestor are rejected.
              </p>

              <p className="mt-3 font-semibold text-slate-800">Geometry and Surface Groups</p>
              <p className="mt-1">
                Structure accepts optional <code className="rounded bg-white px-1 py-0.5 text-xs">geometryGroup</code>{' '}
                and <code className="rounded bg-white px-1 py-0.5 text-xs">surfaceGroup</code> maps from group names
                to global IDs. Geometry groups may reference final parts or intermediate Geometry IDs, which resolve
                to their surviving descendant parts. Surface groups use exact{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">partId/surface-N</code> IDs. Missing members
                remain visible in the Tree without highlighting geometry.
              </p>
              <p className="mt-1">
                Ctrl/Cmd-click same-kind Tree rows to create or extend a group. The current single selection becomes
                the first draft member and every drafted result is highlighted together in the viewer. Named groups
                contribute their declared members without becoming nested groups. They are displayed in separate
                Geometry and Surface sections and can be selected, expanded, edited, or deleted. These edits update
                the active default Sample&apos;s Structure or Setup&apos;s Experiment in Code Space immediately.
              </p>

              <p className="mt-3 font-semibold text-slate-800">Experiments, Solvers, Conditions, and Recorded Data</p>
              <p className="mt-1">
                <code className="rounded bg-white px-1 py-0.5 text-xs">Experiment</code> extends Structure. Every
                Experiment requires a <code className="rounded bg-white px-1 py-0.5 text-xs">solver</code> with
                static non-empty <code className="rounded bg-white px-1 py-0.5 text-xs">name</code> and{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">version</code> strings plus a lazy{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">parameters</code> factory. It also adds
                lazy <code className="rounded bg-white px-1 py-0.5 text-xs">initialConditions</code>,{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">boundaryConditions</code>, and{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">recordedData</code> rule arrays.{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">Setup</code> pairs an Experiment with resolved
                vars just as Sample pairs a Structure with vars. The editor previews Experiment geometry and the
                manual simulation combines its latest successful Setup with the latest successful Sample in the same
                coordinate system.
              </p>
              <p className="mt-1">
                Solver parameters run first with Setup values available through global{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">vars</code>. They must form a plain
                JSON-compatible object and are recursively copied and frozen. The editor then evaluates Experiment
                geometry, initial conditions, boundary conditions, and recorded data in that order. Once both latest
                document revisions are Ready, use <strong>Run Simulation</strong> in the Viewer toolbar. Editing or
                rerolling previews only and never runs the Solver automatically.
              </p>
              <p className="mt-1">
                The toolbar reports <code className="rounded bg-white px-1 py-0.5 text-xs">idle → preparing → running
                → succeeded | failed | cancelled</code> and shows Cancel only while a run is active. Source changes
                mark the last result Stale. Failed or cancelled reruns preserve that last result and its Results tab;
                successful runs do not switch tabs automatically. Solver name and version dispatch is exact and
                case-sensitive, and only one run is active at a time.
              </p>
              <p className="mt-1">
                Each rule has a non-empty <code className="rounded bg-white px-1 py-0.5 text-xs">target</code> array,
                whose entries use <code className="rounded bg-white px-1 py-0.5 text-xs">source.kind.group</code>, for
                example <code className="rounded bg-white px-1 py-0.5 text-xs">['experiment.geometry.domain']</code> or{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">['structure.surface.sampleBoundary']</code>.
                Experiment targets must name one of its own groups. Structure targets are deferred during preview,
                then simulation preparation verifies the paired Structure group and every referenced member. Every
                rule also has a category-unique Experiment label, a reusable simulation method ID, and a parameters
                object whose values are raw bool, string, finite int/float scalars, explicit
                scalar descriptors, or explicit tensor descriptors. Functions, null, raw arrays, arbitrary nested
                objects, undefined, and non-finite numbers are rejected. All three factories run with Setup values
                available through the global{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">vars</code> binding.
              </p>
              <p className="mt-1">
                Tensor parameters use{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">
                  {'{ type: \'tensor\', dimension, shape, dtype, axes?, value }'}
                </code>{' '}
                with dimension at least one, positive fixed shape sizes, and an exact recursive value shape. Dtypes
                are bool, string, signed or unsigned 8/16/32/64-bit integers, or float16/32/64; 64-bit integers are
                limited to JavaScript safe integers. Optional axes contains one name/ticks object per dimension.
                Missing names become axis 0, axis 1, and so on; missing ticks become zero-based indices matching the
                corresponding shape size. Explicit ticks accept strings and finite numbers. Prefer a top-level const
                for raw tensor data. Experimental Parameters edits only inline and top-level const JSON arrays;
                normalized axes are displayed read-only, computed and vars-backed values remain read-only, and
                scalar or schema edits stay in Experiment Source.
              </p>
              <p className="mt-1">
                Every recorded-data rule also declares a tensor-only{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">result</code> schema. A scalar output uses{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">
                  {'{ type: \'tensor\', dimension: 0, shape: [], dtype: \'float64\' }'}
                </code>, which normalizes to an empty axes array. Result shapes, unlike parameter shapes, may use{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">-1</code> on multiple axes. A wildcard axis
                may declare its name but must omit source ticks; its length and optional ticks are resolved from the
                matching result payload, falling back to zero-based indices.
              </p>
              <p className="mt-1">
                CadViewer recordedData is a dictionary keyed by the unique recorded rule label. Each entry contains{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">{'{ value, axes?: [{ ticks? }] }'}</code>;
                dtype, dimension, shape, and axis names remain defined by Experiment Source. Results appears whenever
                recorded rules exist, shows empty plot shells before values arrive, and renders 0D scalars, numeric
                1D line charts, numeric 2D heatmaps, and bool/string tables. Higher-dimensional tensors use leading
                axis selectors and visualize the final two axes. A solver success must include every rule label and
                no unknown labels; shape, dtype, and axes are validated before the recursively frozen result is
                accepted. Result plots are read-only and their local validation errors do not change CAD compile or
                render status.
              </p>

              <p className="mt-3 font-semibold text-slate-800">Default DC Current Density Solver</p>
              <p className="mt-1">
                The default Structure is a <code className="rounded bg-white px-1 py-0.5 text-xs">[100, 12, 10] mm</code>{' '}
                copper bar with an eccentric <code className="rounded bg-white px-1 py-0.5 text-xs">[30, 5, 5] mm</code>{' '}
                corner notch, <code className="rounded bg-white px-1 py-0.5 text-xs">electricalConductivity =
                5.96e7 S/m</code>, and named -X/+X terminal surfaces. Its Experiment selects{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">dc-current-density@1.0.0</code>, uses{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">gridShape = [100, 41, 41]</code>, and samples
                the axial face near the notch entrance with{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">crossSectionPosition = 0.35</code>. Geometry
                and result coordinates are converted to SI with{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">lengthScaleToMeters = 0.001</code>.
              </p>
              <p className="mt-1">
                The Worker builds a cell-centered voxel finite-volume system for{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">∇·(σ∇V) = 0</code>, applies 1 mV/0 V
                Dirichlet terminals and insulating conditions elsewhere, and solves it with Jacobi-preconditioned
                conjugate gradient. The signed source-to-reference axial current density is returned as a float64{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">41×41</code> heatmap in A/m² with u/v ticks
                in meters; exterior and notch cells are zero. Total current is the absolute signed flux integral in
                amperes. A uniform <code className="rounded bg-white px-1 py-0.5 text-xs">[100, 5, 5] mm</code>{' '}
                verification bar converges to <code className="rounded bg-white px-1 py-0.5 text-xs">596000 A/m²</code>{' '}
                and <code className="rounded bg-white px-1 py-0.5 text-xs">14.9 A</code>.
              </p>
              <p className="mt-1">
                The v1 2D heatmap schema intentionally breaks the former three-component vector schema. Resolution
                affects notch details, so refine the grid and compare flux before treating a result as converged.
                Runs are limited to 250,000 voxels and one connected, homogeneous, isotropic Material part with two
                planar opposing terminals; invalid inputs or PCG nonconvergence fail without replacing the last
                successful result. Occupancy and PCG yield periodically so Cancel is effective. Future browser or
                API-backed modules use the same UI-independent SolverModule contract; an API module may perform fetch
                while honoring the supplied AbortSignal.
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

              <p className="mt-3 font-semibold text-slate-800">Surface Shells</p>
              <p className="mt-1">
                A <code className="rounded bg-white px-1 py-0.5 text-xs">shell</code> creates layers between signed{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">offsets</code> of one closed child solid.
                Negative values point inward and positive values point outward. Offsets must be finite, non-zero,
                and strictly increasing; the original surface at zero is inserted automatically. Child transforms
                run before offsetting, and the shell&apos;s own transform runs after every layer is complete.
              </p>
              <p className="mt-1">
                Layers are returned from the most inward boundary to the most outward boundary. The enclosing
                Geometry may omit Materials for unassigned layers. When Materials are supplied, it must provide
                exactly one per explicit offset in that same order; child Materials do not select layer Materials.
                Only shell layers are returned, not the core below the innermost boundary, so placing the original
                solid beside an inward shell can create overlap.
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
                repeated child keeps its explicit local ID, while each generated parent path receives a reserved{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">$cell-x-y-z</code> segment. Injecting{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">id</code> is not supported. The
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
    </section>
  )
}

export default SyntaxHelp
