import type {
  ExperimentFloatTensorDType,
  ExperimentNonFloatTensorDType,
  ExperimentTensorDType,
} from '../cad/model/core'
import type { UcumUnit } from '../cad/model/units'
import type { QuantityKindName } from '../quantitykind/runtime'

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

export type SolverQuantitySpec = Readonly<{
  quantityKind: QuantityKindName
  referenceUnit: UcumUnit
}>

export type SolverAxisSpec = Readonly<{
  name: string
  ticks?: readonly (number | string)[]
}> & Readonly<
  | SolverQuantitySpec
  | { quantityKind?: never; referenceUnit?: never }
>

export type SolverTensorValueSpec = SolverValueSpecBase & Readonly<{
  type: 'tensor'
  dimension: number
  shape: readonly number[]
  axes?: readonly SolverAxisSpec[]
  element?: SolverNumericBounds
}> & Readonly<
  | {
    dtype: ExperimentFloatTensorDType
    quantityKind: QuantityKindName
    referenceUnit: UcumUnit
  }
  | {
    dtype: ExperimentNonFloatTensorDType
    quantityKind?: never
    referenceUnit?: never
  }
>

export type SolverParameterSpec = Readonly<{
  description: string
  required?: boolean
  value: SolverValueSpec
}>

export type SolverValueSpec =
  | SolverValueSpecBase & Readonly<{ type: 'null' }>
  | SolverValueSpecBase & Readonly<{ type: 'boolean' }>
  | SolverValueSpecBase & Readonly<{
    type: 'string'
    values?: readonly string[]
    minimumLength?: number
  }>
  | SolverValueSpecBase & Readonly<{
    type: 'integer'
  }> & SolverNumericBounds
  | SolverValueSpecBase & Readonly<{
    type: 'float'
  }> & SolverQuantitySpec & SolverNumericBounds
  | SolverTensorValueSpec
  | SolverValueSpecBase & Readonly<{
    type: 'array'
    items: SolverValueSpec
    minimumLength?: number
    maximumLength?: number
  }>
  | SolverValueSpecBase & Readonly<{
    type: 'object'
    parameters: Readonly<Record<string, SolverParameterSpec>>
  }>

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
  result?: SolverTensorValueSpec
}>

export type SolverMaterialSpec = Readonly<{
  role: string
  description: string
  target: Readonly<{
    category: SolverRuleCategory
    methodId: string
  }>
  parameters: Readonly<Record<string, SolverParameterSpec>>
}>

export type SolverSpec = Readonly<{
  name: string
  version: string
  description: string
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

export type SolverSpecTensorDType = ExperimentTensorDType
