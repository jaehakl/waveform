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

## Core Model

```tsx
import { Material, Sample, Structure } from '@caemble/core'

class Dielectric extends Material {
  toSolverModel() {
    return this.vars
  }

  validateKK() {
    return []
  }
}

function Core({ materials }: { materials?: Material[] }) {
  return <box size={[vars.width, 10, 2]} />
}

function Device({ materials }: { materials: Material[] }) {
  return (
    <>
      <Core materials={[materials[0]]} />
      <translate z={4}>
        <Core materials={[materials[1]]} />
      </translate>
    </>
  )
}

const structure = new Structure({
  geometry: () => (
    <Device
      materials={[
        new Dielectric('Core', { epsilon: vars.coreEpsilon }, '#2563eb'),
        new Dielectric('Cladding', { epsilon: 2.1 }, '#f59e0b'),
      ]}
    />
  ),
  varsSchema: {
    width: { shape: [], default: 20, min: 10, max: 30 },
    coreEpsilon: { shape: [], default: 12, min: 10, max: 14 },
    offset: {
      shape: [3],
      default: [0, 0, 0],
      min: -2,
      max: 2,
    },
  },
})

export default new Sample(structure)
```

The only executable entrypoint is a default-exported `Sample`. Geometry and Material subclasses are defined in the same editor file. The only available module import is `@caemble/core`.

## Vars

`vars` is a flat, read-only dictionary of finite numeric tensors. A scalar uses `shape: []`; arrays use fixed shapes such as `[3]` or `[2, 2]`.

- Every schema item requires `shape` and `default`.
- `min` and `max` are both omitted or both supplied.
- Bounds may be scalars broadcast to every element or tensors matching the declared shape.
- `new Sample(structure, partialVars)` fills omitted entries from defaults and rejects unknown names, invalid shapes, non-finite values, and range violations.
- `structure.randomVars(seed?)` samples each ranged element independently and uses defaults for entries without a range.
- A numeric seed produces reproducible values. Omitting it produces a new result on every call.

```tsx
export default new Sample(structure, structure.randomVars(260713))
```

Evaluation order is fixed: Sample vars resolution → global `vars` binding → lazy geometry factory → Material construction → Geometry evaluation.

## Materials And Geometry

`Material(name, vars, displayColor?)` stores a read-only tensor dictionary. The color uses `#RRGGBB` and is shown in the viewer legend. Subclasses may add freely named transform and validation methods; Caemble does not invoke them automatically.

Geometry functions are ordinary same-file TSX functions:

- A Geometry inherits its parent's complete `materials` array when it omits the attribute.
- Supplying `materials` replaces the complete inherited array.
- Primitives created directly by a Geometry use `materials[0]`.
- Different Materials may appear as sibling scene parts and may share transforms.
- `union`, `subtract`, and `intersect` reject operands with different Material instances.
- Reusing one Material instance is allowed. Different instances cannot share the same Material name.

## Supported CAD Tags

```tsx
<box size={[20, 20, 20]} />
<cylinder radius={8} height={16} segments={32} />
<sphere radius={10} segments={32} />

<translate offset={[0, 0, 8]}>...</translate>
<rotate angles={[0, 0, Math.PI / 4]}>...</rotate>
<scale factors={[1, 2, 1]}>...</scale>

<union>...</union>
<subtract>...</subtract>
<intersect>...</intersect>
```

TSX creates a lazy CAD node tree. Geometry functions run only after Sample vars are available, and the Worker converts the evaluated parts to JSCAD solids.

## Current Limitations

- The Worker is not a product-grade malicious-code sandbox.
- Relative, external, and dynamic imports are not supported.
- Concrete physical transforms and validators such as K-K, Drude, and Lorentz models are not built in yet.
- Server persistence, multiple editor files, generated vars controls, and legacy data conversion are not implemented.
- STL/OBJ export is not implemented.
- Complex boolean models can be slow depending on browser performance.

## Plan 260713

- Material: 다양한 물리 변수(유전율, 밀도 등)를 `vars`로 받고, 모델식별 transform 및 K-K relation 등의 검증 method를 subclass에서 확장할 수 있는 class
- Geometry: 다른 Geometry 코드에서 SubGeometry로 사용할 수 있으며, `materials`가 없으면 상위 Geometry 배열을 상속
- Geometry의 Material 입력: 배열로 전달하여 (`[material_0, material_1, ...]`) 하위 Geometry에 다양한 Material 조합을 입력
- Structure: 지연 실행되는 최상위 Geometry와 `varsSchema` 정의
- vars: tensor(0d, 1d, 2d, 3d, ...)의 flattened dictionary (`{a: 1, b: [2, 3], c: [[4, 5], [6, 7]]}`)
- Sample: Structure + vars
