# Caemble

Browser-only Structure/Sample and Experiment/Setup modeling workspace with manual, module-based simulation. Write either model as TSX, resolve its vars, render both material-aware CAD scenes, and run a matching JavaScript or API-backed solver module.

## Run

```bash
cd apps/caemble/ui
npm install
npm run dev
```

Checks:

```bash
npm run test
npm run build
npm run lint
```

The Viewer page owns one `useCadWorkspace` and one persistent CAD Worker. The Worker caches the latest successfully compiled `Sample` and `Setup`, while each document controller preserves its last successful scene, resolved variables, selection, and error state across the existing 500 ms edit debounce. `StructureExperimentViewer` renders the left-side editors, trees, parameters, status, and `Reroll` controls. The independent `CadViewer` receives both evaluated scenes, Experiment rules, manual simulation state, and the last successful recorded tensors.

Both scenes are visible together by default. Geometry and Material Grid include Structure and Experiment toggles, and both sources can be hidden without deleting their scenes or selections. Geometry mode preserves each Material or unassigned wireframe representation. Material Grid samples Experiment before Structure, so Structure owns overlapping points. Results appears when the evaluated Experiment declares at least one recorded-data rule, even before a value arrives. On large screens, `App` owns the draggable divider between the workspace and viewer. Ctrl/Cmd-click Geometry or Surface rows to build a multi-selection; only the active document layer is highlighted when IDs overlap across sources.

```tsx
const { structureDocument, experimentDocument, simulation } = useCadWorkspace(
  structure,
  experiment,
  setStructure,
  setExperiment,
)

<StructureExperimentViewer
  activeDocumentType={activeDocumentType}
  structure={structure}
  experiment={experiment}
  structureDocument={structureDocument}
  experimentDocument={experimentDocument}
  onActiveDocumentTypeChange={setActiveDocumentType}
/>

<CadViewer
  structure={{ scene: structureDocument.scene, variables: structureDocument.variables }}
  experiment={{
    scene: experimentDocument.scene,
    variables: experimentDocument.variables,
    experimentRules: experimentDocument.experimentRules,
  }}
  recordedData={simulation.recordedData}
  simulation={{
    canRun: simulation.canRun,
    cancel: simulation.cancel,
    process: simulation.process,
    run: simulation.run,
    solver: experimentDocument.solver,
    stale: simulation.stale,
  }}
  selected={activeSelection}
  onRenderStart={handleRenderStart}
  onRenderEnd={handleRenderEnd}
  onRenderError={handleRenderError}
/>
```

## CAD Library Layout

The complete CAD subsystem lives under `src/cad`. `model` contains Material, Structure/Experiment definitions, and Sample/Setup variable objects. `evaluation` interprets CAD JSX, `execution` runs compiled user modules, and `worker` compiles and evaluates TSX away from the UI thread. Geometry algorithms live in `geometry`. Registered tags are grouped under `elements/primitives` for stand-alone solid generators and `elements/operations` for tags that derive geometry from child Geometry.

UI code uses `src/cad/index.ts` as the CAD facade. Help imports the lightweight `catalog.ts`, while the shared CAD workspace references `cad/worker/cad.worker.ts` only as a Web Worker entrypoint.

## Core Model

A Structure file default-exports a `Sample`; an Experiment file default-exports a `Setup`. Geometry and Material subclasses are defined in the editor file, and the only available module import is `@caemble/core`.

```tsx
import { Material, Sample, Structure, type Geometry, type Vec3 } from '@caemble/core'

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
  geometry: () => (
    <Conductor
      id="conductor"
      size={vars.conductorSize as Vec3}
      notchPosition={vars.notchPosition as Vec3}
      notchSize={vars.notchSize as Vec3}
      materials={[new Material('Copper', 'reference', {
        electricalConductivity: vars.electricalConductivity,
        color: '#d97706',
      })]}
    />
  ),
  varsSchema: {
    conductorSize: { shape: [3], default: [100, 12, 10] },
    notchSize: { shape: [3], default: [30, 5, 5] },
    notchPosition: { shape: [3], default: [0, 4.5, 2.5] },
    electricalConductivity: { shape: [], default: 5.96e7 },
  },
  geometryGroup: { conductor: ['conductor'] },
  surfaceGroup: {
    sourceTerminal: ['conductor/surface-1'],
    referenceTerminal: ['conductor/surface-2'],
  },
})

export default new Sample(structure)
```

The Structure example menu keeps the former procedural model as **Fiber Bundle**; **DC Conductor** is the default first item.

Evaluation order is Sample vars resolution → global `vars` binding → lazy geometry factory → Material construction → Geometry evaluation.

## Experiment And Setup

`Experiment` extends `Structure`, so it inherits `geometry`, `varsSchema`, `geometryGroup`, `surfaceGroup`, and `randomVars()`. Every Experiment requires a Solver name, version, and lazy JSON-compatible parameters factory. It also adds lazy initial-condition, boundary-condition, and recorded-data rule factories. `Sample` and `Setup` share the abstract `VariableObject` base: `sample.object === sample.structure`, and `setup.object === setup.experiment`. A plain `Sample` cannot wrap an Experiment.

```text
Structure
└─ Experiment

VariableObject<TObject>
├─ Sample → Structure
└─ Setup  → Experiment
```

Every rule contains targets, an Experiment label, a simulation-engine method ID, and solver-specific parameter data. Rule parameter values are limited to bool, string, int, float, or an explicit tensor descriptor. Functions, null, raw arrays, arbitrary nested objects, undefined, and non-finite numbers are not parameters. All three factories run with Setup values available through the same read-only global `vars` binding used by geometry.

```tsx
import {
  Experiment,
  Material,
  Setup,
  type Geometry,
  type Vec3,
} from '@caemble/core'

const Terminal: Geometry<{ size: Vec3 }> = ({ size }) => <box size={size} />

const experiment = new Experiment({
  solver: {
    name: 'dc-current-density',
    version: '1.0.0',
    parameters: () => ({
      lengthScaleToMeters: 0.001,
      conductivityVariable: 'electricalConductivity',
      gridShape: [100, 41, 41],
      crossSectionPosition: 0.35,
      relativeTolerance: 1e-8,
      maxIterations: 2000,
    }),
  },
  geometry: () => (
    <>
      <Terminal
        id="source-electrode"
        pos={[-50.5, 0, 0]}
        size={[1, 14, 12]}
        materials={[new Material('Source Electrode', { color: '#ef4444' })]}
      />
      <Terminal
        id="reference-electrode"
        pos={[50.5, 0, 0]}
        size={[1, 14, 12]}
        materials={[new Material('Reference Electrode', { color: '#2563eb' })]}
      />
    </>
  ),
  varsSchema: {
    sourceVoltage: { shape: [], default: 0.001 },
    referenceVoltage: { shape: [], default: 0 },
  },
  boundaryConditions: () => [
    {
      target: ['structure.surface.sourceTerminal'],
      label: 'Applied potential',
      methodId: 'dc.source-potential',
      parameters: { voltage: vars.sourceVoltage as number },
    },
    {
      target: ['structure.surface.referenceTerminal'],
      label: 'Reference potential',
      methodId: 'dc.reference-potential',
      parameters: { voltage: vars.referenceVoltage as number },
    },
  ],
  recordedData: () => [
    {
      target: ['structure.geometry.conductor'],
      label: 'Current density',
      methodId: 'dc.current-density',
      parameters: {},
      result: {
        type: 'tensor',
        dimension: 2,
        shape: [-1, -1],
        dtype: 'float64',
        axes: [
          { name: 'cross-section v (m)' },
          { name: 'cross-section u (m)' },
        ],
      },
    },
    {
      target: ['structure.geometry.conductor'],
      label: 'Total current',
      methodId: 'dc.total-current',
      parameters: {},
      result: { type: 'tensor', dimension: 0, shape: [], dtype: 'float64' },
    },
  ],
})

export default new Setup(experiment)
```

Each rule has a non-empty `target` array, so one method and parameter dictionary may apply to several groups. Every target uses `source.kind.group`. The source is `experiment` or `structure`, the kind is `geometry` or `surface`, and everything after the second dot is the case-sensitive group name. Therefore group names may themselves contain dots. Experiment preview validates `experiment.*` targets immediately and defers `structure.*` targets; simulation preparation then cross-validates every target against the paired, evaluated Sample, including missing group members and empty resolutions. Labels are case-sensitive and unique within each of the three rule lists; method IDs may be reused.

Raw scalar parameters may be booleans, strings, or finite numbers. Integer-valued raw numbers must be safe integers. Explicit scalar descriptors use `{ type: 'bool' | 'string' | 'int' | 'float', value }`. A tensor parameter uses `{ type: 'tensor', dimension, shape, dtype, axes?, value }`, requires `dimension >= 1`, and must have `dimension === shape.length`; every shape size is a positive safe integer. Supported element dtypes are `bool`, `string`, `int8`, `int16`, `int32`, `int64`, `uint8`, `uint16`, `uint32`, `uint64`, `float16`, `float32`, and `float64`. `int64` and `uint64` remain limited to JavaScript safe integers. Tensor values are checked recursively against both shape and dtype, copied, and frozen.

Optional `axes` contains one `{ name?, ticks? }` object per dimension. When the complete field is omitted, every fixed axis receives the 0-based name `axis 0`, `axis 1`, and so on, with ticks `[0, 1, ... shape[i] - 1]`. When supplied, the axes array length must equal `dimension`; omitted names and fixed-axis ticks receive the same defaults. Explicit names must be non-empty, and ticks must contain exactly `shape[i]` string or finite-number values. Tick order and duplicates are preserved and are independent of tensor dtype. Normalized fixed-axis metadata is copied and deeply frozen.

Every recorded-data rule additionally requires a tensor-only output schema in `result` and accepts the same optional axes metadata. A scalar recorded result is a 0D tensor: `{ type: 'tensor', dimension: 0, shape: [], dtype: 'float64' }`, normalized with `axes: []`. Recorded result shapes may use `-1` on any number of axes, for example `{ dimension: 2, shape: [-1, 3], axes: [{ name: 'time' }, { name: 'position', ticks: [0, 0.5, 1] }] }`. Tensor parameters cannot use `-1`. A wildcard axis may declare a name but must omit source ticks; its actual size and ticks are resolved from the external result, with missing ticks defaulting to 0-based indices.

`RecordedData` and its `CadViewerRecordedData` compatibility alias are JSON dictionaries keyed by the unique recorded rule label. Each value uses `{ value, axes?: [{ ticks? }, ...] }`; dtype, dimension, shape, and axis names remain authoritative in the Experiment schema. Payload axes, when supplied, have exactly one ticks-only object per dimension. Fixed ticks must equal the schema, while wildcard ticks must match the resolved value length. A successful solver response must include every declared label and no unknown labels; value dtype/shape and axes are validated and the accepted result is recursively frozen. The standalone Results renderer remains tolerant of missing snapshots so it can show empty schema-driven plots before the first run.

Results renders 0D scalars, numeric 1D Plotly line charts, numeric 2D Plotly heatmaps, and bool/string tables. For tensors above 2D, leading-axis selectors choose a slice and the final two axes form the heatmap or matrix. Results is read-only, loads Plotly only when a populated numeric plot is shown, and does not feed result errors into CAD compilation or rendering status.

Experimental Parameters displays only tensor parameters. It shows normalized axis names and complete ticks plus recorded result schemas as read-only metadata, leaving scalar, shape, dtype, axes, and result schema edits to Experiment Source. Editable values use N-dimensional JSON. Prefer a named top-level `const` array instead of writing large raw tensors inline. Inline arrays and top-level const arrays can be patched back into the complete controlled source without changing axes; computed expressions and `vars`-backed values remain visible but read-only. Editing a shared const affects every reference.

Solver `name` and `version` are trimmed, non-empty, case-sensitive strings. Its `parameters` factory runs with Setup `vars` before Experiment geometry and must return a plain JSON-compatible object. Parameters are recursively copied and frozen; strings, finite numbers, booleans, null, arrays, and plain objects are supported. Functions, `undefined`, non-finite numbers, class instances, and circular references are rejected.

Experiment evaluation order is Setup vars resolution → global `vars` binding → Solver parameters → Experiment geometry and groups → initial conditions → boundary conditions → recorded data. Experiment geometry and a paired Sample use the same coordinate system. Editing either source or pressing `Reroll` updates its preview only; simulation is always manual. Once both latest revisions are ready, use **Run Simulation** in the Viewer toolbar. The toolbar reports `idle → preparing → running → succeeded | failed | cancelled`, exposes **Cancel** while active, and keeps the Results tab where the user left it.

## Solver Controller And DC Current Density

`src/solver` is UI-independent. `SolverController.run(sample, setup)` evaluates both vars contexts, geometry, Materials, groups, solver parameters, and Experiment rules before dispatching by an exact, case-sensitive `name@version`. It permits one active run, passes an `AbortSignal` to the selected module, publishes immutable process snapshots through `getProcess()` and `subscribe()`, and validates/finalizes `RecordedData`. Duplicate module registration and unsupported identities fail explicitly. A future backend or external solver implements the same `SolverModule.solve(input, signal)` contract and may use `fetch`; no Controller or UI contract changes are required.

The default `dc-current-density@1.0.0` JavaScript module performs a browser-side 3D voxel finite-volume solve of `∇·(σ∇V) = 0`. It creates a cell-centered `[s, u, v]` grid, applies the source/reference potentials as Dirichlet conditions, treats every other exterior and notch face as insulating, and solves the symmetric system with Jacobi-preconditioned conjugate gradient. Occupancy construction and PCG periodically yield to the Worker event loop and check the supplied `AbortSignal`, so **Cancel** interrupts real work rather than only changing UI state.

The default Structure is a `[100, 12, 10] mm` copper bar with an eccentric `[30, 5, 5] mm` corner notch centered at `[0, 4.5, 2.5] mm`. `gridShape: [100, 41, 41]` and `crossSectionPosition: 0.35` sample the axial face near the notch entrance at approximately `x = -15 mm`. For the default X-aligned terminals, the solver constructs a right-handed frame with `u = Y` and `v = Z`. The signed axial `Current density` result is a float64 `41×41` heatmap in `A/m²`; its two result axes carry the actual SI-coordinate ticks in meters. Cells outside the conductor or inside the notch are zero. `Total current` is the absolute value of the signed flux integral through that same face in amperes.

This v1 heatmap contract intentionally replaces the former `[Jx, Jy, Jz]` vector schema: an Experiment still declaring the old schema fails explicitly. A uniform `[100, 5, 5] mm` verification bar at `σ = 5.96e7 S/m` and `ΔV = 1 mV` converges to `596000 A/m²` and `14.9 A`. The notched result is resolution-dependent; refine `gridShape` and compare flux/current before treating it as converged. A run is limited to 250,000 voxels and requires positive finite SI scale and conductivity, `0 < relativeTolerance < 1`, positive `maxIterations`, two distinct planar opposing terminals, and one connected homogeneous isotropic Material part. Nonconvergence, disconnected voxel domains, multiple parts, invalid terminals, extra rules, and incompatible schemas fail without publishing a new result.

Source edits and `Reroll` immediately mark an existing result **Stale** and never trigger a run. A failed or cancelled replacement keeps the last successful result with its error and stale marker. The shared Worker has no queue or run history. If a document evaluation times out, the Worker is restarted, the last scenes/results remain visible, the timed-out document becomes Error, and only the successful peer is restored automatically; retry the timed-out document by editing it or pressing `Reroll`.

## Vars

`vars` is a flat, read-only dictionary of finite numeric tensors. A scalar uses `shape: []`; arrays use fixed shapes such as `[3]` or `[3, 2]`.

- Every schema item requires `shape` and `default`.
- `min` and `max` are both omitted or both supplied.
- Bounds may be scalars broadcast to every element or tensors matching the declared shape.
- `new Sample(structure, partialVars)` fills omitted entries from defaults and rejects unknown names, invalid shapes, non-finite values, and range violations.
- `new Setup(experiment, partialVars)` applies the same rules to Experiment vars.
- `structure.randomVars(seed?)` samples each ranged element independently and uses defaults for entries without a range.

Fourier fiber coefficients are ordinary vars rather than hidden random values. A `[K, 2]` tensor can be converted to amplitude/phase modes inside a Geometry:

```tsx
const fourier = (vars.fourierModes as number[][]).map(([amplitude, phase]) => ({
  amplitude,
  phase,
}))
```

## Materials And Geometry

`Material` stores a non-empty `symbol`, an optional non-empty `version`, and a deeply read-only JSON-compatible `variables` dictionary. Supported forms are `Material(symbol)`, `Material(symbol, variables)`, `Material(symbol, version)`, and `Material(symbol, version, variables)`. A top-level `variables.color` uses `#RRGGBB`. Geometry without a Material or without `variables.color` is rendered as a neutral `#475569` wireframe instead of a filled mesh.

A Geometry inherits its parent's complete `materials` array when it omits the attribute; supplying `materials` replaces the inherited array. A primitive uses `materials[0]` when available and otherwise produces an unassigned scene part.

Different Materials may appear as sibling scene parts, and different instances may share the same symbol and version. `union` and `intersect` accept either one shared Material instance or fully unassigned operands; mixing assigned and unassigned operands is rejected. `subtract` preserves each base part's optional Material. `shell` accepts no Materials for unassigned layers, or exactly one Material per offset when Materials are provided.

Material Grid samples only Geometry with a colored Material. Unassigned Geometry remains visible in that mode as a wireframe overlay and does not mask colored Grid points.

Every user-defined Geometry invocation requires an explicit string `id`. Local IDs are case-sensitive and may contain Unicode letters, numbers, `_`, and `-`. They must be unique under their nearest Geometry parent; Fragment and intrinsic CAD tags do not create identity boundaries. Global IDs join local IDs with `.`, so `<Assembly id="assembly"><Cell id="core" /></Assembly>` produces `assembly.core`.

Final scene part and Geometry Tree selection IDs use these global paths instead of evaluator-order IDs. A Geometry with one surviving direct part uses its global ID as the part ID. Multiple direct parts use the reserved `$part-1`, `$part-2`, ... segments. Array cells insert reserved `$cell-x-y-z` segments before the repeated child ID, for example `assembly.$cell-0-1-0.particle`; `inject.id` is not supported. A primitive or operation result without a user Geometry ancestor is rejected.

Each semantic or derived surface receives `${partId}/surface-N`. Primitive surfaces use local shape semantics such as caps, sides, and axis faces. Topology-changing operations derive connected surfaces at sharp edges.

Every Geometry and CAD element accepts `pos`, axis-angle `rotate`, and `scale`. Child geometry is evaluated first, followed by local scale, rotation, and position. Fragment does not accept transforms.

## Geometry And Surface Groups

`Structure` accepts optional `geometryGroup` and `surfaceGroup` maps. A Geometry group may reference a final part ID or an intermediate Geometry global ID; an intermediate ID resolves to all currently surviving descendant parts. A Surface group references exact `${partId}/surface-N` IDs.

```tsx
const structure = new Structure({
  geometry: () => <Assembly id="assembly" />,
  varsSchema: {},
  geometryGroup: {
    body: ['assembly.frame', 'assembly.cells'],
  },
  surfaceGroup: {
    contacts: ['assembly.frame/surface-1', 'assembly.frame/surface-2'],
  },
})
```

Group names are trimmed non-empty Unicode strings. Member arrays may be empty; duplicate IDs are removed while preserving their first occurrence. The same ID may belong to multiple groups. Unknown or boolean-consumed IDs remain in the declaration and appear as `Missing` in the Geometry Tree, but do not highlight viewer geometry.

Named Geometry and Surface groups appear in separate Tree sections. A group row selects all resolved members. Expand it to inspect or remove declared members, or delete the group. Ctrl/Cmd-click selectable Geometry or Surface rows to build a same-kind draft selection; the current single selection becomes the first draft member and every drafted result is highlighted together in the viewer. Named groups contribute their declared members, including Missing IDs, without creating nested groups. A mixed-kind modified click is ignored and a normal click clears the draft. Saving into an existing group appends new unique members. Tree edits update the active default-exported `Sample`'s `Structure` object in Code Space and remain ordinary undoable Monaco edits.

`<array>` repeats exactly one direct Geometry child. `shape`, `period`, optional lattice `axes`, and `[x][y][z]`-prefixed injection tensors control each cell. Injected values replace the corresponding child props before the lattice and array transforms are applied.

## Curved Edge Cylinders

`<curvedEdgeCylinder>` creates a capped solid centered on the local origin and aligned with the z-axis. Its radial distance is the product of an azimuthal Fourier series and a vertical Taylor series:

```text
A(θ) = Σ[n=0..K-1] amplitude[n] · cos(nθ + phase[n])
V(z) = Σ[n=0..L-1] coefficient[n] · (z - origin)ⁿ
r(θ,z) = A(θ) · V(z)
```

The Fourier array index is the mode number, including mode zero. The Taylor coefficient index is the order, including its constant term. `phase` uses radians, `θ` is sampled over `[0, 2π)`, and physical local z coordinates run from `-height / 2` to `height / 2`. The Taylor `origin` may be any finite local z coordinate.

```tsx
<curvedEdgeCylinder
  height={10}
  azimuthalCurve={[
    { amplitude: 4, phase: 0 },
    { amplitude: 0.5, phase: 0.2 },
  ]}
  verticalCurve={{ origin: 1.5, coefficients: [1, 0, 0.02] }}
  azimuthalSegments={64}
  verticalSegments={32}
/>
```

`azimuthalSegments` and `verticalSegments` default to `64` and `32`. Every sampled product radius must be finite and positive. The mesh does not analyze the curve between samples or repair self-intersections, so increase the segment counts for higher Fourier modes or rapidly changing Taylor curves.

## Curved Surface Spheres

`<curvedSurfaceSphere>` creates a closed, origin-centered surface whose spherical radius is the product of azimuthal and polar Fourier series:

```text
A(θ) = Σ[n=0..K-1] azimuthalAmplitude[n] · cos(nθ + azimuthalPhase[n])
P(φ) = Σ[n=0..L-1] polarAmplitude[n] · cos(nφ + polarPhase[n])
r(θ,φ) = A(θ) · P(φ)
```

`θ` is the z-axis azimuth in `[0, 2π)`, while `φ` is the polar angle from +z in `[0, π]`. Array indices are Fourier mode numbers starting at zero, and phases use radians. Because azimuth is undefined at the poles, both single pole vertices evaluate the azimuthal curve at `θ=0`.

```tsx
<curvedSurfaceSphere
  azimuthalCurve={[
    { amplitude: 4, phase: 0 },
    { amplitude: 0.5, phase: 0.2 },
  ]}
  polarCurve={[
    { amplitude: 1, phase: 0 },
    { amplitude: 0.1, phase: 0 },
  ]}
  azimuthalSegments={64}
  polarSegments={32}
/>
```

`azimuthalSegments` and `polarSegments` default to `64` and `32`. Every sampled product radius must be finite and positive. Increase the segment counts for higher modes or rapidly changing curves.

## Procedural Fibers

`<fiber>` creates one capped circular solid around a sampled centerline. `from` and `to` are local coordinates and always remain the center points of the two end caps.

The default base curve is the straight interpolation between those points. `basePath(t)` may provide a complete curved path, but its values at `t=0` and `t=1` must match `from` and `to`. The evaluator resamples it by arc length before applying displacement.

For normalized base-curve arc length `u`, Caemble computes:

```text
theta(u) = 2π · turns · u + phase

z(u) = helixRadius(u, theta) · exp(i theta)
       - Σ[k=1..K] amplitude[k] · exp(i(2πku + phase[k]))

r(u) = c(u) + sin^p(πu) · (Re(z) N(u) - Im(z) B(u))
```

`N` and `B` come from a parallel-transport Bishop frame, so straight sections and low-curvature sections do not suffer the flips associated with a Frenet frame. `up` controls the initial frame orientation; when omitted, a stable world axis is selected automatically.

There are two intentionally different radius concepts:

- `helix.radius` is the centerline displacement from the base curve. It accepts a non-negative number or `(u, theta) => number`.
- top-level `radius` is the physical cross-section radius. It accepts a positive number or `(s) => number`, where `s` is normalized arc length along the final displaced centerline.

For example, `radius={(s) => 1.2 * (1 - 0.6 * s)}` creates a positive tapered fiber. Exact zero-radius tips are not supported.

`envelopePower` defaults to `2`, fixing displacement to zero at both endpoints. `pathSegments` defaults to `128`, while `radialSegments` defaults to `12`. Increase them for high turn counts, high Fourier modes, or tight base-curve bends.

Multiple strands are composed as ordinary Geometry with phase offsets:

```tsx
<>
  <Strand id="1" phase={0} />
  <Strand id="2" phase={(Math.PI * 2) / 3} />
  <Strand id="3" phase={(Math.PI * 4) / 3} />
</>
```

Caemble validates endpoint agreement, finite callback results, non-degenerate sampled segments, frame construction, radii, Fourier modes, and segment counts. It does not detect fiber self-intersections.

## Supported CAD Tags

### Primitives

```tsx
<box size={[20, 20, 20]} />
<cylinder radius={8} radius_2={4} height={16} segments={32} />
<curvedEdgeCylinder
  height={16}
  azimuthalCurve={[{ amplitude: 8, phase: 0 }, { amplitude: 1, phase: 0 }]}
  verticalCurve={{ origin: 0, coefficients: [1, 0, 0.005] }}
/>
<sphere radius={10} segments={32} />
<curvedSurfaceSphere
  azimuthalCurve={[{ amplitude: 8, phase: 0 }, { amplitude: 1, phase: 0 }]}
  polarCurve={[{ amplitude: 1, phase: 0 }, { amplitude: 0.1, phase: 0 }]}
/>

<fiber
  from={[0, 0, -30]}
  to={[0, 0, 30]}
  radius={(s) => 1 - 0.5 * s}
  helix={{ turns: 6, phase: 0, radius: (_u, theta) => 4 * Math.exp(0.1 * Math.cos(theta)) }}
  fourier={[{ amplitude: 0.4, phase: 1.2 }]}
/>
```

### Geometry Operations

```tsx
<union>...</union>
<subtract>base cutter</subtract>
<intersect>shapeA shapeB</intersect>

<shell offsets={[-1, 2]}>
  <Cell id="core" />
</shell>

<array
  shape={[3, 3, 3]}
  period={[10, 10, 10]}
  axes={{ x: [1, 0, 0], y: [0.5, Math.sqrt(3) / 2, 0], z: [0, 0, 1] }}
  inject={{ pos: positionTensor }}
>
  <Cell id="cell" />
</array>
```

## Current Limitations

- The Worker is not a product-grade malicious-code sandbox.
- Relative, external, and dynamic imports are not supported.
- Curved edge cylinders validate radii only at sampled mesh vertices and do not repair self-intersections.
- Curved surface spheres validate radii only at sampled mesh vertices; their poles use the azimuthal curve at `θ=0`.
- Fiber curves are sampled approximations and self-intersections are not repaired.
- Fiber cross-sections are circular and capped; open tubes, elliptical profiles, and exact zero-radius tips are not implemented.
- Server persistence, multiple editor files, generated vars controls, STL/OBJ export, and legacy data conversion are not implemented.
- General Sample/Experiment composition, mesh/cell creation or removal, geometry deformation, solver queues/history, and production solver backends are not implemented. The included DC solver is deliberately a single-prism browser mock.
- Complex booleans and high-resolution fibers can be slow depending on browser performance.


## Material override
- Structure 직접 입력값 > 동일 symbol DB 지정된 버전 데이터 > DB, 동일 symbol 항목별 다른 버전 데이터(최신순)
- 물질 symbol 은 기본적으로 화학식을 따름 (Al, Al2O3, Au, H2O, SiO2, Si)
- 물성 데이터는 여러 버전이 존재할 수 있으며, 버전명도 입력 필요 (예시 : "Kittel_1988")
- Structure 에서는 Material 의 symbol, 버전명(선택), 직접 입력값 dictionary (선택) 를 포함하는 Material 객체를 선언.
- 직접 입력값 dictionary 의 `color` 변수는 `#RRGGBB` 형식의 UI 표시 색상이며, 생략하면 UI 기본색을 사용.
- Measurement 를 Build 할 때, Experiment 에서 필요한 값들을 Structure 직접 입력값, DB 값, var 로 정의되는 Custom 물질 랜덤값 생성 등을 통해 실제 값 고정


## 제공할 기능

Structure 편집
Experiment 편집
Sample, Setup 생성
Parameter sweep
Optimization
Measurement 생성 (Simulation Run)
Single, Batch
Material 및 Parameter 관리 (Override)
Solver 및 Parameter 관리 (Override)
GP Station Slave 관리
Structure 분석 (다양한 Experiment)
Experiment 분석 (다양한 Structure)
Structure + Experiment 분석
다양한 Measurement Data 통계
데이터 기반 Prediction

inverse Design
유사 구조 Structure Code Embedding 비교
ML 모델 관리
모델은 Structure + Experiment 의존
유사한 Structure, Experiment 를 Embedding 으로 찾아서 참고하는 것은 가능
원격 ML 수행
Model Load, Save, Train, Predict
모델은 cache, 저장소는 AWS Bucket
ML 기반 Prediction 데이터 생성 및 활용

## UI 설계

다양한 독립적인 페이지를 추가할 수 있도록 Navbar 에 2단 목록 메뉴 제공
각 페이지는 기본적으로 독립적인 SPA
Dashboard
최근 Structure 목록
최근 Experiment 목록
최근 Measurement 결과 목록
Worker 목록, 상태
Solver 목록
Structure + Experiment + Measurement 통합 화면


## DB Table

- Structure
- Sample
- Experiment
- Setup
- Measurement
- MeasurementData
- Material
- MaterialParameter
- Solver
- SolverParameter
- PredictionModel
- DesignerModel
