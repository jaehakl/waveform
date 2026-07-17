import type { CadScene, CadScenePart } from '../cad/evaluation/types'
import {
  CadModelError,
  isExperimentFloatDType,
  type EvaluatedExperimentRules,
  type ExperimentRule,
  type RecordedDataRule,
} from '../cad/model/core'
import { normalizeUcumUnit } from '../cad/model/units'
import { QuantityKind } from '../quantitykind'
import type { QuantityKindName } from '../quantitykind/runtime'
import type {
  SolverAxisSpec,
  SolverMaterialSpec,
  SolverMethodSpec,
  SolverNumericBounds,
  SolverParameterSpec,
  SolverRuleCategory,
  SolverSpec,
  SolverTensorValueSpec,
  SolverValidationIssue,
  SolverValidationResult,
  SolverValueSpec,
} from './spec'
import type { SolverPreflightInput } from './types'

const tensorDTypes = new Set([
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

function assertQuantitySpec(value: Readonly<{ quantityKind: unknown; referenceUnit: unknown }>, path: string) {
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
}

function assertAxisSpec(axis: SolverAxisSpec, path: string) {
  assertNonEmpty(axis.name, `${path}.name`)
  if (axis.ticks !== undefined && !Array.isArray(axis.ticks)) {
    throw new CadModelError(`${path}.ticks must be an array.`)
  }
  axis.ticks?.forEach((tick, index) => {
    if (typeof tick !== 'string' && (typeof tick !== 'number' || !Number.isFinite(tick))) {
      throw new CadModelError(`${path}.ticks[${index}] must be a string or finite number.`)
    }
  })
  const hasQuantity = axis.quantityKind !== undefined || axis.referenceUnit !== undefined
  if (hasQuantity) assertQuantitySpec(axis as SolverAxisSpec & { quantityKind: unknown; referenceUnit: unknown }, path)
}

function assertValueSpec(value: SolverValueSpec, path: string, allowDynamicShape = false) {
  if (!isRecord(value) || typeof value.type !== 'string') {
    throw new CadModelError(`${path} must be a value spec.`)
  }
  if (value.description !== undefined) assertNonEmpty(value.description, `${path}.description`)

  if (value.type === 'null' || value.type === 'boolean') return
  if (value.type === 'string') {
    if (value.minimumLength !== undefined && (!Number.isSafeInteger(value.minimumLength) || value.minimumLength < 0)) {
      throw new CadModelError(`${path}.minimumLength must be a non-negative safe integer.`)
    }
    if (value.values !== undefined) {
      if (!Array.isArray(value.values) || value.values.length === 0 || value.values.some((item) => typeof item !== 'string')) {
        throw new CadModelError(`${path}.values must be a non-empty string array.`)
      }
      if (new Set(value.values).size !== value.values.length) {
        throw new CadModelError(`${path}.values must not contain duplicates.`)
      }
    }
    return
  }
  if (value.type === 'integer') {
    assertBounds(value, path)
    return
  }
  if (value.type === 'float') {
    assertQuantitySpec(value, path)
    assertBounds(value, path)
    return
  }
  if (value.type === 'array') {
    if (value.minimumLength !== undefined || value.maximumLength !== undefined) {
      assertCardinality(value.minimumLength ?? 0, value.maximumLength ?? Number.MAX_SAFE_INTEGER, path)
    }
    assertValueSpec(value.items, `${path}.items`)
    return
  }
  if (value.type === 'object') {
    assertParameterSpecs(value.parameters, `${path}.parameters`)
    return
  }
  if (value.type !== 'tensor') throw new CadModelError(`${path}.type is not supported.`)
  if (!Number.isSafeInteger(value.dimension) || value.dimension < 0 || value.shape.length !== value.dimension) {
    throw new CadModelError(`${path} must declare a non-negative dimension matching shape.`)
  }
  value.shape.forEach((size, index) => {
    if (!Number.isSafeInteger(size) || (size <= 0 && !(allowDynamicShape && size === -1))) {
      throw new CadModelError(`${path}.shape[${index}] must be a positive safe integer${allowDynamicShape ? ' or -1' : ''}.`)
    }
  })
  if (!tensorDTypes.has(value.dtype)) throw new CadModelError(`${path}.dtype is not supported.`)
  if (isExperimentFloatDType(value.dtype)) {
    assertQuantitySpec(value as SolverTensorValueSpec & { quantityKind: unknown; referenceUnit: unknown }, path)
  }
  else if (value.quantityKind !== undefined || value.referenceUnit !== undefined) {
    throw new CadModelError(`${path} non-float tensor must not declare quantity metadata.`)
  }
  if (value.axes !== undefined) {
    if (value.axes.length !== value.dimension) throw new CadModelError(`${path}.axes must match dimension.`)
    value.axes.forEach((axis, index) => assertAxisSpec(axis, `${path}.axes[${index}]`))
  }
  if (value.element !== undefined) assertBounds(value.element, `${path}.element`)
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
    assertParameterSpecs(material.parameters, `${path}.parameters`)
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
  spec: Readonly<{ quantityKind: QuantityKindName; referenceUnit: string }>,
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
  if (typeof value.value !== 'number' || !Number.isFinite(value.value)) return undefined
  try {
    return QuantityKind[spec.quantityKind].transform(
      value.value,
      value.unit as never,
      spec.referenceUnit as never,
    )
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

function scalarDescriptor(value: unknown, type: 'bool' | 'string' | 'int') {
  return isRecord(value) && value.type === type ? value.value : value
}

function validateAxis(
  value: unknown,
  spec: SolverAxisSpec,
  path: string,
  documentType: SolverValidationIssue['documentType'],
  issues: SolverValidationIssue[],
) {
  if (!isRecord(value)) {
    addIssue(issues, documentType, path, 'must be an axis descriptor.')
    return
  }
  if (value.name !== spec.name) addIssue(issues, documentType, `${path}.name`, `must be ${spec.name}.`)
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

function tensorElements(value: unknown): number[] {
  if (Array.isArray(value)) return value.flatMap(tensorElements)
  return typeof value === 'number' ? [value] : []
}

function validateTensor(
  value: unknown,
  spec: SolverTensorValueSpec,
  path: string,
  documentType: SolverValidationIssue['documentType'],
  issues: SolverValidationIssue[],
) {
  if (!isRecord(value) || value.type !== 'tensor') {
    addIssue(issues, documentType, path, 'must be a tensor descriptor.')
    return
  }
  if (value.dtype !== spec.dtype) addIssue(issues, documentType, `${path}.dtype`, `must be ${spec.dtype}.`)
  if (value.dimension !== spec.dimension) {
    addIssue(issues, documentType, `${path}.dimension`, `must be ${spec.dimension}.`)
  }
  if (JSON.stringify(value.shape) !== JSON.stringify(spec.shape)) {
    addIssue(issues, documentType, `${path}.shape`, `must be ${JSON.stringify(spec.shape)}.`)
  }
  const quantitySpec = spec as SolverTensorValueSpec & {
    quantityKind: QuantityKindName
    referenceUnit: string
  }
  if (isExperimentFloatDType(spec.dtype)) {
    quantityValue({ ...value, value: 0 }, quantitySpec, path, documentType, issues)
  }
  else if (value.quantityKind !== undefined || value.unit !== undefined) {
    addIssue(issues, documentType, path, 'must be unitless for a non-float dtype.')
  }
  if (spec.axes !== undefined) {
    const axes = value.axes
    if (!Array.isArray(axes) || axes.length !== spec.axes.length) {
      addIssue(issues, documentType, `${path}.axes`, `must contain ${spec.axes.length} axes.`)
    } else {
      spec.axes.forEach((axis, index) => validateAxis(
        axes[index],
        axis,
        `${path}.axes[${index}]`,
        documentType,
        issues,
      ))
    }
  }
  if (spec.element !== undefined && Object.prototype.hasOwnProperty.call(value, 'value')) {
    tensorElements(value.value).forEach((element, index) => {
      let comparable = element
      if (isExperimentFloatDType(spec.dtype)) {
        const transformed = quantityValue({ ...value, value: element }, quantitySpec, path, documentType, [])
        if (transformed === undefined) return
        comparable = transformed
      }
      validateBounds(comparable, spec.element!, `${path}.value element ${index}`, documentType, issues)
    })
  }
}

function validateValue(
  value: unknown,
  spec: SolverValueSpec,
  path: string,
  documentType: SolverValidationIssue['documentType'],
  issues: SolverValidationIssue[],
) {
  if (spec.type === 'null') {
    if (value !== null) addIssue(issues, documentType, path, 'must be null.')
    return
  }
  if (spec.type === 'boolean') {
    if (typeof scalarDescriptor(value, 'bool') !== 'boolean') addIssue(issues, documentType, path, 'must be boolean.')
    return
  }
  if (spec.type === 'string') {
    const actual = scalarDescriptor(value, 'string')
    if (typeof actual !== 'string') {
      addIssue(issues, documentType, path, 'must be a string.')
      return
    }
    if (spec.minimumLength !== undefined && actual.length < spec.minimumLength) {
      addIssue(issues, documentType, path, `must contain at least ${spec.minimumLength} characters.`)
    }
    if (spec.values && !spec.values.includes(actual)) {
      addIssue(issues, documentType, path, `must be one of ${spec.values.join(', ')}.`)
    }
    return
  }
  if (spec.type === 'integer') {
    const actual = scalarDescriptor(value, 'int')
    if (typeof actual !== 'number' || !Number.isSafeInteger(actual)) {
      addIssue(issues, documentType, path, 'must be a safe integer.')
      return
    }
    validateBounds(actual, spec, path, documentType, issues)
    return
  }
  if (spec.type === 'float') {
    if (!isRecord(value) || value.type !== 'float' || typeof value.value !== 'number' || !Number.isFinite(value.value)) {
      addIssue(issues, documentType, path, 'must be a finite float descriptor.')
      return
    }
    const comparable = quantityValue(value, spec, path, documentType, issues)
    if (comparable !== undefined) validateBounds(comparable, spec, path, documentType, issues)
    return
  }
  if (spec.type === 'tensor') {
    validateTensor(value, spec, path, documentType, issues)
    return
  }
  if (spec.type === 'array') {
    if (!Array.isArray(value)) {
      addIssue(issues, documentType, path, 'must be an array.')
      return
    }
    if (spec.minimumLength !== undefined && value.length < spec.minimumLength) {
      addIssue(issues, documentType, path, `must contain at least ${spec.minimumLength} items.`)
    }
    if (spec.maximumLength !== undefined && value.length > spec.maximumLength) {
      addIssue(issues, documentType, path, `must contain at most ${spec.maximumLength} items.`)
    }
    value.forEach((item, index) => validateValue(item, spec.items, `${path}[${index}]`, documentType, issues))
    return
  }
  if (!isRecord(value)) {
    addIssue(issues, documentType, path, 'must be an object.')
    return
  }
  validateParameters(value, spec.parameters, path, documentType, issues)
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
      validateTensor((rule as RecordedDataRule).result, method.result, `${path}.result`, 'experiment', issues)
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
    validateParameters(part.material.variables, material.parameters, `${path}.variables`, method.target.source, issues)
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
