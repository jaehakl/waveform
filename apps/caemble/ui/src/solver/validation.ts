import type { CadScene, CadScenePart } from '../cad/evaluation/types'
import {
  CadModelError,
  isFloatDType,
  normalizeDataElement,
  normalizeMaterialSampledRelation,
  type DataDType,
  type EvaluatedExperimentRules,
  type ExperimentRule,
  type RecordedDataRule,
} from '../cad/model/core'
import { convertUcumValue, normalizeUcumUnit } from '../cad/model/units'
import {
  materialModelByKey,
  materialParameterByKey,
  type MaterialModelKey,
  type MaterialPropertyKey,
} from '../material/data'
import { QuantityKind } from '../quantitykind'
import {
  normalizeCartesianBasis,
  type QuantityKindName,
} from '../quantitykind/runtime'
import type {
  SolverAxisSpec,
  SolverMaterialSpec,
  SolverMaterialParameterMap,
  SolverMethodSpec,
  SolverNumericBounds,
  SolverParameterSpec,
  SolverResultAxisSpec,
  SolverResultValueSpec,
  SolverRuleCategory,
  SolverSpec,
  SolverValidationIssue,
  SolverValidationResult,
  SolverValueSpec,
} from './spec'
import type { SolverPreflightInput } from './types'

const dataDTypes = new Set<DataDType>([
  'bool', 'string',
  'int8', 'int16', 'int32', 'int64',
  'uint8', 'uint16', 'uint32', 'uint64',
  'float16', 'float32', 'float64',
])

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertNonEmpty(value: unknown, path: string) {
  if (typeof value !== 'string' || !value.trim()) throw new CadModelError(`${path} must be a non-empty string.`)
}

function assertCardinality(minimum: unknown, maximum: unknown, path: string) {
  if (
    !Number.isSafeInteger(minimum)
    || !Number.isSafeInteger(maximum)
    || (minimum as number) < 0
    || (maximum as number) < (minimum as number)
  ) {
    throw new CadModelError(`${path} must use safe integer bounds with 0 <= minimum <= maximum.`)
  }
}

function assertBounds(bounds: SolverNumericBounds, path: string) {
  for (const [key, value] of Object.entries(bounds)) {
    if ((key === 'minimum' || key === 'maximum') && (typeof value !== 'number' || !Number.isFinite(value))) {
      throw new CadModelError(`${path}.${key} must be finite.`)
    }
  }
  if (bounds.exclusiveMinimum !== undefined && bounds.minimum === undefined) {
    throw new CadModelError(`${path}.exclusiveMinimum requires minimum.`)
  }
  if (bounds.exclusiveMaximum !== undefined && bounds.maximum === undefined) {
    throw new CadModelError(`${path}.exclusiveMaximum requires maximum.`)
  }
  if (bounds.minimum !== undefined && bounds.maximum !== undefined && bounds.minimum > bounds.maximum) {
    throw new CadModelError(`${path}.minimum must not exceed maximum.`)
  }
}

function assertQuantitySpec(
  value: Readonly<{ quantityKind: unknown; referenceUnit: unknown; referenceBasis?: unknown }>,
  path: string,
  scalarOnly = false,
) {
  if (
    typeof value.quantityKind !== 'string'
    || !Object.prototype.hasOwnProperty.call(QuantityKind, value.quantityKind)
  ) {
    throw new CadModelError(`${path}.quantityKind must be a known Quantity Kind name.`)
  }
  const quantityKind = value.quantityKind as QuantityKindName
  const unit = normalizeUcumUnit(value.referenceUnit, `${path}.referenceUnit`)
  const applicableUnits = QuantityKind[quantityKind].applicableUnits() as readonly string[]
  if (applicableUnits.length === 0) {
    throw new CadModelError(`${path}.quantityKind ${quantityKind} has no applicable UCUM units.`)
  }
  if (!applicableUnits.includes(unit)) {
    throw new CadModelError(`${path}.referenceUnit ${unit} is not applicable to ${quantityKind}.`)
  }
  const tensorOrder = QuantityKind[quantityKind].tensorOrder()
  if (scalarOnly && tensorOrder > 0) {
    throw new CadModelError(`${path}.quantityKind ${quantityKind} must have tensor order 0.`)
  }
  if (tensorOrder === 0 && value.referenceBasis !== undefined) {
    throw new CadModelError(`${path}.referenceBasis is forbidden for scalar Quantity Kind ${quantityKind}.`)
  }
  if (tensorOrder > 0) normalizeCartesianBasis(value.referenceBasis, `${path}.referenceBasis`)
}

function assertAxisSpec(
  axis: SolverAxisSpec | SolverResultAxisSpec,
  path: string,
  allowDynamicLength: boolean,
) {
  if (!isRecord(axis)) throw new CadModelError(`${path} must be an axis spec.`)
  if (axis.length === undefined) {
    if (!allowDynamicLength) throw new CadModelError(`${path}.length must be a positive safe integer.`)
    if (axis.ticks !== undefined) {
      throw new CadModelError(`${path}.ticks must be omitted when ${path}.length is dynamic.`)
    }
  } else if (!Number.isSafeInteger(axis.length) || axis.length <= 0) {
    throw new CadModelError(`${path}.length must be a positive safe integer when specified.`)
  }
  if (axis.name !== undefined) assertNonEmpty(axis.name, `${path}.name`)
  if (axis.ticks !== undefined && !Array.isArray(axis.ticks)) {
    throw new CadModelError(`${path}.ticks must be an array.`)
  }
  if (axis.ticks !== undefined && axis.ticks.length !== axis.length) {
    throw new CadModelError(`${path}.ticks must contain exactly ${axis.length} entries.`)
  }
  axis.ticks?.forEach((tick, index) => {
    if (typeof tick !== 'string' && (typeof tick !== 'number' || !Number.isFinite(tick))) {
      throw new CadModelError(`${path}.ticks[${index}] must be a string or finite number.`)
    }
  })
  const hasQuantity = axis.quantityKind !== undefined || axis.referenceUnit !== undefined
  if (hasQuantity) {
    assertQuantitySpec(
      axis as SolverAxisSpec & { quantityKind: unknown; referenceUnit: unknown },
      path,
      true,
    )
  }
}

function assertValueSpec(
  value: SolverValueSpec | SolverResultValueSpec,
  path: string,
  allowDynamicAxes = false,
) {
  if (!isRecord(value)) {
    throw new CadModelError(`${path} must be a value spec.`)
  }
  const obsoleteField = ['type', 'shape', 'dimension', 'sampleDimension', 'sampleShape', 'sampleAxes']
    .find((field) => Object.prototype.hasOwnProperty.call(value, field))
  if (obsoleteField) {
    const replacement = obsoleteField === 'type'
      ? 'use dtype'
      : obsoleteField === 'sampleAxes'
        ? 'use axes'
        : 'express every outer dimension as an axis length'
    throw new CadModelError(`${path}.${obsoleteField} is obsolete in the dtype/axes contract; ${replacement}.`)
  }
  if (value.description !== undefined) assertNonEmpty(value.description, `${path}.description`)
  if (typeof value.dtype !== 'string' || !dataDTypes.has(value.dtype as DataDType)) {
    throw new CadModelError(`${path}.dtype is not supported.`)
  }
  const dtype = value.dtype as DataDType
  if (value.axes !== undefined) {
    if (!Array.isArray(value.axes)) throw new CadModelError(`${path}.axes must be an array.`)
    if (value.axes.length === 0) {
      throw new CadModelError(`${path}.axes must be omitted for a single value; axes cannot be empty.`)
    }
    value.axes.forEach((axis, index) => assertAxisSpec(
      axis,
      `${path}.axes[${index}]`,
      allowDynamicAxes,
    ))
  }

  if (dtype === 'string') {
    const stringSpec = value as Readonly<{ minimumLength?: number; values?: readonly string[] }>
    if (stringSpec.minimumLength !== undefined && (!Number.isSafeInteger(stringSpec.minimumLength) || stringSpec.minimumLength < 0)) {
      throw new CadModelError(`${path}.minimumLength must be a non-negative safe integer.`)
    }
    if (stringSpec.values !== undefined) {
      if (!Array.isArray(stringSpec.values) || stringSpec.values.length === 0 || stringSpec.values.some((item) => typeof item !== 'string')) {
        throw new CadModelError(`${path}.values must be a non-empty string array.`)
      }
      if (new Set(stringSpec.values).size !== stringSpec.values.length) {
        throw new CadModelError(`${path}.values must not contain duplicates.`)
      }
    }
    return
  }
  if (isFloatDType(dtype)) {
    assertQuantitySpec(
      value as SolverResultValueSpec & { quantityKind: unknown; referenceUnit: unknown },
      path,
    )
    assertBounds(value as SolverNumericBounds, path)
    return
  }
  const metadataSpec = value as Readonly<Record<string, unknown>>
  if (
    metadataSpec.quantityKind !== undefined
    || metadataSpec.referenceUnit !== undefined
    || metadataSpec.referenceBasis !== undefined
  ) {
    throw new CadModelError(`${path} non-float dtype must not declare quantity metadata.`)
  }
  if (dtype !== 'bool') assertBounds(value as SolverNumericBounds, path)
}

function assertParameterSpecs(parameters: Readonly<Record<string, SolverParameterSpec>>, path: string) {
  if (!isRecord(parameters)) throw new CadModelError(`${path} must be an object.`)
  Object.entries(parameters).forEach(([key, parameter]) => {
    assertNonEmpty(key, `${path} key`)
    if (!isRecord(parameter)) throw new CadModelError(`${path}.${key} must be a parameter spec.`)
    assertNonEmpty(parameter.description, `${path}.${key}.description`)
    if (parameter.required !== undefined && typeof parameter.required !== 'boolean') {
      throw new CadModelError(`${path}.${key}.required must be boolean.`)
    }
    assertValueSpec(parameter.value, `${path}.${key}.value`)
  })
}

function assertMaterialParameterSpecs(parameters: SolverMaterialParameterMap, path: string) {
  if (!isRecord(parameters)) throw new CadModelError(`${path} must be an object.`)
  Object.entries(parameters).forEach(([key, parameter]) => {
    const parameterPath = `${path}.${key}`
    if (!isRecord(parameter)) throw new CadModelError(`${parameterPath} must be a parameter spec.`)
    assertNonEmpty(parameter.description, `${parameterPath}.description`)
    if (parameter.required !== undefined && typeof parameter.required !== 'boolean') {
      throw new CadModelError(`${parameterPath}.required must be boolean.`)
    }
    if (!isRecord(parameter.value)) throw new CadModelError(`${parameterPath}.value must be a value spec.`)

    if (Object.prototype.hasOwnProperty.call(materialParameterByKey, key)) {
      const value = parameter.value as Readonly<Record<string, unknown>>
      if (value.quantityKind !== undefined) {
        throw new CadModelError(`${parameterPath}.value.quantityKind is derived from Material catalog key ${key}.`)
      }
      if (value.axes !== undefined) {
        throw new CadModelError(`${parameterPath}.value.axes is forbidden for a Material property.`)
      }
      const invalidField = Object.keys(value).find((field) => ![
        'dtype',
        'referenceUnit',
        'referenceBasis',
        'description',
        'minimum',
        'maximum',
        'exclusiveMinimum',
        'exclusiveMaximum',
      ].includes(field))
      if (invalidField !== undefined) {
        throw new CadModelError(`${parameterPath}.value.${invalidField} is not allowed for a Material property.`)
      }
      if (value.dtype !== 'float64') {
        throw new CadModelError(`${parameterPath}.value.dtype must be float64.`)
      }
      const quantityKind = materialParameterByKey[key as MaterialPropertyKey].quantity_kind
      assertQuantitySpec({
        quantityKind,
        referenceUnit: value.referenceUnit,
        ...(value.referenceBasis === undefined ? {} : { referenceBasis: value.referenceBasis }),
      }, `${parameterPath}.value`)
      assertBounds(value as SolverNumericBounds, `${parameterPath}.value`)
      return
    }

    if (!Object.prototype.hasOwnProperty.call(materialModelByKey, key)) {
      throw new CadModelError(`${parameterPath} is not a registered Material catalog key.`)
    }
    const definition = materialModelByKey[key as MaterialModelKey]
    const value = parameter.value as Readonly<Record<string, unknown>>
    if (value.kind !== 'sampled_relation' || !isRecord(value.input) || !isRecord(value.output)) {
      throw new CadModelError(`${parameterPath}.value must be a sampled_relation spec.`)
    }
    const invalidField = Object.keys(value).find((field) => !['kind', 'input', 'output'].includes(field))
    const invalidInputField = Object.keys(value.input).find((field) => (
      !['referenceUnit', 'referenceBasis'].includes(field)
    ))
    const invalidOutputField = Object.keys(value.output).find((field) => (
      !['referenceUnit', 'referenceBasis'].includes(field)
    ))
    if (invalidField !== undefined || invalidInputField !== undefined || invalidOutputField !== undefined) {
      const fieldPath = invalidField !== undefined
        ? invalidField
        : invalidInputField !== undefined
          ? `input.${invalidInputField}`
          : `output.${invalidOutputField}`
      throw new CadModelError(`${parameterPath}.value.${fieldPath} is not allowed for a Material relation.`)
    }
    assertQuantitySpec({
      quantityKind: definition.input.quantity_kind,
      referenceUnit: value.input.referenceUnit,
      ...(value.input.referenceBasis === undefined ? {} : { referenceBasis: value.input.referenceBasis }),
    }, `${parameterPath}.value.input`)
    assertQuantitySpec({
      quantityKind: definition.output.quantity_kind,
      referenceUnit: value.output.referenceUnit,
      ...(value.output.referenceBasis === undefined ? {} : { referenceBasis: value.output.referenceBasis }),
    }, `${parameterPath}.value.output`)
    if (
      definition.shared_basis
      && JSON.stringify(value.input.referenceBasis) !== JSON.stringify(value.output.referenceBasis)
    ) {
      throw new CadModelError(`${parameterPath}.value input and output referenceBasis must match.`)
    }
  })
}

export function assertSolverSpec(spec: SolverSpec) {
  if (!isRecord(spec)) throw new CadModelError('Solver spec must be an object.')
  assertNonEmpty(spec.name, 'Solver spec name')
  assertNonEmpty(spec.version, 'Solver spec version')
  assertNonEmpty(spec.description, 'Solver spec description')
  assertParameterSpecs(spec.parameters, 'Solver spec parameters')

  const methods = new Map<string, SolverRuleCategory>()
  ;(['initializations', 'boundaryConditions', 'recordedData'] as const).forEach((category) => {
    const entries = spec.methods?.[category]
    if (!Array.isArray(entries)) throw new CadModelError(`Solver spec methods.${category} must be an array.`)
    entries.forEach((method, index) => {
      const path = `Solver spec methods.${category}[${index}]`
      assertNonEmpty(method.methodId, `${path}.methodId`)
      assertNonEmpty(method.description, `${path}.description`)
      if (methods.has(method.methodId)) {
        throw new CadModelError(`Solver spec methodId ${method.methodId} is registered more than once.`)
      }
      methods.set(method.methodId, category)
      assertCardinality(method.minimumOccurrences, method.maximumOccurrences, `${path} occurrences`)
      assertCardinality(method.target.minimumTargets, method.target.maximumTargets, `${path}.target targets`)
      assertCardinality(method.target.minimumResolved, method.target.maximumResolved, `${path}.target resolved members`)
      if (!['structure', 'experiment'].includes(method.target.source)) {
        throw new CadModelError(`${path}.target.source is not supported.`)
      }
      if (!['geometry', 'surface'].includes(method.target.kind)) {
        throw new CadModelError(`${path}.target.kind is not supported.`)
      }
      assertParameterSpecs(method.parameters, `${path}.parameters`)
      if (category === 'recordedData') {
        if (!method.result) throw new CadModelError(`${path}.result is required for recordedData.`)
        assertValueSpec(method.result, `${path}.result`, true)
      } else if (method.result !== undefined) {
        throw new CadModelError(`${path}.result is allowed only for recordedData.`)
      }
    })
  })

  if (!Array.isArray(spec.materials)) throw new CadModelError('Solver spec materials must be an array.')
  const roles = new Set<string>()
  const materials: readonly SolverMaterialSpec[] = spec.materials
  materials.forEach((material, index) => {
    const path = `Solver spec materials[${index}]`
    assertNonEmpty(material.role, `${path}.role`)
    if (roles.has(material.role)) throw new CadModelError(`Solver spec Material role ${material.role} is duplicated.`)
    roles.add(material.role)
    assertNonEmpty(material.description, `${path}.description`)
    const category = material.target.category as SolverRuleCategory
    if (!['initializations', 'boundaryConditions', 'recordedData'].includes(category)) {
      throw new CadModelError(`${path}.target.category is not supported.`)
    }
    const targetMethod = spec.methods[category].find((method) => method.methodId === material.target.methodId)
    if (!targetMethod) throw new CadModelError(`${path}.target references an unknown methodId.`)
    assertMaterialParameterSpecs(material.parameters, `${path}.parameters`)
  })
}

function addIssue(
  issues: SolverValidationIssue[],
  documentType: SolverValidationIssue['documentType'],
  path: string,
  message: string,
) {
  issues.push(Object.freeze({ documentType, path, message }))
}

function validateBounds(
  value: number,
  bounds: SolverNumericBounds,
  path: string,
  documentType: SolverValidationIssue['documentType'],
  issues: SolverValidationIssue[],
) {
  if (bounds.minimum !== undefined) {
    const invalid = bounds.exclusiveMinimum ? value <= bounds.minimum : value < bounds.minimum
    if (invalid) addIssue(
      issues,
      documentType,
      path,
      `must be ${bounds.exclusiveMinimum ? 'greater than' : 'greater than or equal to'} ${bounds.minimum}.`,
    )
  }
  if (bounds.maximum !== undefined) {
    const invalid = bounds.exclusiveMaximum ? value >= bounds.maximum : value > bounds.maximum
    if (invalid) addIssue(
      issues,
      documentType,
      path,
      `must be ${bounds.exclusiveMaximum ? 'less than' : 'less than or equal to'} ${bounds.maximum}.`,
    )
  }
}

function quantityValue(
  value: Readonly<Record<string, unknown>>,
  spec: Readonly<{
    quantityKind: QuantityKindName
    referenceUnit: string
    referenceBasis?: unknown
  }>,
  path: string,
  documentType: SolverValidationIssue['documentType'],
  issues: SolverValidationIssue[],
) {
  if (value.quantityKind !== spec.quantityKind) {
    addIssue(issues, documentType, `${path}.quantityKind`, `must be ${spec.quantityKind}.`)
    return undefined
  }
  if (typeof value.unit !== 'string') {
    addIssue(issues, documentType, `${path}.unit`, `must be applicable to ${spec.quantityKind}.`)
    return undefined
  }
  const units = QuantityKind[spec.quantityKind].applicableUnits() as readonly string[]
  if (!units.includes(value.unit)) {
    addIssue(issues, documentType, `${path}.unit`, `${value.unit} is not applicable to ${spec.quantityKind}.`)
    return undefined
  }
  const tensorOrder = QuantityKind[spec.quantityKind].tensorOrder()
  if (tensorOrder === 0) {
    if (value.basis !== undefined) {
      addIssue(issues, documentType, `${path}.basis`, 'is forbidden for a scalar Quantity Kind.')
      return undefined
    }
  } else if (JSON.stringify(value.basis) !== JSON.stringify(spec.referenceBasis)) {
    addIssue(issues, documentType, `${path}.basis`, 'must exactly match the solver referenceBasis.')
    return undefined
  }
  if (typeof value.value !== 'number' || !Number.isFinite(value.value)) return undefined
  try {
    if (tensorOrder > 0 && convertUcumValue(0, value.unit, spec.referenceUnit, path) !== 0) {
      throw new CadModelError('Tensor unit conversion must preserve zero.')
    }
    return convertUcumValue(value.value, value.unit, spec.referenceUnit, path)
  } catch {
    addIssue(
      issues,
      documentType,
      `${path}.unit`,
      `${value.unit} cannot be transformed to reference unit ${spec.referenceUnit}.`,
    )
    return undefined
  }
}

function validateAxis(
  value: unknown,
  spec: SolverAxisSpec | SolverResultAxisSpec,
  axisIndex: number,
  path: string,
  documentType: SolverValidationIssue['documentType'],
  issues: SolverValidationIssue[],
) {
  if (!isRecord(value)) {
    addIssue(issues, documentType, path, 'must be an axis descriptor.')
    return
  }
  if (value.length !== spec.length) {
    const expected = spec.length === undefined ? 'dynamic' : String(spec.length)
    addIssue(issues, documentType, `${path}.length`, `must be ${expected}.`)
  }
  const expectedName = spec.name ?? `axis ${axisIndex}`
  const actualName = value.name ?? `axis ${axisIndex}`
  if (actualName !== expectedName) {
    addIssue(issues, documentType, `${path}.name`, `must be ${expectedName}.`)
  }
  if (spec.ticks !== undefined && JSON.stringify(value.ticks) !== JSON.stringify(spec.ticks)) {
    addIssue(issues, documentType, `${path}.ticks`, `must be ${JSON.stringify(spec.ticks)}.`)
  }
  if (spec.quantityKind === undefined) {
    if (value.quantityKind !== undefined || value.unit !== undefined) {
      addIssue(issues, documentType, path, 'must be unitless.')
    }
    return
  }
  quantityValue({ ...value, value: 0 }, spec, path, documentType, issues)
}

function dataLeaves(
  value: unknown,
  path: string,
): readonly Readonly<{ path: string; value: unknown }>[] {
  if (!Array.isArray(value)) return [{ path, value }]
  return value.flatMap((item, index) => dataLeaves(item, `${path}[${index}]`))
}

function validateDescriptor(
  value: unknown,
  spec: SolverValueSpec,
  path: string,
  documentType: SolverValidationIssue['documentType'],
  issues: SolverValidationIssue[],
) {
  if (!isRecord(value)) {
    addIssue(issues, documentType, path, 'must be a dtype descriptor.')
    return
  }
  const obsoleteField = ['type', 'shape', 'dimension', 'sampleDimension', 'sampleShape', 'sampleAxes']
    .find((field) => Object.prototype.hasOwnProperty.call(value, field))
  if (obsoleteField) {
    addIssue(issues, documentType, `${path}.${obsoleteField}`, 'is obsolete in the dtype/axes contract.')
  }
  if (value.dtype !== spec.dtype) addIssue(issues, documentType, `${path}.dtype`, `must be ${spec.dtype}.`)
  const quantitySpec = spec as SolverValueSpec & {
    quantityKind: QuantityKindName
    referenceUnit: string
    referenceBasis?: unknown
  }
  if (isFloatDType(spec.dtype)) {
    quantityValue({ ...value, value: 0 }, quantitySpec, path, documentType, issues)
  }
  else if (value.quantityKind !== undefined || value.unit !== undefined || value.basis !== undefined) {
    addIssue(issues, documentType, path, 'must be unitless for a non-float dtype.')
  }
  const axes = value.axes
  if (spec.axes === undefined) {
    if (axes !== undefined) addIssue(issues, documentType, `${path}.axes`, 'must be omitted for a single value.')
  } else if (!Array.isArray(axes) || axes.length !== spec.axes.length) {
    addIssue(issues, documentType, `${path}.axes`, `must contain ${spec.axes.length} axes.`)
  } else {
    spec.axes.forEach((axis, index) => validateAxis(
      axes[index],
      axis,
      index,
      `${path}.axes[${index}]`,
      documentType,
      issues,
    ))
  }

  if (!Object.prototype.hasOwnProperty.call(value, 'value')) {
    addIssue(issues, documentType, `${path}.value`, 'is required.')
    return
  }
  dataLeaves(value.value, `${path}.value`).forEach((leaf) => {
    try {
      normalizeDataElement(leaf.value, spec.dtype, leaf.path)
    } catch (error) {
      addIssue(issues, documentType, leaf.path, error instanceof Error ? error.message.replace(`${leaf.path} `, '') : 'is invalid.')
      return
    }
    if (spec.dtype === 'string') {
      const stringValue = leaf.value as string
      if (spec.minimumLength !== undefined && stringValue.length < spec.minimumLength) {
        addIssue(issues, documentType, leaf.path, `must contain at least ${spec.minimumLength} characters.`)
      }
      if (spec.values && !spec.values.includes(stringValue)) {
        addIssue(issues, documentType, leaf.path, `must be one of ${spec.values.join(', ')}.`)
      }
      return
    }
    if (spec.dtype === 'bool') return
    let comparable = leaf.value as number
    if (isFloatDType(spec.dtype)) {
      const transformed = quantityValue({ ...value, value: comparable }, quantitySpec, path, documentType, [])
      if (transformed === undefined) return
      comparable = transformed
    }
    validateBounds(comparable, spec, leaf.path, documentType, issues)
  })
}

function validateValue(
  value: unknown,
  spec: SolverValueSpec,
  path: string,
  documentType: SolverValidationIssue['documentType'],
  issues: SolverValidationIssue[],
) {
  if (isRecord(value)) {
    validateDescriptor(value, spec, path, documentType, issues)
    return
  }
  if (Array.isArray(value) || value === null) {
    addIssue(issues, documentType, path, 'raw composite values are forbidden; use a dtype descriptor with axes.')
    return
  }
  if (spec.axes !== undefined) {
    addIssue(issues, documentType, path, 'must be a dtype descriptor with axes.')
    return
  }
  if (spec.dtype === 'bool') {
    if (typeof value !== 'boolean') addIssue(issues, documentType, path, 'must be boolean.')
    return
  }
  if (spec.dtype === 'string') {
    if (typeof value !== 'string') {
      addIssue(issues, documentType, path, 'must be a string.')
      return
    }
    if (spec.minimumLength !== undefined && value.length < spec.minimumLength) {
      addIssue(issues, documentType, path, `must contain at least ${spec.minimumLength} characters.`)
    }
    if (spec.values && !spec.values.includes(value)) {
      addIssue(issues, documentType, path, `must be one of ${spec.values.join(', ')}.`)
    }
    return
  }
  if (isFloatDType(spec.dtype)) {
    addIssue(issues, documentType, path, 'must be an explicit float dtype descriptor.')
    return
  }
  try {
    normalizeDataElement(value, spec.dtype, path)
  } catch {
    addIssue(issues, documentType, path, `must be a ${spec.dtype} safe integer.`)
    return
  }
  validateBounds(value as number, spec, path, documentType, issues)
}

function validateResult(
  value: unknown,
  spec: SolverResultValueSpec,
  path: string,
  documentType: SolverValidationIssue['documentType'],
  issues: SolverValidationIssue[],
) {
  if (!isRecord(value)) {
    addIssue(issues, documentType, path, 'must be a dtype result descriptor.')
    return
  }
  const obsoleteField = ['type', 'shape', 'dimension', 'sampleDimension', 'sampleShape', 'sampleAxes']
    .find((field) => Object.prototype.hasOwnProperty.call(value, field))
  if (obsoleteField) {
    addIssue(issues, documentType, `${path}.${obsoleteField}`, 'is obsolete in the dtype/axes contract.')
  }
  if (value.dtype !== spec.dtype) addIssue(issues, documentType, `${path}.dtype`, `must be ${spec.dtype}.`)
  if (isFloatDType(spec.dtype)) {
    quantityValue(value, spec as SolverResultValueSpec & {
      quantityKind: QuantityKindName
      referenceUnit: string
      referenceBasis?: unknown
    }, path, documentType, issues)
  } else if (value.quantityKind !== undefined || value.unit !== undefined || value.basis !== undefined) {
    addIssue(issues, documentType, path, 'must be unitless for a non-float dtype.')
  }

  const axes = value.axes
  if (spec.axes === undefined) {
    if (axes !== undefined) addIssue(issues, documentType, `${path}.axes`, 'must be omitted for a single value.')
  } else if (!Array.isArray(axes) || axes.length !== spec.axes.length) {
    addIssue(issues, documentType, `${path}.axes`, `must contain ${spec.axes.length} axes.`)
  } else {
    spec.axes.forEach((axis, index) => validateAxis(
      axes[index],
      axis,
      index,
      `${path}.axes[${index}]`,
      documentType,
      issues,
    ))
  }
}

function validateParameters(
  values: Readonly<Record<string, unknown>>,
  specs: Readonly<Record<string, SolverParameterSpec>>,
  path: string,
  documentType: SolverValidationIssue['documentType'],
  issues: SolverValidationIssue[],
) {
  Object.entries(specs).forEach(([key, spec]) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      if (spec.required !== false) addIssue(issues, documentType, `${path}.${key}`, 'is required.')
      return
    }
    validateValue(values[key], spec.value, `${path}.${key}`, documentType, issues)
  })
}

function validateMaterialParameters(
  values: Readonly<Record<string, unknown>>,
  specs: SolverMaterialParameterMap,
  path: string,
  documentType: SolverValidationIssue['documentType'],
  issues: SolverValidationIssue[],
) {
  Object.entries(specs).forEach(([key, spec]) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      if (spec.required !== false) addIssue(issues, documentType, `${path}.${key}`, 'is required.')
      return
    }
    if (Object.prototype.hasOwnProperty.call(materialParameterByKey, key)) {
      const quantityKind = materialParameterByKey[key as MaterialPropertyKey].quantity_kind
      validateValue(values[key], {
        ...spec.value,
        quantityKind,
      } as SolverValueSpec, `${path}.${key}`, documentType, issues)
      return
    }

    const modelKey = key as MaterialModelKey
    const definition = materialModelByKey[modelKey]
    const valuePath = `${path}.${key}`
    if (!isRecord(values[key])) {
      addIssue(issues, documentType, valuePath, 'must be a sampled relation.')
      return
    }
    try {
      const relation = normalizeMaterialSampledRelation(modelKey, values[key], valuePath)
      const relationSpec = spec.value as Readonly<{
        input: Readonly<{ referenceBasis?: unknown }>
        output: Readonly<{ referenceBasis?: unknown }>
      }>
      if (JSON.stringify(relation.input.basis) !== JSON.stringify(relationSpec.input.referenceBasis)) {
        addIssue(issues, documentType, `${valuePath}.input.basis`, 'must match the solver referenceBasis.')
      }
      if (JSON.stringify(relation.output.basis) !== JSON.stringify(relationSpec.output.referenceBasis)) {
        addIssue(issues, documentType, `${valuePath}.output.basis`, 'must match the solver referenceBasis.')
      }
      if (relation.input.values.length < definition.minimum_samples) {
        addIssue(issues, documentType, valuePath, `must contain at least ${definition.minimum_samples} samples.`)
      }
    } catch (error) {
      addIssue(
        issues,
        documentType,
        valuePath,
        error instanceof Error ? error.message : 'must be a valid sampled relation.',
      )
    }
  })
}

function ruleList(rules: EvaluatedExperimentRules, category: SolverRuleCategory) {
  return rules[category] as readonly (ExperimentRule | RecordedDataRule)[]
}

function resolvedParts(
  scene: CadScene,
  kind: 'geometry' | 'surface',
  ids: readonly string[],
) {
  if (kind === 'geometry') {
    return ids.flatMap((id) => scene.parts.find((part) => part.id === id) ?? [])
  }
  return ids.flatMap((id) => scene.parts.find((part) => part.surfaces.some((surface) => surface.id === id)) ?? [])
}

function validateRuleTarget(
  rule: ExperimentRule,
  spec: SolverMethodSpec,
  path: string,
  input: SolverPreflightInput,
  issues: SolverValidationIssue[],
  report = true,
): readonly CadScenePart[] {
  const target = spec.target
  const scene = target.source === 'structure' ? input.structure?.scene : input.experiment.scene
  if (rule.target.length < target.minimumTargets || rule.target.length > target.maximumTargets) {
    if (report) addIssue(
      issues,
      'experiment',
      `${path}.target`,
      `must contain between ${target.minimumTargets} and ${target.maximumTargets} targets.`,
    )
    return []
  }
  const resolvedIds = new Set<string>()
  for (const [index, entry] of rule.target.entries()) {
    const prefix = `${target.source}.${target.kind}.`
    if (!entry.startsWith(prefix)) {
      if (report) addIssue(issues, 'experiment', `${path}.target[${index}]`, `must target ${prefix}<group>.`)
      continue
    }
    if (!scene) continue
    const groupName = entry.slice(prefix.length)
    const groups = target.kind === 'geometry' ? scene.geometryGroups : scene.surfaceGroups
    const group = groups.find((candidate) => candidate.name === groupName)
    if (!group) {
      if (report) addIssue(issues, target.source, `${path}.target[${index}]`, `references missing ${entry}.`)
      continue
    }
    if (group.missingMemberIds.length > 0 && report) {
      addIssue(
        issues,
        target.source,
        `${path}.target[${index}]`,
        `contains missing members: ${group.missingMemberIds.join(', ')}.`,
      )
    }
    const ids = target.kind === 'geometry' ? group.geometryIds : group.surfaceIds
    ids.forEach((id) => resolvedIds.add(id))
  }
  if (scene && (
    resolvedIds.size < target.minimumResolved
    || resolvedIds.size > target.maximumResolved
  )) {
    if (report) addIssue(
      issues,
      target.source,
      `${path}.target`,
      `must resolve between ${target.minimumResolved} and ${target.maximumResolved} ${target.kind} items; received ${resolvedIds.size}.`,
    )
  }
  return scene ? resolvedParts(scene, target.kind, [...resolvedIds]) : []
}

function validateMethod(
  category: SolverRuleCategory,
  method: SolverMethodSpec,
  rules: readonly (ExperimentRule | RecordedDataRule)[],
  input: SolverPreflightInput,
  issues: SolverValidationIssue[],
) {
  const matches = rules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => rule.methodId === method.methodId)
  if (matches.length < method.minimumOccurrences || matches.length > method.maximumOccurrences) {
    addIssue(
      issues,
      'experiment',
      `rules.${category}.${method.methodId}`,
      `requires between ${method.minimumOccurrences} and ${method.maximumOccurrences} occurrences; received ${matches.length}.`,
    )
  }
  matches.forEach(({ rule, index }) => {
    const path = `rules.${category}[${index}]`
    validateParameters(rule.parameters, method.parameters, `${path}.parameters`, 'experiment', issues)
    validateRuleTarget(rule, method, path, input, issues)
    if (category === 'recordedData' && method.result) {
      validateResult((rule as RecordedDataRule).result, method.result, `${path}.result`, 'experiment', issues)
    }
  })
}

function validateMaterial(
  material: SolverMaterialSpec,
  spec: SolverSpec,
  input: SolverPreflightInput,
  issues: SolverValidationIssue[],
) {
  const methods = spec.methods[material.target.category]
  const method = methods.find((candidate) => candidate.methodId === material.target.methodId)!
  const rules = ruleList(input.experiment.rules, material.target.category)
  const parts = new Map<string, CadScenePart>()
  rules.forEach((rule, index) => {
    if (rule.methodId !== material.target.methodId) return
    validateRuleTarget(
      rule,
      method,
      `rules.${material.target.category}[${index}]`,
      input,
      issues,
      false,
    ).forEach((part) => parts.set(part.id, part))
  })
  parts.forEach((part) => {
    const path = `${method.target.source}.parts.${part.id}.material`
    if (!part.material) {
      addIssue(issues, method.target.source, path, `is required for Material role ${material.role}.`)
      return
    }
    validateMaterialParameters(
      part.material.variables,
      material.parameters,
      `${path}.variables`,
      method.target.source,
      issues,
    )
  })
}

export function validateSolverContract(spec: SolverSpec, input: SolverPreflightInput): SolverValidationResult {
  const issues: SolverValidationIssue[] = []
  validateParameters(input.experiment.solver.parameters, spec.parameters, 'solver.parameters', 'experiment', issues)

  ;(['initializations', 'boundaryConditions', 'recordedData'] as const).forEach((category) => {
    const rules = ruleList(input.experiment.rules, category)
    const methods = spec.methods[category]
    rules.forEach((rule, index) => {
      if (!methods.some((method) => method.methodId === rule.methodId)) {
        addIssue(issues, 'experiment', `rules.${category}[${index}].methodId`, `${rule.methodId} is not registered.`)
      }
    })
    methods.forEach((method) => validateMethod(category, method, rules, input, issues))
  })

  if (input.structure) spec.materials.forEach((material) => validateMaterial(material, spec, input, issues))
  return Object.freeze({
    complete: input.structure !== undefined,
    issues: Object.freeze(issues),
    spec,
  })
}

export function assertValidSolverContract(spec: SolverSpec, input: SolverPreflightInput) {
  const result = validateSolverContract(spec, input)
  if (result.issues.length === 0) return
  throw new CadModelError([
    `Solver spec validation failed for ${spec.name}@${spec.version}:`,
    ...result.issues.map((issue) => `- ${issue.path}: ${issue.message}`),
  ].join('\n'))
}
