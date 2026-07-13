# Caemble

Browser-only Material–Geometry–Structure–Sample modeling workspace. Write a Structure as TSX, resolve one Sample's `vars`, and render its material-aware CAD scene in the 3D viewer.

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

The Workspace auto-runs 500 ms after an edit. `Reroll` executes unchanged source immediately, so a Sample built from seedless `structure.randomVars()` can generate another model.

## CAD Library Layout

The complete CAD subsystem lives under `src/cad`. `model` contains Material–Structure–Sample state, `evaluation` interprets CAD JSX, `execution` runs compiled user modules, and `worker` compiles and evaluates TSX away from the UI thread. Geometry algorithms and registered tags live in `geometry` and `elements` respectively.

UI code uses `src/cad/index.ts` as the CAD facade. Syntax Help imports the lightweight `catalog.ts`, while App references `cad/worker/cad.worker.ts` only as a Web Worker entrypoint.

## Core Model

The only executable entrypoint is a default-exported `Sample`. Geometry and Material subclasses are defined in the editor file, and the only available module import is `@caemble/core`.

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
    <Device materials={[new Material('Fiber', { density: vars.density }, '#7c3aed')]} />
  ),
  varsSchema: {
    density: { shape: [], default: 1.18 },
  },
})

export default new Sample(structure)
```

Evaluation order is Sample vars resolution → global `vars` binding → lazy geometry factory → Material construction → Geometry evaluation.

## Vars

`vars` is a flat, read-only dictionary of finite numeric tensors. A scalar uses `shape: []`; arrays use fixed shapes such as `[3]` or `[3, 2]`.

- Every schema item requires `shape` and `default`.
- `min` and `max` are both omitted or both supplied.
- Bounds may be scalars broadcast to every element or tensors matching the declared shape.
- `new Sample(structure, partialVars)` fills omitted entries from defaults and rejects unknown names, invalid shapes, non-finite values, and range violations.
- `structure.randomVars(seed?)` samples each ranged element independently and uses defaults for entries without a range.

Fourier fiber coefficients are ordinary vars rather than hidden random values. A `[K, 2]` tensor can be converted to amplitude/phase modes inside a Geometry:

```tsx
const fourier = (vars.fourierModes as number[][]).map(([amplitude, phase]) => ({
  amplitude,
  phase,
}))
```

## Materials And Geometry

`Material(name, vars, displayColor?)` stores a read-only tensor dictionary. A Geometry inherits its parent's complete `materials` array when it omits the attribute; supplying `materials` replaces the inherited array. A primitive uses `materials[0]`.

Different Materials may appear as sibling scene parts. `union`, `subtract`, and `intersect` require all operands to use the same Material instance. Different instances cannot share one Material name.

Every Geometry and CAD element accepts `pos`, axis-angle `rotate`, and `scale`. Child geometry is evaluated first, followed by local scale, rotation, and position. Fragment does not accept transforms.

`<array>` repeats exactly one direct Geometry child. `shape`, `period`, optional lattice `axes`, and `[x][y][z]`-prefixed injection tensors control each cell. Injected values replace the corresponding child props before the lattice and array transforms are applied.

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
  <Strand phase={0} />
  <Strand phase={(Math.PI * 2) / 3} />
  <Strand phase={(Math.PI * 4) / 3} />
</>
```

Caemble validates endpoint agreement, finite callback results, non-degenerate sampled segments, frame construction, radii, Fourier modes, and segment counts. It does not detect fiber self-intersections.

## Supported CAD Tags

```tsx
<box size={[20, 20, 20]} />
<cylinder radius={8} height={16} segments={32} />
<sphere radius={10} segments={32} />

<fiber
  from={[0, 0, -30]}
  to={[0, 0, 30]}
  radius={(s) => 1 - 0.5 * s}
  helix={{ turns: 6, phase: 0, radius: (_u, theta) => 4 * Math.exp(0.1 * Math.cos(theta)) }}
  fourier={[{ amplitude: 0.4, phase: 1.2 }]}
/>

<union>...</union>
<subtract>base cutter</subtract>
<intersect>shapeA shapeB</intersect>

<array
  shape={[3, 3, 3]}
  period={[10, 10, 10]}
  axes={{ x: [1, 0, 0], y: [0.5, Math.sqrt(3) / 2, 0], z: [0, 0, 1] }}
  inject={{ pos: positionTensor }}
>
  <Cell />
</array>
```

## Current Limitations

- The Worker is not a product-grade malicious-code sandbox.
- Relative, external, and dynamic imports are not supported.
- Fiber curves are sampled approximations and self-intersections are not repaired.
- Fiber cross-sections are circular and capped; open tubes, elliptical profiles, and exact zero-radius tips are not implemented.
- Server persistence, multiple editor files, generated vars controls, STL/OBJ export, and legacy data conversion are not implemented.
- Complex booleans and high-resolution fibers can be slow depending on browser performance.


##### Curved Edge Slab
- 