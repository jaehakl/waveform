import { cadElementCatalog } from '@/lib/cad'

function SyntaxHelp() {
  return (
    <section className="min-h-0 flex-1 overflow-auto bg-white">
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-950">Caemble Help</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            A Structure file default-exports{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">structure({'{...}'})</code>, while an Experiment
            file exports <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">experiment({'{...}'})</code>. Both
            resolve externally supplied or seed-generated vars before evaluating callbacks in an isolated disposable
            Worker. Source edits preserve the seed; Reroll alone changes it. Experiment tensor values are available in
            the Experimental Parameters tab while the 3D Viewer remains visible.
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
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="border-b border-slate-200 px-3 py-2 font-semibold">Tag</th>
                      <th className="border-b border-slate-200 px-3 py-2 font-semibold">Shape</th>
                      <th className="border-b border-slate-200 px-3 py-2 font-semibold">Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cadElementCatalog
                      .filter((element) => element.category === category)
                      .map((element) => (
                        <tr key={element.tag} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-2 align-top font-mono text-xs text-slate-700">{element.tag}</td>
                          <td className="px-3 py-2 align-top">
                            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs break-all text-slate-700">
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
              Every schema item declares required min and max values. Tensor shape is inferred from either tensor bound,
              while a scalar opposite bound broadcasts to that shape; two scalar bounds define a scalar var. Equal
              bounds fix an element. Use <code className="rounded bg-white px-1 py-0.5 text-xs">vars.key</code>
              through the explicit <code className="rounded bg-white px-1 py-0.5 text-xs">({'{ vars }'})</code> callback
              argument. The same compiled Source can be evaluated repeatedly with different external values; unknown
              keys, shape mismatches, and out-of-range components fail before callbacks run. Vars remain unitless
              intermediate values; declare Quantity Kind and unit metadata where those values enter a Material, solver,
              rule, or result descriptor.
            </p>

            <p className="mt-3 font-semibold text-slate-800">Quantity Kinds and UCUM Units</p>
            <p className="mt-1">
              Every Structure and Experiment requires a case-sensitive UCUM length code in{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">lengthUnit</code>. Native scene coordinates keep
              that unit. The Viewer uses the Structure unit when available and scales copied layers before rendering and
              Material Grid sampling, leaving the source scenes unchanged. Grid spacing is displayed in the selected
              Viewer unit.
            </p>
            <p className="mt-1">
              Floating-point values use{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">
                {"{ dtype: 'float64', value, unit, quantityKind, basis? }"}
              </code>
              . Quantity Kind names are selected from Caemble&apos;s physical-domain catalog exposed by autocomplete.
              Domain-neutral names such as <code className="rounded bg-white px-1 py-0.5 text-xs">Length</code> are
              unqualified; domain-specific names use forms such as{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">electromagnetism.ElectricCurrent</code>. Units
              follow the official UCUM grammar and must exactly match one of that Quantity Kind&apos;s applicable codes.
              Equivalent but differently spelled expressions are rejected. Use codes such as{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">A.m-2</code>,{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">S.m-1</code>,{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">mV</code>,{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">{'{fraction}'}</code>, and{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">%</code>. Dimensionless floats still require{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">DimensionlessRatio</code> with either{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">{'{fraction}'}</code> or another explicitly
              applicable code; percent keeps its UCUM scale.
            </p>
            <p className="mt-1">
              Use <code className="rounded bg-white px-1 py-0.5 text-xs">Mat(diagonal, offDiagonal = 0, size = 3)</code>{' '}
              to create a deeply frozen square matrix.{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">Mat(a)</code> returns{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">[[a,0,0],[0,a,0],[0,0,a]]</code>,{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">Mat(a, b)</code> fills every off-diagonal component
              with b, and <code className="rounded bg-white px-1 py-0.5 text-xs">Mat(a, b, 2)</code> creates a 2×2
              matrix. TypeScript uses positional arguments, so a 2×2 diagonal matrix is{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">Mat(a, 0, 2)</code>. Quantity Kind component-shape
              validation still applies.
            </p>

            <p className="mt-3 font-semibold text-slate-800">Materials</p>
            <p className="mt-1">
              A Material contains a name, an optional{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">source</code>
              or <code className="rounded bg-white px-1 py-0.5 text-xs">source/version</code> selector, and a deeply
              read-only variables dictionary. Put an optional{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">color</code> in that dictionary using{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">#RRGGBB</code>. When source color is omitted, the
              selected database Material color is frozen into the Sample or Setup.
            </p>
            <p className="mt-1">
              Set a Material-wide unitless <code className="rounded bg-white px-1 py-0.5 text-xs">errorRate</code> in{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">[0, 1)</code> beside color. A property may override
              it with its own errorRate. The priority is property, Material, then{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">0.001</code>; an explicit{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">0</code> disables variation for that property.
                Sampled relations are not varied. Geometry without a Material or color is shown as a neutral wireframe.
                Different instances may share a Material name and source selector.
            </p>
            <p className="mt-1">
              Each evaluated snapshot keeps one Material realization across preview and Solver use. Every scalar or
              float tensor receives one uniform multiplier. Rerolling the definition creates a new realization. The
              original Material keeps its nominal value and errorRate, while scene and Solver variables expose only the
              realized value. Nested floats, non-float tensors, color, and other metadata are unchanged.
            </p>
            <p className="mt-1">
              A Geometry inherits its parent materials array unless it supplies a replacement. Materialless Geometry may
              group children or produce unassigned primitive parts. Geometry with different Materials may be siblings.
              Union and intersect accept one shared Material or fully unassigned operands, but do not mix the two.
              Subtract applies every cutter to each part of its first child independently, preserves those optional base
              Materials, and does not include cutter Materials in the result. Material Grid samples colored parts and
              keeps unassigned parts visible as wireframe overlays.
            </p>

            <p className="mt-3 font-semibold text-slate-800">Geometry Components</p>
            <p className="mt-1">
              Use the type-only <code className="rounded bg-white px-1 py-0.5 text-xs">Geometry&lt;P&gt;</code> for
              shared attributes plus custom props, or{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">GeometryAttributes&lt;P&gt;</code> when the
              combined props type is needed directly. A parent may calculate child-local size and transforms from its
              normalized transform values and custom props. The evaluator still applies the parent transform once to the
              completed result.
            </p>
            <p className="mt-1">
              Every Geometry invocation requires a case-sensitive string{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">id</code> containing Unicode letters, numbers,
              underscores, or hyphens. Sibling IDs must be unique under their nearest Geometry parent. Global IDs join
              local IDs with dots; intrinsic tags and Fragment do not add path segments. Raw CAD results without a
              Geometry ancestor are rejected.
            </p>

            <p className="mt-3 font-semibold text-slate-800">Geometry and Surface Groups</p>
            <p className="mt-1">
              Structure accepts optional <code className="rounded bg-white px-1 py-0.5 text-xs">geometryGroup</code> and{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">surfaceGroup</code> maps from group names to global
              IDs. Geometry groups may reference final parts or intermediate Geometry IDs, which resolve to their
              surviving descendant parts. Surface groups use exact{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">partId/surface-N</code> IDs. Missing members remain
              visible in the Tree without highlighting geometry.
            </p>
            <p className="mt-1">
              Ctrl/Cmd-click same-kind Tree rows to create or extend a group. The current single selection becomes the
              first draft member and every drafted result is highlighted together in the viewer. Named groups contribute
              their declared members without becoming nested groups. They are displayed in separate Geometry and Surface
              sections and can be selected, expanded, edited, or deleted. These edits update the active default-exported
              Structure or Experiment definition through a source-hash-bound patch. Dynamic object expressions remain
              executable, but their related visual editor is read-only.
            </p>

            <p className="mt-3 font-semibold text-slate-800">Experiments, Solvers, Conditions, and Recorded Data</p>
            <p className="mt-1">
              <code className="rounded bg-white px-1 py-0.5 text-xs">experiment({'{...}'})</code> defines Experiment
              geometry and authoring rules. Every Experiment requires a{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">solver</code> with static non-empty{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">name</code> and{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">version</code> strings plus a lazy{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">parameters</code> factory. It also adds
              callback-based <code className="rounded bg-white px-1 py-0.5 text-xs">initializations</code>,{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">boundaryConditions</code>, and{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">recordedData</code> rule arrays. The editor
              previews the latest successful Experiment snapshot, and manual simulation pairs that exact snapshot with
              the latest successful Structure snapshot. Each scene retains its declared length unit; viewers and solver
              modules convert only at their consumption boundary.
            </p>
            <p className="mt-1">
              Solver parameters receive the same explicit{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">({'{ vars }'})</code> context as geometry and
              rules. They must form a plain JSON-compatible object and are recursively copied and frozen. Safe integers
              remain raw; every float leaf uses the Quantity Kind and unit-aware float descriptor, including nested
              arrays and objects. The editor then evaluates Experiment geometry, initializations, boundary conditions,
              and recorded data in that order. Once both latest document revisions are Ready, use{' '}
              <strong>Run Simulation</strong> in the Viewer toolbar. Editing or rerolling previews only and never runs
              the Solver automatically.
            </p>
            <p className="mt-1">
              The toolbar reports{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">
                idle → preparing → running → succeeded | failed | cancelled
              </code>{' '}
              and shows Cancel only while a run is active. Source changes mark the last result Stale. Failed or
              cancelled reruns preserve that last result and its Results tab; successful runs do not switch tabs
              automatically. Solver name and version dispatch is exact and case-sensitive, and only one run is active at
              a time.
            </p>
            <p className="mt-1">
              Every registered Solver module supplies one serializable spec sheet. After Experiment evaluation, the
              Worker checks its required Solver parameters, method IDs, method parameters, targets, Material roles, and
              RecordedData result schemas. Structure targets and Material roles are completed as soon as both current
              documents are available. Compatibility issues keep successful previews and both documents Ready, mark
              Simulation as Incompatible, and disable Run before numerical work starts. Actual Source compilation,
              evaluation, rendering, and Solver execution failures remain errors. Open the <strong>Solver Spec</strong>{' '}
              tab to inspect the current contract and applicable units. Undeclared Solver, method, and Material
              parameter keys are accepted and preserved for cross-version source compatibility; registered method IDs
              and result contracts remain exact.
            </p>
            <p className="mt-1">
              Each rule has a non-empty <code className="rounded bg-white px-1 py-0.5 text-xs">target</code> array,
              whose entries use <code className="rounded bg-white px-1 py-0.5 text-xs">source.kind.group</code>, for
              example <code className="rounded bg-white px-1 py-0.5 text-xs">['experiment.geometry.domain']</code> or{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">['structure.surface.conductorBoundary']</code>.
              Experiment targets must name one of its own groups. Structure targets are deferred until the paired
              document is ready, then common spec preflight verifies every referenced member before Run. Every rule also
              has a category-unique Experiment label, a reusable simulation method ID, and a parameters object whose
              values are raw bool, string, or safe integer scalars, or explicit dtype descriptors. Raw fractional
              numbers are rejected; use a float descriptor with a required Quantity Kind and applicable UCUM unit.
              Functions, null, raw arrays, arbitrary nested objects, undefined, and non-finite numbers are rejected. v2
              never exposes a module-global <code className="rounded bg-white px-1 py-0.5 text-xs">vars</code> binding.
            </p>
            <p className="mt-1">
              Explicit values use{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">
                {'{ dtype, value, axes?, unit?, quantityKind?, basis? }'}
              </code>{' '}
              where omitting axes means one Quantity value and a non-empty axes array arranges Quantity values. All
              Quantity Kinds have an explicit physical domain and tensor order with no inferred fallback. Each order
              contributes a trailing [3] per component index, so storage is always axis lengths followed by
              componentShape. Dtypes are bool, string, signed or unsigned 8/16/32/64-bit integers, or float16/32/64;
              64-bit integers are limited to JavaScript safe integers. Float dtypes require both unit and quantityKind;
              non-float dtypes reject all quantity metadata. Every fixed axis requires a positive safe-integer length
              and may omit unit metadata, or provide its unit and quantityKind together. Missing names become axis 0,
              axis 1, and so on; missing ticks become zero-based indices matching the corresponding axis length;
              explicit ticks must have that same length. Empty axes are rejected. Order-0 quantities forbid basis;
              order-1 and higher quantities default an omitted basis to the identity Cartesian basis and validate any
              explicitly supplied basis as finite, orthonormal, and right-handed. Explicit ticks accept strings and
              finite numbers. Prefer a top-level const for raw tensor data. Experimental Parameters edits only inline
              and top-level const JSON arrays; normalized axes, Quantity Kinds, tensor order, component shape, basis,
              and units are displayed read-only, computed and vars-backed values remain read-only, and scalar or schema
              edits stay in Experiment Source.
            </p>
            <p className="mt-1">
              Every recorded-data rule also declares a{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">result</code> schema. A scalar output uses{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">
                {"{ dtype: 'float64', unit: 'A', quantityKind: 'electromagnetism.ElectricCurrent' }"}
              </code>
              . RecordedData result axes alone may omit{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">length</code> to be dynamic. A dynamic axis may
              declare its name and paired unit/quantityKind metadata but must omit source ticks; its length and optional
              ticks are resolved from the matching result payload, falling back to zero-based indices. Float results
              require a Quantity Kind and applicable UCUM unit; non-float results reject both.
            </p>
            <p className="mt-1">
              CadViewer recordedData is a dictionary keyed by the unique recorded rule label. Each entry contains{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">{'{ value, axes?: [{ ticks? }] }'}</code>; dtype,
              component shape, basis, and axis names remain defined by Experiment Source. Results appears whenever
              recorded rules exist, shows empty plot shells before values arrive, and renders scalar results, numeric 1D
              line charts, numeric 2D heatmaps, and bool/string tables. Higher-dimensional tensors use leading axis
              selectors and visualize the final two axes. Vector and tensor quantities default to Euclidean/Frobenius
              norm and expose every basis component. Scalar suffixes, plot axes, and heatmap colorbars use schema units.
              Non-float schemas without unit metadata are displayed as unitless. A solver success must include every
              rule label and no unknown labels; axis lengths, component shape, dtype, basis, and axes are validated
              before the recursively frozen result is accepted. Result plots are read-only and their local validation
              errors do not change CAD compile or render status.
            </p>

            <p className="mt-3 font-semibold text-slate-800">Default DC Current Density Solver</p>
            <p className="mt-1">
              The default Structure is a fixed{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">[100, 12, 10] mm</code> copper bar with a
              randomized corner-notch size from <code className="rounded bg-white px-1 py-0.5 text-xs">[20, 4, 5]</code>{' '}
              through <code className="rounded bg-white px-1 py-0.5 text-xs">[40, 6, 7]</code>,{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">
                electrical.conductivity = σI = 5.96e7 S.m-1 (electromagnetism.ElectricConductivity)
              </code>
              , and named -X/+X terminal surfaces. Its Experiment selects{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">dc-current-density@0.0.0</code>. A{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">dc.voxel-grid</code> initialization owns the
              editable int32 <code className="rounded bg-white px-1 py-0.5 text-xs">gridShape = [100, 41, 41]</code>{' '}
              tensor. Both RecordedData rules record the same axial face near the notch entrance through{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">
                {
                  "crossSectionPosition = { dtype: 'float64', value: 0.35, unit: '{fraction}', quantityKind: 'DimensionlessRatio' }"
                }
              </code>
              . Applicable dimensionless forms such as 0.35 fraction and 35% are convertible; different result positions
              fail. The solver derives geometry conversion from Structure{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">lengthUnit</code>; the former{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">lengthScaleToMeters</code> parameter is removed.
            </p>
            <p className="mt-1">
              The Worker builds a cell-centered voxel finite-volume system for{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">∇·(σ∇V) = 0</code>, applies 1 mV/0 V Dirichlet
              terminals and insulating conditions elsewhere, and solves it with Jacobi-preconditioned conjugate
              gradient. The source-to-reference current density is returned in global Cartesian components as a float64{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">[41,41,3]</code> payload declared as{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">
                A.m-2 / electromagnetism.ElectricCurrentDensity
              </code>
              , with u/v axes declared as <code className="rounded bg-white px-1 py-0.5 text-xs">m / Length</code>;
              exterior and notch cells are zero. Applicable alternative result/axis units are converted before
              publishing. Total current is the absolute signed flux integral in amperes. A uniform{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">[100, 5, 5] mm</code> verification bar converges to{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">596000 A/m²</code> and{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">14.9 A</code>.
            </p>
            <p className="mt-1">
              The v2 contract rejects obsolete type/shape/dimension/sampleDimension/sampleShape/sampleAxes fields, bare
              scalar conductivity, scalar current-density payloads, and conductivity other than positive isotropic σI in
              the identity basis. Isotropic conductivity can use Mat(σ). Resolution affects notch details, so refine the
              initialization grid and compare flux before treating a result as converged. Runs are limited to 250,000
              voxels and one connected, homogeneous, isotropic Material part with two planar opposing terminals.
              Terminal voltage, conductivity, and scene lengths are converted to the solver&apos;s SI working units;
              missing or incompatible Quantity Kind/unit metadata, invalid inputs, or PCG nonconvergence fail without
              replacing the last successful result. Occupancy and PCG yield periodically so Cancel is effective. Future
              browser or API-backed modules use the same folder-based{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">SolverModule</code> contract, provide a spec sheet,
              and may perform fetch while honoring the supplied AbortSignal.
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
              A <code className="rounded bg-white px-1 py-0.5 text-xs">curvedEdgeCylinder</code> is a capped, z-axis
              solid centered on the local origin. Its radius is{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">A(theta) * V(z)</code>, where the azimuthal curve
              is an amplitude/phase Fourier series and the vertical curve is a Taylor series in{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">z - origin</code>.
            </p>
            <p className="mt-1">
              Array indices give Fourier modes and Taylor orders starting at zero. Angles use radians and local z runs
              from <code className="rounded bg-white px-1 py-0.5 text-xs">-height / 2</code> to{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">height / 2</code>. Increase{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">azimuthalSegments</code> or{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">verticalSegments</code> for rapidly varying curves;
              every sampled product radius must remain positive.
            </p>

            <p className="mt-3 font-semibold text-slate-800">Curved Surface Spheres</p>
            <p className="mt-1">
              A <code className="rounded bg-white px-1 py-0.5 text-xs">curvedSurfaceSphere</code> is a closed,
              origin-centered surface with radius{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">A(theta) * P(phi)</code>. Both factors are
              amplitude/phase Fourier series whose array indices are modes starting at zero.
            </p>
            <p className="mt-1">
              Azimuth <code className="rounded bg-white px-1 py-0.5 text-xs">theta</code> runs around the z-axis from
              zero to 2π, and polar angle <code className="rounded bg-white px-1 py-0.5 text-xs">phi</code> runs from +z
              to -z over zero to π. The single north and south pole vertices evaluate the azimuthal curve at theta zero.
              Increase <code className="rounded bg-white px-1 py-0.5 text-xs">azimuthalSegments</code> or{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">polarSegments</code> for rapidly varying curves;
              every sampled product radius must remain positive.
            </p>

            <p className="mt-3 font-semibold text-slate-800">Procedural Fibers</p>
            <p className="mt-1">
              A <code className="rounded bg-white px-1 py-0.5 text-xs">fiber</code> is a capped circular solid joining{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">from</code> and{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">to</code>. Optional{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">basePath(t)</code> returns a complete local path
              whose endpoints must match those points. Helix and amplitude/phase Fourier modes displace the path in a
              parallel-transport Bishop frame, while the endpoint envelope keeps both centers fixed.
            </p>
            <p className="mt-1">
              Top-level <code className="rounded bg-white px-1 py-0.5 text-xs">radius(s)</code> is the positive physical
              cross-section radius along normalized final arc length.{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">helix.radius(u, theta)</code> is a separate,
              non-negative centerline displacement along normalized base-curve arc length. Increase{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">pathSegments</code> or{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">radialSegments</code> when the curve needs more
              resolution. Exact zero-radius tips and self-intersection repair are not supported.
            </p>

            <p className="mt-3 font-semibold text-slate-800">Surface Shells</p>
            <p className="mt-1">
              A <code className="rounded bg-white px-1 py-0.5 text-xs">shell</code> creates layers between signed{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">offsets</code> of one closed child solid. Negative
              values point inward and positive values point outward. Offsets must be finite, non-zero, and strictly
              increasing; the original surface at zero is inserted automatically. Child transforms run before
              offsetting, and the shell&apos;s own transform runs after every layer is complete.
            </p>
            <p className="mt-1">
              Layers are returned from the most inward boundary to the most outward boundary. The enclosing Geometry may
              omit Materials for unassigned layers. When Materials are supplied, it must provide exactly one per
              explicit offset in that same order; child Materials do not select layer Materials. Only shell layers are
              returned, not the core below the innermost boundary, so placing the original solid beside an inward shell
              can create overlap.
            </p>
            <p className="mt-1">
              Offsets follow the child mesh resolution and preserve its topology, with mitered sharp edges. Boundaries
              that collapse or invert local triangles are rejected. Distant self-intersections caused by narrow gaps are
              not detected or repaired automatically.
            </p>

            <p className="mt-3 font-semibold text-slate-800">Geometry Arrays</p>
            <p className="mt-1">
              The <code className="rounded bg-white px-1 py-0.5 text-xs">array</code> tag repeats one direct Geometry
              child around its local center. Shape and period follow x/y/z order, optional direction axes may be
              non-orthogonal, and every injected tensor starts with{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">[shape.x][shape.y][shape.z]</code>. Injected custom
              props and per-cell pos, scale, or axis-angle rotate replace the child&apos;s base values. The child
              transform runs before the lattice offset and the array&apos;s own scale, rotate, and pos. The repeated
              child keeps its explicit local ID, while each generated parent path receives a reserved{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">$cell-x-y-z</code> segment. Injecting{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">id</code> is not supported. The default example
              uses 60-degree x/y axes and centered A/B/A layers. Its B layer is offset by one-third of both planar basis
              vectors, adjacent layers use ideal HCP spacing, and deterministically seeded vars produce
              unit-sphere-uniform rotation axes for all 27 cells.
            </p>

            <p className="mt-3 font-semibold text-slate-800">Imports</p>
            <p className="mt-1">
              Static imports may use <code className="rounded bg-white px-1 py-0.5 text-xs">@caemble/core/v2</code> or
              relative `.ts`/`.tsx` files inside the virtual project. Dynamic imports, URLs, and other packages are
              rejected. Define reusable Geometry components and Material classes in those project files.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default SyntaxHelp
