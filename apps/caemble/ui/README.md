# Caemble UI

Caemble is a browser Structure/Experiment authoring workspace. TSX is the source of truth; previews and solvers consume immutable v2 snapshots produced by an isolated runner.

## Development

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

Generated CAD contracts are checked by every production build:

```bash
npm run generate:cad-api
npm run check:generated
```

The generator reads the CAD element registry, Quantity Kind data, registered `SolverSpec` objects, and `src/cad/api/authoring-manifest.json`. It generates the element catalog/registry, JSX intrinsic types, solver authoring types, Quantity Kind unions/facade, and pinned API versions. Commit all generated changes. CI should run `npm run check:generated`; a non-empty regeneration diff is an error.

`src/cad/model/core.ts` remains an internal application facade and is never exposed to Source code. Vars, descriptor contracts, Material construction, Structure, and Experiment live in focused `vars.ts`, `descriptor.ts`, `material.ts`, `structure.ts`, and `experiment.ts` modules; new runtime code should import the focused module when it does not need the facade.

## TSX v2 source format

A source project contains at most 32 `.ts`/`.tsx` files and 1 MiB in total. It has exactly one entry-file default export. Only static imports from `@caemble/core/v2` and relative files inside the virtual project are accepted. Dynamic imports, URL imports, and other packages are rejected before execution.

Structure:

```tsx
import { structure } from '@caemble/core/v2'

export default structure({
  lengthUnit: 'mm',
  varsSchema: {
    conductorSize: {
      min: [10, 10, 10],
      max: [100, 100, 100],
    },
  },
  geometry: ({ vars }) => (
    <box id="conductor" size={vars.conductorSize} />
  ),
  geometryGroup: {
    conductor: ['conductor'],
  },
})
```

Experiment:

```tsx
import { experiment } from '@caemble/core/v2'

export default experiment({
  lengthUnit: 'mm',
  varsSchema: {
    voltage: { min: 0, max: 10 },
  },
  solver: {
    name: 'dc-current-density',
    version: '0.0.0',
    parameters: ({ vars }) => ({
      appliedVoltage: vars.voltage,
    }),
  },
  geometry: ({ vars }) => <box size={[vars.voltage + 1, 1, 1]} />,
  initializations: ({ vars }) => [],
  boundaryConditions: ({ vars }) => [],
  recordedData: ({ vars }) => [],
})
```

The lowercase functions create model definitions; they are not JSX components or class constructors. v2 does not expose `Structure`, `Experiment`, `Sample`, `Setup`, `VariableObject`, or a global `vars` binding to Source code. `varsSchema` infers scalar and tuple/tensor shapes, so ordinary `vars` access does not need `as number` or `as Vec3` casts.

Every geometry, solver, and rule callback receives the same frozen `{ vars }` context for one evaluation. Module-level helpers may accept values from that context, but cannot read a global `vars` value.

## External vars and deterministic evaluation

Source definition and realization values are separate:

```ts
await evaluateDocument({
  document,
  seed: 100,
  vars: { conductorSize: [20, 20, 20] },
})

await evaluateDocument({
  document,
  seed: 100,
  vars: { conductorSize: [80, 30, 10] },
})
```

The compiler caches emitted modules by SHA-256 source-project hash and compiler/API version. A new isolated evaluation reuses that emit without changing or recompiling Source. Explicit values are validated and preserved; missing schema entries are generated deterministically from `seed`. Unknown keys, tensor-shape mismatches, non-finite values, and out-of-range components fail before any model callback runs.

The same Source, external vars, and seed produce the same snapshot. Normal edits preserve the realization seed. **Reroll** changes only the seed and reevaluates the current compiled definition.

## Compilation and diagnostics

The lazily loaded Monaco TypeScript Worker is the only browser compiler path. Its settings are ES2020, strict TypeScript, CommonJS emit, JSX factory `h`, and virtual-project module resolution. Syntactic, semantic, and source-policy errors prevent runner dispatch. Runtime stack locations are mapped back to Monaco ranges with source maps.

Every diagnostic carries `file`, `range`, `code`, `severity`, and `phase`. Monaco markers and the document footer use the same diagnostics.

The editor maintains two Monaco models and one active editor instance. Monaco core and the TypeScript Worker are Vite-generated, hashed first-party assets loaded only when the Source screen is entered. No jsDelivr loader or `esbuild-wasm` runtime is used.

## Evaluation isolation

Production evaluation uses a hidden iframe served from a separate origin. The host and runner exchange one schema-validated request through a nonce-bound `MessageChannel`. The runner creates a disposable Worker for each evaluation and terminates it after success, failure, cancellation, or timeout.

The runner boundary provides the security controls:

- no host cookies, authentication state, or sensitive storage on the runner origin;
- runner CSP with `connect-src 'none'`;
- an allowlisted static-import AST policy;
- exact request/response schema and provenance checks on both sides;
- 3-second default evaluation timeout, with 10- and 30-second heavy modes;
- plain, finite, acyclic snapshot validation and complexity/binary-size limits;
- no `new Function` or `unsafe-eval` in the host application bundles.

The runner itself needs `'unsafe-eval'` because the isolated evaluation Worker executes TypeScript's CommonJS emit. That exception must never be added to the host CSP.

## Snapshot and Solver boundary

The public result is an `EvaluatedDocumentSnapshotV2`:

```ts
type EvaluatedDocumentSnapshotV2 = Readonly<{
  kind: 'structure' | 'experiment'
  sourceHash: string
  apiVersion: 2
  seed: number
  variables: ResolvedVars
  scene: SerializableCadScene
  experimentRules?: EvaluatedExperimentRules
  solver?: ResolvedExperimentSolver
}>
```

JSCAD instances do not cross the untrusted boundary. Each solid is normalized into validated `Float64Array` vertex positions plus `Uint32Array` polygon offsets. Buffers are transferred from the disposable Worker to the runner frame and then to the host. Scene content has a 64-hex content hash; decoded geometry and renderer entities are bounded caches keyed by that scene hash.

The Solver Worker receives the exact successful snapshots shown in preview. It never receives executable Structure/Experiment definitions and does not reevaluate geometry, Materials, rules, or solver parameters. Solver provenance includes both source hashes, vars, seeds, API versions, and the selected solver identity. Structure and Experiment evaluation jobs are independent; a timeout in one does not restart the peer or an active solver. Solver preflight incompatibility leaves both previews `Ready`, exposes a separate amber Simulation state, and disables Run until the latest pair is compatible. If the Solver Worker fails, it is replaced and current snapshots are recached.

## Visual round-trip editing

The supported writable form is an object literal, or a directly referenced top-level `const` object literal. Spread, computed properties, `map`/`filter`, and other dynamic expressions can still execute, but the affected visual editor is read-only.

Group and Experiment parameter editors create source-hash-bound patches through one patch API. A patch is rejected if Source changed after analysis. Visual save is disabled whenever the current source hash differs from the evaluated snapshot hash.

## v1 migration

There is no runtime v1 adapter. `migrateCadSourceV1ToV2()` performs the static conversion:

- `new Structure({...})` → `structure({...})`;
- `new Experiment({...})` → `experiment({...})`;
- `new Sample(structure)` and `new Setup(experiment)` wrappers are removed;
- model callbacks receive `{ vars }`;
- `@caemble/core` becomes `@caemble/core/v2`;
- redundant scalar/tuple assertions on `vars` are removed.

If a module-level helper reads global `vars`, or a wrapper contains realization values that cannot be moved safely, the codemod reports source locations and returns the original source unchanged.

## Production deployment

Set different origins at build time:

```dotenv
VITE_CAEMBLE_HOST_ORIGIN=https://app.example.com
VITE_CAEMBLE_RUNNER_ORIGIN=https://cad-runner.example.com
```

Deploy the complete `dist` output to both origins, or otherwise ensure the runner origin serves `runner.html` and every hashed asset it references from the same build. `VITE_CAEMBLE_RUNNER_ORIGIN` is mandatory in production and must differ from the host origin.

Recommended runner headers are provided in `public/_headers`:

```text
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/runner.html
  Cache-Control: no-store
  Content-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-eval'; worker-src 'self'; connect-src 'none'; img-src 'none'; style-src 'none'; base-uri 'none'; form-action 'none'
```

The host can use a strict policy such as `script-src 'self'; worker-src 'self'; frame-src https://cad-runner.example.com` without any external script origin or `'unsafe-eval'`. Serve gzip or Brotli through the existing CDN. Hashed assets should use the immutable one-year cache policy; HTML should not.

Do not place cookies, credentials, user data, service-worker scope, analytics, or general application endpoints on the runner origin. If browser isolation is no longer strong enough for the threat model, retain the runner protocol and replace the browser runner with a process-isolated backend sandbox.

## Limits

- Virtual project: 32 files and 1 MiB total.
- Compiler initialization/operation timeout: 5 seconds after initialization.
- Preview evaluation: 3 seconds by default; explicit 10- and 30-second heavy modes.
- Snapshot binary payload: 128 MiB, with finite-value, depth, node-count, and protocol-size checks.
- The included DC current-density solver is a bounded browser implementation, not a production multiphysics backend.



