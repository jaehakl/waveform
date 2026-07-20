# Solver module authoring

Every solver is a folder under `src/solver/modules` and must expose one `SolverModule` from its `index.ts`.

```text
modules/mySolver/
├─ index.ts       # binds spec and solve
├─ spec.ts        # serializable external contract
├─ solve.ts       # numerical/API implementation
├─ spec.test.ts   # contract and preflight tests
└─ solve.test.ts  # numerical/domain tests
```

Register the exported module once in `src/solver/modules/index.ts`. The controller, Worker preflight, and Solver Spec UI all consume that same registration; do not add solver-specific branches to UI or Worker code.

## Required module shape

```ts
export const mySolverSpec = {
  name: 'my-solver',
  version: '1.0.0',
  description: 'Human-readable solver description.',
  parameters: {},
  materials: [],
  methods: {
    initializations: [],
    boundaryConditions: [],
    recordedData: [],
  },
} as const satisfies SolverSpec

export const mySolver = Object.freeze({
  spec: mySolverSpec,
  solve,
}) satisfies SolverModule
```

The spec must contain only structured-cloneable data. Do not store functions, classes, regular expressions, or runtime handles in it. `SolverRegistry` validates and deeply freezes every registered spec.

## Parameter schemas

Solver, method, and Material parameter maps declare the keys consumed by that solver version. Entries are required unless `required: false` is stated. A declared value is validated whenever it is present.

Undeclared parameter keys are intentionally accepted and preserved. This permits one Experiment source to carry parameters for several compatible solver versions. Every value still passes the core model normalizer, so undeclared float descriptors must also contain a valid `quantityKind` and an exact applicable UCUM `unit`.

Every leaf spec declares a `dtype`, optional non-empty `axes`, and dtype-appropriate constraints. Supported dtypes are `bool`, `string`, signed/unsigned 8/16/32/64-bit integers, and float16/32/64. Use numeric bounds for public numeric limits and string constraints for string values. Raw booleans, strings, and safe integers are accepted as shorthand when they match the declared dtype; explicit values always use `{ dtype, value, axes?, ... }`. Array, object, and null leaves are not part of the parameter contract.

Declared axes and physical components are separate. A fixed axis requires a positive safe-integer `length`; omitted names and ticks normalize to `axis n` and zero-based indices, and explicit `ticks.length` must equal `length`. Omitting `axes` means one Quantity value, while `axes: []` is invalid. Every Quantity Kind has an explicit physical domain and exhaustive tensor order, whose component shape is `[3]` repeated by that order. Stored value shape is therefore the declared axis lengths followed by `componentShape`. A single vector or matrix omits `axes` and stores its complete component value.

## Quantities

Every float descriptor, float result, and unit-bearing axis in the external contract must declare:

```ts
{
  quantityKind: 'electromagnetism.Voltage',
  referenceUnit: 'V',
}
```

`quantityKind` must be a `QuantityKindName`. `referenceUnit` must appear exactly in that Quantity Kind's `applicableUnits`; a Quantity Kind with an empty list cannot be used. The reference unit documents the solver's comparison/working unit and is used for range checks. It does not restrict callers to that unit: every applicable unit is accepted and the solver remains responsible for converting consumed values component by component.

Every order-1 or higher quantity spec additionally declares `referenceBasis`, a finite orthonormal right-handed `CartesianBasis`. An omitted caller basis is normalized to the identity Cartesian basis; the resulting basis must match `referenceBasis` element for element because solver validation does not rotate components automatically. Scalar Quantity Kinds forbid a basis. Tensor unit conversions must be zero-preserving linear conversions, while affine conversions are rejected.

Do not accept equivalent UCUM spellings that are absent from the applicable list. For example, use the catalog's `S.m-1` spelling for `electromagnetism.ElectricConductivity`, not `S/m`.

## Methods, targets, and Materials

Each method declares its category, `methodId`, description, occurrence bounds, target source/kind, target count, resolved-member count, parameters, and—only for RecordedData—its result schema. A RecordedData result axis may omit `length` to declare a dynamic axis; it must then omit source ticks, and the actual length is inferred from the payload. Unknown method IDs and wrong occurrence counts are errors even though unknown parameter keys are allowed.

A Material role points to one declared method. The generic validator resolves that method's target groups to Geometry parts (or the owning parts of Surface targets), requires a Material on every resolved part, and validates the role's required Material parameters. A Material may retain additional variables for other solvers.

Keep external contract checks in `spec.ts`: required parameters, value kinds/ranges, quantities, method/cardinality, target shape, result schema, and Material variables. Keep solver-specific physical and numerical checks in `solve.ts`: topology relationships, cross-field relationships, mesh limits, convergence, API failures, and other constraints that cannot be expressed by the common contract.

## Checklist

- The module uses a folder and exports `{ spec, solve }`.
- `name@version` is unique and all descriptions are non-empty.
- Every external float quantity has an exact Quantity Kind and applicable reference unit.
- Tensor quantities declare an exact reference basis and component shape; value-array axes declare their own lengths, while scalar quantities declare no basis.
- Required and optional keys are intentional; undeclared keys are never read accidentally.
- Every method has occurrence and target constraints, and every RecordedData method has a result schema.
- Material requirements are attached to the method target that identifies their role.
- Spec tests cover missing required keys, extra-key compatibility, bad quantities, method/cardinality, target/result, and Material errors.
- Solve tests cover physical constraints, cancellation, numerical behavior, and result normalization.
- `npm test`, `npm run lint`, and `npm run build` pass.
