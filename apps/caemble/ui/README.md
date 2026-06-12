# Code to CAD

Browser-only CAD modeling MVP for writing TSX-like CAD code and rendering the resulting geometry in a 3D viewport.

## Run

```bash
corepack pnpm --dir apps/caemble/ui install
corepack pnpm --dir apps/caemble/ui dev
```

Build check:

```bash
corepack pnpm --dir apps/caemble/ui build
```

## Supported Tags

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

The model entrypoint can be either a default export or a named `main` export.

```tsx
export default function Model() {
  return (
    <union>
      <box size={[20, 20, 6]} />
      <translate offset={[0, 0, 8]}>
        <cylinder radius={8} height={16} />
      </translate>
    </union>
  )
}
```

## Custom Components And Props

Custom components are plain functions. JSX attributes are passed as the first argument, and nested JSX is injected as `children`.

```tsx
type Vec3 = [number, number, number]

function Mount({
  at,
  radius = 5,
  children,
}: {
  at: Vec3
  radius?: number
  children?: unknown
}) {
  return (
    <translate offset={at}>
      <union>
        <cylinder radius={radius} height={10} />
        {children}
      </union>
    </translate>
  )
}

export default function Model() {
  return (
    <Mount at={[0, 0, 5]} radius={7}>
      <sphere radius={4} />
    </Mount>
  )
}
```

## How It Works

- Monaco Editor provides the TSX editing surface and inline JSX tag types.
- `esbuild-wasm` transforms TSX to JavaScript inside a Web Worker.
- User code is executed only in the Worker.
- JSX tags call the local CAD JSX runtime directly and return CAD geometry.
- The internal JSX factory is named `h()`, similar to React's JSX factory, but it creates geometry instead of UI elements.
- There is no separate JSCAD source-code generation step.
- The current implementation uses `@jscad/modeling` and `@jscad/regl-renderer` internally for geometry operations and rendering.

## Current Limitations

- This MVP is not a complete security sandbox.
- User code runs in a Web Worker, but product-grade malicious code protection is not implemented yet.
- External imports are not supported.
- Supported CAD tags are limited to `box`, `cylinder`, `sphere`, `translate`, `rotate`, `scale`, `union`, `subtract`, and `intersect`.
- STL/OBJ export is not implemented.
- Parameter UI generation is not implemented.
- Complex boolean models can be slow depending on browser performance.

## Future Work

- AST-based source validation or stronger sandboxing.
- Export formats such as STL.
- Parameter definitions and generated controls.
- More primitives and modeling operations.
- Camera/view presets and saved project state.
