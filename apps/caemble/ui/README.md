# Caemble

Browser-only Structure/Sample and Experiment/Setup modeling workspace. Write either model as TSX, resolve its vars, and render its material-aware CAD scene in the 3D viewer.

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

The Viewer page keeps Structure and Experiment execution in `App`. Both documents compile in parallel after the existing 500 ms edit debounce, even when their source tab is not active, and each controller preserves its last successful scene, resolved variables, selection, and error state. `StructureExperimentViewer` renders only the left-side editors, trees, parameters, status, and `Reroll` controls. The independent `CadViewer` receives the two evaluated scenes, resolved variables, and active-document selection as external data.

Both scenes are visible together by default. The existing Geometry/Material Grid toolbar includes Structure and Experiment toggles, and both sources can be hidden without deleting their scenes or selections. Geometry mode preserves each Material or unassigned wireframe representation. Material Grid samples Experiment before Structure, so Structure owns overlapping points. On large screens, `App` owns the draggable divider between the workspace and viewer. Ctrl/Cmd-click Geometry or Surface rows to build a multi-selection; only the active document layer is highlighted when IDs overlap across sources.

```tsx
const structureDocument = useCadDocument(structure, 'structure', true, setStructure)
const experimentDocument = useCadDocument(experiment, 'experiment', true, setExperiment)

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
  experiment={{ scene: experimentDocument.scene, variables: experimentDocument.variables }}
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
import { Material, Sample, Structure, type Geometry } from '@caemble/core'

const Device: Geometry<{ materials: Material[] }> = () => (
  <fiber
    from={[0, 0, -40]}
    to={[0, 0, 40]}
    radius={(s) => 1.4 - s}
    helix={{ turns: 8, radius: 5 }}
    fourier={[
      { amplitude: 0.7, phase: 0.2 },
      { amplitude: 0.3, phase: 1.4 },
    ]}
  />
)

const structure = new Structure({
  geometry: () => (
    <Device
      id="device"
      materials={[new Material('Fiber', { density: vars.density, color: '#7c3aed' })]}
    />
  ),
  varsSchema: {
    density: { shape: [], default: 1.18 },
  },
  geometryGroup: {
    body: ['device'],
  },
  surfaceGroup: {
    contacts: ['device/surface-1'],
  },
})

export default new Sample(structure)
```

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
  type ExperimentTensorParameter,
  type Geometry,
  type Vec3,
} from '@caemble/core'

type InitialConditionParameters = {
  initialValue: number
  initialProfile: ExperimentTensorParameter
}
type BoundaryConditionParameters = { value: number }
type RecordedDataParameters = { interval: number }

const Domain: Geometry<{ size: Vec3 }> = ({ size }) => <box size={size} />
const initialProfileData = [
  [0.1, 0.2, 0.3],
  [0.4, 0.5, 0.6],
] as const

const experiment = new Experiment<
  InitialConditionParameters,
  BoundaryConditionParameters,
  RecordedDataParameters
>({
  solver: {
    name: 'generic-field-solver',
    version: '1.0.0',
    parameters: () => ({
      timeStep: vars.timeStep as number,
      iterations: 100,
    }),
  },
  geometry: () => (
    <Domain
      id="domain"
      size={vars.domainSize as Vec3}
      materials={[new Material('Domain', { color: '#0ea5e9' })]}
    />
  ),
  varsSchema: {
    domainSize: { shape: [3], default: [36, 24, 18] },
    timeStep: { shape: [], default: 0.01 },
    initialValue: { shape: [], default: 0.25 },
    amplitude: { shape: [], default: 0.2 },
    recordInterval: { shape: [], default: 10 },
  },
  geometryGroup: { domain: ['domain'] },
  surfaceGroup: { outerBoundary: ['domain/surface-1'] },
  initialConditions: () => [{
    target: ['experiment.geometry.domain', 'structure.geometry.sample'],
    label: 'Initial field',
    methodId: 'field.initialize',
    parameters: {
      initialValue: vars.initialValue as number,
      initialProfile: {
        type: 'tensor',
        dimension: 2,
        shape: [2, 3],
        dtype: 'float32',
        value: initialProfileData,
      },
    },
  }],
  boundaryConditions: () => [{
    target: ['structure.surface.sampleBoundary'],
    label: 'Sample boundary',
    methodId: 'field.sample-boundary',
    parameters: { value: vars.amplitude as number },
  }],
  recordedData: () => [{
    target: ['experiment.geometry.domain'],
    label: 'Domain average',
    methodId: 'field.average',
    parameters: { interval: vars.recordInterval as number },
    result: { type: 'tensor', dimension: 0, shape: [], dtype: 'float64' },
  }],
})

export default new Setup(experiment)
```

Each rule has a non-empty `target` array, so one method and parameter dictionary may apply to several groups. Every target uses `source.kind.group`. The source is `experiment` or `structure`, the kind is `geometry` or `surface`, and everything after the second dot is the case-sensitive group name. Therefore group names may themselves contain dots. `experiment.*` targets must reference groups declared by the Experiment. `structure.*` targets reserve names for a future Sample without coupling this Experiment to a particular Structure. Labels are case-sensitive and unique within each of the three rule lists; method IDs may be reused.

Raw scalar parameters may be booleans, strings, or finite numbers. Integer-valued raw numbers must be safe integers. Explicit scalar descriptors use `{ type: 'bool' | 'string' | 'int' | 'float', value }`. A tensor parameter uses `{ type: 'tensor', dimension, shape, dtype, value }`, requires `dimension >= 1`, and must have `dimension === shape.length`; every shape size is a positive safe integer. Supported element dtypes are `bool`, `string`, `int8`, `int16`, `int32`, `int64`, `uint8`, `uint16`, `uint32`, `uint64`, `float16`, `float32`, and `float64`. `int64` and `uint64` remain limited to JavaScript safe integers. Tensor values are checked recursively against both shape and dtype, copied, and frozen.

Every recorded-data rule additionally requires a tensor-only output schema in `result`. A scalar recorded result is a 0D tensor: `{ type: 'tensor', dimension: 0, shape: [], dtype: 'float64' }`. This schema describes future solver output only; the component does not accept result values and has no Result tab or result visualization.

Experimental Parameters displays only tensor parameters. It shows recorded result schemas as read-only metadata and leaves scalar, tensor schema, dtype, and result schema edits to Experiment Source. Editable values use N-dimensional JSON. Prefer a top-level `const` array, as in `initialProfileData`, instead of writing large raw tensors inline. Inline arrays and top-level const arrays can be patched back into the complete controlled source; computed expressions and `vars`-backed values remain visible but read-only. Editing a shared const affects every reference.

Solver `name` and `version` are trimmed, non-empty, case-sensitive strings. Its `parameters` factory runs with Setup `vars` before Experiment geometry and must return a plain JSON-compatible object. Parameters are recursively copied and frozen; strings, finite numbers, booleans, null, arrays, and plain objects are supported. Functions, `undefined`, non-finite numbers, class instances, and circular references are rejected.

Experiment evaluation order is Setup vars resolution → global `vars` binding → Solver parameters → Experiment geometry and groups → initial conditions → boundary conditions → recorded data. Experiment geometry and a paired Sample are assumed to use the same coordinate system. The standalone editor previews and validates only Experiment geometry, Solver parameters, and rules; it does not load or run a solver. A cell is a solver-defined calculation unit associated with geometry, such as a mesh element, ray, rigid body, or particle. Solvers may later create or remove cells, deform geometry, and interpret vars as initial state.

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
- Sample/Experiment composition, cell creation or removal, geometry deformation, and solver execution are not implemented.
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
