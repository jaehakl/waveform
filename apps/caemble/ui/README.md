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

The Workspace keeps its 500 ms auto-run after code edits. Use the `Reroll` button to execute the unchanged source immediately and generate a new structure when the Sample uses seedless random vars. The button is disabled while compilation or rendering is active.

## Core Model

```tsx
import {
  Material,
  Sample,
  Structure,
  type Geometry,
  type Vec3,
} from '@caemble/core'

class Dielectric extends Material {
  toSolverModel() {
    return this.vars
  }

  validateKK() {
    return []
  }
}

const Core: Geometry<{ size: Vec3; holeRadius: number }> = ({ size, holeRadius }) => (
  <union>
    <subtract>
      <box size={size} />
      <cylinder pos={[-size[0] / 4, 0, 0]} radius={holeRadius} height={size[2] * 2} />
    </subtract>

    <intersect pos={[size[0] / 4, 0, size[2] / 2 + 1]}>
      <sphere radius={Math.max(size[1] / 3, holeRadius * 2)} />
      <box size={[size[1] / 2, size[1] / 2, size[2] + 2]} />
    </intersect>
  </union>
)

const Cladding: Geometry<{ size: Vec3 }> = ({ size }) => <box size={size} />

const zeroRotationTensor = [
  [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
  [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
  [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
] as const

const Device: Geometry<{
  materials: Material[]
  gap: number
  profileScale: number
  twistRatio: number
}> = ({
  materials,
  pos = [0, 0, 0],
  rotate,
  scale = [1, 1, 1],
  gap,
  profileScale,
  twistRatio,
}) => {
  const localGap = gap + Math.hypot(...pos) * 0.05
  const baseSize = [vars.width, 12 * scale[1], 3 * scale[2]] as const
  const baseHoleRadius = 2 * profileScale
  const latticePeriod = Math.hypot(...baseSize) + localGap
  const layerPeriod = Math.sqrt(2 / 3) * latticePeriod
  const hcpOffset = [latticePeriod / 2, (Math.sqrt(3) * latticePeriod) / 6, 0] as const
  const layerOffsets = [
    [-hcpOffset[0] / 3, -hcpOffset[1] / 3, 0],
    [(hcpOffset[0] * 2) / 3, (hcpOffset[1] * 2) / 3, 0],
    [-hcpOffset[0] / 3, -hcpOffset[1] / 3, 0],
  ] as const
  const azimuthTensor = vars.rotationAzimuth as number[][][]
  const cosPolarTensor = vars.rotationCosPolar as number[][][]
  const angleTensor = vars.rotationAngle as number[][][]
  const baseTwist = (rotate?.angle ?? 0) * twistRatio
  const rotateAxisTensor = azimuthTensor.map((plane, x) =>
    plane.map((row, y) =>
      row.map((azimuth, z) => {
        const cosPolar = cosPolarTensor[x][y][z]
        const radial = Math.sqrt(Math.max(0, 1 - cosPolar * cosPolar))
        return [radial * Math.cos(azimuth), radial * Math.sin(azimuth), cosPolar]
      }),
    ),
  )
  const rotateAngleTensor = angleTensor.map((plane) =>
    plane.map((row) => row.map((angle) => (angle + baseTwist) % (Math.PI * 2))),
  )
  const layerPosTensor = angleTensor.map((plane) =>
    plane.map((row) => row.map((_angle, z) => layerOffsets[z])),
  )
  const claddingSize = [
    latticePeriod * 5,
    latticePeriod * 4,
    2 * scale[2],
  ] as const
  const claddingPos = [0, 0, -layerPeriod - latticePeriod / 2 - baseSize[2]] as const

  return (
    <>
      <array
        shape={[3, 3, 3]}
        period={[latticePeriod, latticePeriod, layerPeriod]}
        axes={{
          x: [1, 0, 0],
          y: [0.5, Math.sqrt(3) / 2, 0],
          z: [0, 0, 1],
        }}
        inject={{
          pos: layerPosTensor,
          rotate: {
            axis: rotateAxisTensor,
            angle: rotateAngleTensor,
          },
        }}
      >
        <Core
          size={baseSize}
          holeRadius={baseHoleRadius}
          scale={[profileScale, 1, 1]}
          materials={[materials[0]]}
        />
      </array>
      <Cladding size={claddingSize} pos={claddingPos} materials={[materials[1]]} />
    </>
  )
}

const structure = new Structure({
  geometry: () => (
    <Device
      pos={vars.devicePos}
      rotate={{ axis: [0, 0, 1], angle: Math.PI / 18 }}
      scale={[1, 0.9, 1]}
      gap={4}
      profileScale={0.95}
      twistRatio={0.5}
      materials={[
        new Dielectric('Core', { epsilon: vars.coreEpsilon }, '#2563eb'),
        new Dielectric('Cladding', { epsilon: 2.1 }, '#f59e0b'),
      ]}
    />
  ),
  varsSchema: {
    width: { shape: [], default: 20, min: 10, max: 30 },
    coreEpsilon: { shape: [], default: 12, min: 10, max: 14 },
    devicePos: {
      shape: [3],
      default: [0, 0, 0],
      min: -2,
      max: 2,
    },
    rotationAzimuth: {
      shape: [3, 3, 3],
      default: zeroRotationTensor,
      min: 0,
      max: Math.PI * 2,
    },
    rotationCosPolar: {
      shape: [3, 3, 3],
      default: zeroRotationTensor,
      min: -1,
      max: 1,
    },
    rotationAngle: {
      shape: [3, 3, 3],
      default: zeroRotationTensor,
      min: 0,
      max: Math.PI * 2,
    },
  },
})

// Pass a seed to randomVars(...) when reproducible rotations are needed.
const randomRotationVars = structure.randomVars()

export default new Sample(structure, {
  rotationAzimuth: randomRotationVars.rotationAzimuth,
  rotationCosPolar: randomRotationVars.rotationCosPolar,
  rotationAngle: randomRotationVars.rotationAngle,
})
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

The Core Model calls seedless `randomVars()` but passes only `rotationAzimuth`, `rotationCosPolar`, and `rotationAngle` to the Sample. Width, Material values, and device position therefore keep their defaults while every execution creates new cell rotations.

```tsx
export default new Sample(structure, structure.randomVars(260713))
```

Evaluation order is fixed: Sample vars resolution → global `vars` binding → lazy geometry factory → Material construction → Geometry evaluation.

## Materials And Geometry

`Material(name, vars, displayColor?)` stores a read-only tensor dictionary. The color uses `#RRGGBB` and is shown in the viewer legend. Subclasses may add freely named transform and validation methods; Caemble does not invoke them automatically.

Geometry components are ordinary same-file TSX functions typed with `Geometry<P>`. TypeScript composes custom props with the shared Geometry attributes, while the evaluator handles Material inheritance at runtime. A class or component registration step is not required.

`GeometryAttributes<P>` is also available when the combined props type is needed directly. Custom props must not redefine the reserved `materials`, `pos`, `rotate`, `scale`, or `children` names. A parent may use its normalized transform values and custom props as design inputs when calculating child-local size and transforms; the evaluator then applies the parent's transform once to the completed result.

- A Geometry inherits its parent's complete `materials` array when it omits the attribute.
- Supplying `materials` replaces the complete inherited array.
- A materialless Geometry may group child Geometry. Material is required only when a primitive is created.
- Primitives created directly by a Geometry use `materials[0]`.
- Different Materials may appear as sibling scene parts and may share transforms.
- `union`, `subtract`, and `intersect` reject operands with different Material instances.
- Reusing one Material instance is allowed. Different instances cannot share the same Material name.

Every Geometry and CAD element accepts `pos`, `rotate`, and `scale`. Position is relative to its parent. Rotation uses a local axis direction and a radians angle; positive angles follow the right-hand rule. Child geometry and boolean operations run first, followed by local `scale`, axis-angle `rotate`, and `pos`. Fragment does not accept transforms; use a Geometry function or CAD operation when multiple nodes need to transform together.

`<array>` repeats exactly one direct Geometry child. `shape` gives the x/y/z cell counts, `period` gives their spacing, and optional `axes` direction vectors orient the local lattice. The array is centered on its local origin; axes are normalized independently and may be non-orthogonal. Each `inject` tensor begins with `[shape.x, shape.y, shape.z]`, followed by the value shape for that child prop. Scalar custom props therefore use a 3D tensor, while `Vec3` props such as `pos` and `scale` use a 4D tensor. `rotate` uses separate `axis` and `angle` tensors.

The default example uses a centered `[3, 3, 3]` HCP lattice with 60-degree x/y basis vectors and A/B/A layers. The B layer shifts by `(a1 + a2) / 3`, and adjacent layers use the ideal `sqrt(2/3) * a` spacing. Uniform azimuth and `cos(polar)` tensors are converted to unit-sphere-uniform rotation axes, while a separate tensor supplies uniform angles from 0 to `2π`.

Injected values replace the corresponding props written on the child for that cell. Required custom props still need base values on the child so TypeScript can validate the component. `materials` and `children` cannot be injected. Evaluation runs the injected child transform first, then the lattice offset, the array's own `scale`, `rotate`, and `pos`, and finally ancestor transforms. Cells remain independent scene parts unless an enclosing boolean operation combines them.

## Supported CAD Tags

```tsx
<box
  pos={[0, 0, 8]}
  rotate={{ axis: [0, 0, 1], angle: Math.PI / 4 }}
  scale={[1, 2, 1]}
  size={[20, 20, 20]}
/>
<cylinder pos={[0, 0, 8]} radius={8} height={16} segments={32} />
<sphere pos={[0, 0, 8]} radius={10} segments={32} />

<union
  pos={[0, 0, 8]}
  rotate={{ axis: [1, 1, 0], angle: Math.PI / 6 }}
  scale={[1, 1, 2]}
>...</union>
<subtract pos={[0, 0, 8]}>...</subtract>
<intersect pos={[0, 0, 8]}>...</intersect>

<array
  shape={[3, 3, 3]}
  period={[pitch, pitch, Math.sqrt(2 / 3) * pitch]}
  axes={{ x: [1, 0, 0], y: [0.5, Math.sqrt(3) / 2, 0], z: [0, 0, 1] }}
  inject={{
    pos: layerPosTensor,
    rotate: { axis: rotationAxisTensor, angle: rotationAngleTensor },
  }}
>
  <Core size={[12, 8, 3]} holeRadius={1} materials={[coreMaterial]} />
</array>
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
- Geometry: 다른 Geometry 코드에서 SubGeometry로 사용할 수 있으며, `materials`가 없으면 상위 Geometry 배열을 상속하고 `pos`는 부모 Geometry 기준 상대 위치로 누적
- Geometry Array: `<array>`의 `shape`, `period`, 축 방향과 `[x][y][z]` tensor injection으로 하나의 하위 Geometry를 반복 배치
- Geometry의 Material 입력: 배열로 전달하여 (`[material_0, material_1, ...]`) 하위 Geometry에 다양한 Material 조합을 입력
- Structure: 지연 실행되는 최상위 Geometry와 `varsSchema` 정의
- vars: tensor(0d, 1d, 2d, 3d, ...)의 flattened dictionary (`{a: 1, b: [2, 3], c: [[4, 5], [6, 7]]}`)
- Sample: Structure + vars
