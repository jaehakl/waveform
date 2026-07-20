import type {
  CartesianBasis,
  DataDType,
  FloatDataDType,
  IntegerDataDType,
} from '../cad/model/core'
import type { UcumUnit } from '../cad/model/units'
import type {
  QuantityKindName,
  ScalarQuantityKindName,
} from '../quantitykind/runtime'
import type {
  MaterialCatalogKey,
  MaterialModelDefinitionFor,
  MaterialModelKey,
  MaterialPropertyKey,
  MaterialPropertyQuantityKind,
} from '../material/data'

export type SolverRuleCategory = 'initializations' | 'boundaryConditions' | 'recordedData'

export type SolverNumericBounds = Readonly<{
  minimum?: number
  maximum?: number
  exclusiveMinimum?: boolean
  exclusiveMaximum?: boolean
}>

type SolverValueSpecBase = Readonly<{
  description?: string
}>

export type SolverQuantitySpec<Name extends QuantityKindName = QuantityKindName> =
  Name extends QuantityKindName ? Readonly<{
  quantityKind: Name
  referenceUnit: UcumUnit
}> & (Name extends ScalarQuantityKindName
  ? Readonly<{ referenceBasis?: never }>
  : Readonly<{ referenceBasis: CartesianBasis }>) : never

type SolverAxisQuantity = Readonly<
  | SolverQuantitySpec<ScalarQuantityKindName>
  | { quantityKind?: never; referenceUnit?: never; referenceBasis?: never }
>

export type SolverAxisSpec = Readonly<{
  length: number
  name?: string
  ticks?: readonly (number | string)[]
}> & SolverAxisQuantity

export type SolverResultAxisSpec = Readonly<{
  length?: number
  name?: string
  ticks?: readonly (number | string)[]
}> & SolverAxisQuantity

type SolverValueSpecForAxis<TAxis> = SolverValueSpecBase & Readonly<{
  axes?: readonly TAxis[]
}> & Readonly<
  | { dtype: 'bool' }
  | {
    dtype: 'string'
    values?: readonly string[]
    minimumLength?: number
  }
  | ({ dtype: IntegerDataDType } & SolverNumericBounds)
  | ({ dtype: FloatDataDType } & SolverQuantitySpec & SolverNumericBounds)
>

export type SolverValueSpec = SolverValueSpecForAxis<SolverAxisSpec>
export type SolverResultValueSpec = SolverValueSpecForAxis<SolverResultAxisSpec>

export type SolverParameterSpec = Readonly<{
  description: string
  required?: boolean
  value: SolverValueSpec
}>

type SolverMaterialBasisSpec<Name extends QuantityKindName> =
  Name extends ScalarQuantityKindName
    ? Readonly<{ referenceBasis?: never }>
    : Readonly<{ referenceBasis: CartesianBasis }>

export type SolverMaterialPropertyValueSpec<Key extends MaterialPropertyKey> = Readonly<{
  dtype: 'float64'
  referenceUnit: UcumUnit
  axes?: never
  quantityKind?: never
  description?: string
}> & SolverMaterialBasisSpec<MaterialPropertyQuantityKind<Key>> & SolverNumericBounds

type SolverMaterialModelInputQuantityKind<Key extends MaterialModelKey> =
  MaterialModelDefinitionFor<Key>['input']['quantity_kind']
type SolverMaterialModelOutputQuantityKind<Key extends MaterialModelKey> =
  MaterialModelDefinitionFor<Key>['output']['quantity_kind']

export type SolverMaterialRelationValueSpec<Key extends MaterialModelKey> = Readonly<{
  kind: 'sampled_relation'
  input: Readonly<{ referenceUnit: UcumUnit }>
    & SolverMaterialBasisSpec<SolverMaterialModelInputQuantityKind<Key>>
  output: Readonly<{ referenceUnit: UcumUnit }>
    & SolverMaterialBasisSpec<SolverMaterialModelOutputQuantityKind<Key>>
}>

export type SolverMaterialParameterSpec<Key extends MaterialCatalogKey> = Readonly<{
  description: string
  required?: boolean
  value: Key extends MaterialPropertyKey
    ? SolverMaterialPropertyValueSpec<Key>
    : Key extends MaterialModelKey
      ? SolverMaterialRelationValueSpec<Key>
      : never
}>

export type SolverMaterialParameterMap = Readonly<Partial<{
  [Key in MaterialCatalogKey]: SolverMaterialParameterSpec<Key>
}>>

export type SolverTargetSpec = Readonly<{
  source: 'structure' | 'experiment'
  kind: 'geometry' | 'surface'
  minimumTargets: number
  maximumTargets: number
  minimumResolved: number
  maximumResolved: number
}>

export type SolverMethodSpec = Readonly<{
  methodId: string
  description: string
  minimumOccurrences: number
  maximumOccurrences: number
  target: SolverTargetSpec
  parameters: Readonly<Record<string, SolverParameterSpec>>
  result?: SolverResultValueSpec
}>

export type SolverMaterialSpec = Readonly<{
  role: string
  description: string
  target: Readonly<{
    category: SolverRuleCategory
    methodId: string
  }>
  parameters: SolverMaterialParameterMap
}>

export type SolverSpec = Readonly<{
  name: string
  version: string
  description: string
  referenceLengthUnit: UcumUnit
  parameters: Readonly<Record<string, SolverParameterSpec>>
  materials: readonly SolverMaterialSpec[]
  methods: Readonly<Record<SolverRuleCategory, readonly SolverMethodSpec[]>>
}>

export type SolverValidationIssue = Readonly<{
  documentType: 'structure' | 'experiment'
  path: string
  message: string
}>

export type SolverValidationResult = Readonly<{
  complete: boolean
  issues: readonly SolverValidationIssue[]
  spec?: SolverSpec
}>

export type SolverSpecDType = DataDType
