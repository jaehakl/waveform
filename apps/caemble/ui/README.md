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
import {
  Mat,
  Material,
  Sample,
  Structure,
  type Geometry,
  type Vec3,
} from '@caemble/core'

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
  lengthUnit: 'mm',
  geometry: () => (
    <Conductor
      id="conductor"
      size={vars.conductorSize as Vec3}
      notchPosition={vars.notchPosition as Vec3}
      notchSize={vars.notchSize as Vec3}
      materials={[new Material('Copper', 'reference', {
        electricalConductivity: {
          dtype: 'float64',
          value: Mat(vars.electricalConductivity as number),
          errorRate: 0.001,
          unit: 'S.m-1',
          quantityKind: 'ElectricConductivity',
        },
        color: '#d97706',
      })]}
    />
  ),
  varsSchema: {
    conductorSize: { min: [100, 12, 10], max: [100, 12, 10] },
    notchSize: { min: [20, 4, 5], max: [40, 6, 7] },
    notchPosition: { min: [-10, 4, 2.5], max: [10, 5, 3.5] },
    electricalConductivity: { min: 5.96e7, max: 5.96e7 },
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

Every Structure, including Experiment, declares a required UCUM `lengthUnit`. Geometry operations and the resulting `CadScene` keep coordinates in that authoring unit. The Viewer chooses the Structure unit as its display unit (falling back to the Experiment unit) and scales copied layers immediately before rendering and Material Grid sampling; source scenes are not mutated.

Evaluation order is Sample vars resolution → global `vars` binding → lazy geometry factory → Material construction → Geometry evaluation.

## Experiment And Setup

`Experiment` extends `Structure`, so it inherits `geometry`, `varsSchema`, `geometryGroup`, `surfaceGroup`, and `randomVars()`. Every Experiment requires a Solver name, version, and lazy JSON-compatible parameters factory. It also adds lazy initialization, boundary-condition, and recorded-data rule factories. `Sample` and `Setup` share the abstract `VariableObject` base: `sample.object === sample.structure`, and `setup.object === setup.experiment`. A plain `Sample` cannot wrap an Experiment.

```text
Structure
└─ Experiment

VariableObject<TObject>
├─ Sample → Structure
└─ Setup  → Experiment
```

Every rule contains targets, an Experiment label, a simulation-engine method ID, and solver-specific parameter data. A parameter leaf is a raw boolean, string, or safe integer shorthand, or an explicit `{ dtype, value, axes?, ... }` descriptor. Functions, null, raw arrays, arbitrary nested objects, undefined, and non-finite numbers are not parameter leaves. All three factories run with Setup values available through the same read-only global `vars` binding used by geometry.

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
  lengthUnit: 'mm',
  solver: {
    name: 'dc-current-density',
    version: '2.0.0',
    parameters: () => ({
      relativeTolerance: {
        dtype: 'float64', value: 1e-8,
        unit: '{fraction}', quantityKind: 'DimensionlessRatio',
      },
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
    sourceVoltage: { min: 1, max: 1 },
    referenceVoltage: { min: 0, max: 0 },
  },
  initializations: () => [
    {
      target: ['structure.geometry.conductor'],
      label: 'Voxel grid',
      methodId: 'dc.voxel-grid',
      parameters: {
        gridShape: {
          dtype: 'int32',
          axes: [{ length: 3 }],
          value: [100, 41, 41],
        },
      },
    },
  ],
  boundaryConditions: () => [
    {
      target: ['structure.surface.sourceTerminal'],
      label: 'Applied potential',
      methodId: 'dc.source-potential',
      parameters: {
        voltage: {
          dtype: 'float64', value: vars.sourceVoltage as number,
          unit: 'mV', quantityKind: 'Voltage',
        },
      },
    },
    {
      target: ['structure.surface.referenceTerminal'],
      label: 'Reference potential',
      methodId: 'dc.reference-potential',
      parameters: {
        voltage: {
          dtype: 'float64', value: vars.referenceVoltage as number,
          unit: 'mV', quantityKind: 'Voltage',
        },
      },
    },
  ],
  recordedData: () => [
    {
      target: ['structure.geometry.conductor'],
      label: 'Current density',
      methodId: 'dc.current-density',
      parameters: {
        crossSectionPosition: {
          dtype: 'float64', value: 0.35,
          unit: '{fraction}', quantityKind: 'DimensionlessRatio',
        },
      },
      result: {
        dtype: 'float64',
        unit: 'A.m-2',
        quantityKind: 'ElectricCurrentDensity',
        axes: [
          { name: 'cross-section v', unit: 'm', quantityKind: 'Length' },
          { name: 'cross-section u', unit: 'm', quantityKind: 'Length' },
        ],
      },
    },
    {
      target: ['structure.geometry.conductor'],
      label: 'Total current',
      methodId: 'dc.total-current',
      parameters: {
        crossSectionPosition: {
          dtype: 'float64', value: 0.35,
          unit: '{fraction}', quantityKind: 'DimensionlessRatio',
        },
      },
      result: {
        dtype: 'float64',
        unit: 'A', quantityKind: 'ElectricCurrent',
      },
    },
  ],
})

export default new Setup(experiment)
```

### UCUM units

Physical units use case-sensitive [UCUM](https://ucum.org/docs/formal-grammar) codes. UCUM does not publish one authoritative regular expression for its full grammar, so Caemble validates codes and conversions with the browser-compatible [@fhir-toolkit/ucum](https://github.com/robertoAraneda/fhir-toolkit/tree/main/packages/ucum) parser. Source strings are preserved exactly: empty strings, surrounding whitespace, invalid codes, wrong case, and incompatible conversions raise `CadModelError`. Quantity-bearing model values use exact QUDT applicable spellings such as `A.m-2`, `S.m-1`, `mV`, `mm`, and `{fraction}`.

An explicit physical value uses `{ dtype: 'float16' | 'float32' | 'float64', value, unit, quantityKind, basis? }`. Raw numbers in Material variables, solver parameters, and rule parameters are reserved for safe integers. Fractions, tolerances, ratios, and physical values—including physical zero—use a float descriptor; dimensionless ratios explicitly use `{fraction}` and `DimensionlessRatio`.

A Material float descriptor additionally requires `errorRate`, while retaining required `unit` and `quantityKind`. `errorRate` is a unitless ratio in `[0, 1)`, so `0.001` means `0.1%`; even a deterministic value must state `errorRate: 0`. Each Sample and Setup applies one uniform multiplier to the descriptor's complete value, preserving exact zeros, isotropy, and component ratios. The Material retains its nominal descriptor, while evaluated scene and solver variables contain the realized value without `errorRate`.

`varsSchema` and its resolved `vars` payload deliberately remain unitless intermediate data. All 1,219 QUDT 3.4 Quantity Kinds have an explicit Caemble tensor-order contract: order 0 has component shape `[]`, order 1 `[3]`, order 2 `[3,3]`, and order n `[3]^n`. Runtime inference and bare-scalar fallback are absent. Every float descriptor declares `unit` and `quantityKind`; order-1 and higher quantities accept an optional finite, orthonormal, right-handed `CartesianBasis` and default an omitted basis to the identity Cartesian basis, while scalar quantities forbid `basis`. Non-float descriptors reject all quantity metadata. Unit conversion recurses over every component, and tensor quantities accept only zero-preserving linear conversions.

`Mat(diagonal, offDiagonal = 0, size = 3)` creates a deeply frozen square matrix. For example, `Mat(a)` returns `[[a,0,0],[0,a,0],[0,0,a]]`, `Mat(a, b)` fills every off-diagonal component with `b`, and `Mat(a, b, 2)` returns `[[a,b],[b,a]]`. TypeScript has positional rather than named arguments, so a 2×2 diagonal matrix is written as `Mat(a, 0, 2)`. `Mat` does not bypass Quantity Kind shape validation: an order-2 Quantity still requires its `[3,3]` component shape, while a bare scalar remains invalid.

Each rule has a non-empty `target` array, so one method and parameter dictionary may apply to several groups. Every target uses `source.kind.group`. The source is `experiment` or `structure`, the kind is `geometry` or `surface`, and everything after the second dot is the case-sensitive group name. Therefore group names may themselves contain dots. Experiment-local contracts are checked as soon as that document evaluates; when the paired Structure is ready, common solver-spec preflight resolves Structure targets and Material roles before Run. Labels are case-sensitive and unique within each of the three rule lists.

Raw scalar parameters may be booleans, strings, or safe integers. Every explicit value uses `{ dtype, value, axes?, unit?, quantityKind?, basis? }`. Supported dtypes are `bool`, `string`, signed/unsigned 8/16/32/64-bit integers, and float16/32/64. Omitting `axes` means one Quantity value. Providing a non-empty `axes` array means Quantity values are arranged along those axes; each fixed axis requires a positive safe-integer `length`. The recursive value shape is exactly the axis lengths followed by `componentShape(quantityKind)`. Thus a single vector has no `axes` and stores `[x,y,z]`, while three scalar integers use `axes: [{ length: 3 }]` and store `[a,b,c]`. Multiple order-2 values can use an axes-shaped collection such as `[Mat(a), Mat(b)]`. `axes: []` is rejected.

Each fixed axis uses `{ length, name?, ticks?, unit?, quantityKind? }`. `ticks.length` must equal `length`; omitted names become `axis 0`, `axis 1`, and so on, and omitted ticks become zero-based indices. Component indices are not included in `axes`; their coordinate system is declared by `basis`. Unit-bearing axes use scalar Quantity Kinds. The obsolete `type`, `shape`, `dimension`, `sampleDimension`, `sampleShape`, and `sampleAxes` fields are rejected with migration errors.

Every recorded-data rule additionally requires an output schema in `result`. A scalar physical result is `{ dtype: 'float64', unit: 'A', quantityKind: 'ElectricCurrent' }`. RecordedData result axes alone may omit `length` to declare a dynamic axis; such an axis may declare a name and scalar unit metadata but must omit source ticks. The actual positive length is inferred from the payload and included on normalized axes.

`RecordedData` is a JSON dictionary keyed by recorded rule label. Each value uses `{ value, axes?: [{ ticks? }, ...] }`. A successful solver response must include every declared label and no unknown labels; axis lengths, component shape, dtype, and axes are validated and recursively frozen. No v1 adapter or automatic reshaping is provided.

Results treats declared `axes` and physical component indices separately. Vector values default to Euclidean norm and general tensors to Frobenius norm after display-unit conversion; a component selector exposes every index, labeled `x/y/z` for identity basis and `b0/b1/b2` otherwise. Leading-axis selectors choose a slice and the final two axes form the plot.

Experimental Parameters displays `dtype` and axis length/ticks separately from Quantity tensor order, component shape, and basis. Schema edits stay in Experiment Source; editable descriptor values use complete axes-plus-component JSON.

Solver `name` and `version` are trimmed, non-empty, case-sensitive strings. Its `parameters` factory runs with Setup `vars` before Experiment geometry and must return a plain object whose leaves follow the same scalar-or-descriptor contract. Raw arrays, nested arbitrary objects, null, functions, `undefined`, non-finite numbers, raw fractional numbers, class instances, and circular references are rejected.

Experiment evaluation order is Setup vars resolution → global `vars` binding → Solver parameters → Experiment geometry and groups → initializations → boundary conditions → recorded data. Each scene retains its own declared length unit; the Viewer aligns copied layers for display, while solver modules explicitly convert inputs to the units they require. A Sample or Setup keeps one private Material realization across preview and Solver preparation. Editing either source or pressing `Reroll` creates a new instance and new realization, updates its preview only, and never runs the simulation automatically. Once both latest revisions are ready and common spec preflight succeeds, use **Run Simulation** in the Viewer toolbar. Spec errors retain successful previews, appear in the relevant document footer, and disable Run. The **Solver Spec** tab renders the selected solver's complete external contract. The toolbar reports `idle → preparing → running → succeeded | failed | cancelled`, exposes **Cancel** while active, and keeps the Results tab where the user left it.

## Solver Controller And DC Current Density

`src/solver` is UI-independent. Every folder-based module exposes `{ spec, solve }`; `spec` is a serializable `SolverSpec` and is the single source for Worker preflight, controller defense-in-depth, and the generic Solver Spec UI. `SolverController.run(sample, setup)` evaluates both vars contexts, geometry, Materials, groups, solver parameters, and Experiment rules before dispatching by an exact, case-sensitive `name@version`. It permits one active run, passes an `AbortSignal` to the selected module, publishes immutable process snapshots, and validates/finalizes `RecordedData`. Required declared parameter keys are validated, while undeclared Solver, method, and Material parameter keys are preserved for cross-version compatibility. See [`src/solver/README.md`](src/solver/README.md) for the module template and checklist.

The default `dc-current-density@2.0.0` module performs a browser-side voxel finite-volume solve of `∇·(σ∇V) = 0`. Its fixed Material key `electricalConductivity` is an identity-basis `[3,3]` tensor. v2 accepts only positive isotropic `σI`: diagonal components must agree within relative `1e-12`, and off-diagonal components must be at most `1e-12` of the same scale. It does not rotate or transform bases automatically.

The default conductivity is `5.96e7 I S.m-1` with one `errorRate` multiplier shared by the whole matrix. Current density is declared with two dynamic axes, component shape `[3]`, and identity basis; payload values are `[v][u][3]` global components. The norm reproduces the former scalar heatmap magnitude, while `Total current` preserves the existing absolute flux integral.

This is a strict breaking migration: bare scalar conductivity/current-density values and legacy tensor fields fail explicitly, and no v1 module is registered alongside v2. Isotropic conductivity may use `Mat(σ)`. A uniform verification bar still converges to `596000 A/m²` and `14.9 A`.

Source edits and `Reroll` immediately mark an existing result **Stale** and never trigger a run. A failed or cancelled replacement keeps the last successful result with its error and stale marker. The shared Worker has no queue or run history. If a document evaluation times out, the Worker is restarted, the last scenes/results remain visible, the timed-out document becomes Error, and only the successful peer is restored automatically; retry the timed-out document by editing it or pressing `Reroll`.

## Vars

`vars` is a flat, read-only dictionary of finite numeric tensors. Every schema item requires `min` and `max`; no `shape` or `default` is declared.

- Two scalar bounds define a scalar var. If either bound is a tensor, its rectangular shape is inferred and an opposite scalar bound broadcasts to every element.
- Two tensor bounds must have identical shapes. Equal min/max leaves are fixed values.
- `new Sample(structure, partialVars)` and `new Setup(experiment, partialVars)` independently sample every omitted entry on construction, then apply and validate explicit partial values.
- Initial document evaluation, source edits, and `Reroll` each construct a new Sample or Setup and therefore produce a new realization.
- `structure.randomVars(seed?)` samples each non-fixed element independently and deterministically when a seed is supplied.

Fourier fiber coefficients are ordinary vars rather than hidden random values. A `[K, 2]` tensor can be converted to amplitude/phase modes inside a Geometry:

```tsx
const fourier = (vars.fourierModes as number[][]).map(([amplitude, phase]) => ({
  amplitude,
  phase,
}))
```

## Materials And Geometry

`Material` stores a non-empty `symbol`, an optional non-empty `version`, and a deeply read-only variables dictionary. Supported forms are `Material(symbol)`, `Material(symbol, variables)`, `Material(symbol, version)`, and `Material(symbol, version, variables)`. Each variable is a raw boolean/string/safe integer, a strict dtype descriptor, or—only for top-level `variables.color`—`#RRGGBB`; raw arrays, nested arbitrary objects, and null are rejected. Every float descriptor must include `errorRate`; omission is a model error rather than an implicit zero. Geometry without a Material or without `variables.color` is rendered as a neutral `#475569` wireframe instead of a filled mesh.

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


## Material 에 관하여
- Material parameter 들의 오차는 반드시 존재한다. 
이유는,
(1) Material Parameter 자체가 모델에 기반한 것으로, 모델 자체가 Approximation 이며
(2) Material Parameter 의 문헌값에도 오차가 있을 수 있고,
(3) 실제 샘플 물질의 순도가 완벽하지 않기 때문이다.

- 적절한 Material 의 활용 방법은,
(1) 잘 모를 땐 문헌값에 충분한 오차범위를 설정하고 시뮬레이션을 한다.
(2) calibration, 물질 순도를 높이거나 적어도 공정 균일성을 높여가면서 parameter 를 수정하고 오차범위를 줄여나간다.


Material
- id
- user_id nullable
- standard_inchi nullable (Standard InChI)
- description

MaterialName (IUPAC name)
- id
- user_id nullable
- material_id
- name
- normalized_name

  UNIQUE:
  - public: normalized_name
  - private: user_id + normalized_name

  Public 이름
    전체 시스템에서 유일

  Private 이름
    해당 사용자 안에서 유일

  Public과 Private 이름이 같을 때
    해당 사용자의 Private 이름을 우선

QuantityKind (QUDT 기반)
- id
- name
- unit (UCUM)
- description

MaterialData
- id
- user_id nullable
- material_id
- quantity_kind_id
- value
- description

사용자 private Material Name을 먼저 조회하고, 존재하지 않을 경우 public Material Name을 조회한다. 조회된 Material UUID를 기준으로 solver에 필요한 MaterialData를 구성한다.


## Solver API
- solver id
- 요구하는 QuantityKind
- solver parameters 및 default 값들
- initialization method id
- boundaryConditions method id
- recordedData method id
