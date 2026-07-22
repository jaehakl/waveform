import { geometries, transforms } from '@jscad/modeling'
import type { CadScene, CadSceneMaterial, CadSceneTreeNode } from '../cad/evaluation/types'
import {
  isFloatDType,
  type DataValueDescriptor,
  type EvaluatedExperimentRules,
  type ExperimentRule,
  type RecordedData,
  type RecordedDataResult,
  type RecordedDataRule,
  type ResolvedExperimentSolver,
  type ResolvedMaterialVariables,
  type SolverParameterValue,
} from '../cad/model/core'
import { normalizeRecordedData } from '../cad/model/recordedData'
import { convertUcumValue, type UcumUnit } from '../cad/model/units'
import {
  materialModelByKey,
  materialParameterByKey,
  type MaterialModelKey,
  type MaterialPropertyKey,
} from '../material/data'
import {
  getQuantityKindComponentShape,
  transformQuantityValue,
  type CartesianBasis,
  type QuantityKindName,
} from '../quantitykind/runtime'
import type {
  SolverMaterialPropertyValueSpec,
  SolverMaterialRelationValueSpec,
  SolverMethodSpec,
  SolverParameterSpec,
  SolverResultValueSpec,
  SolverRuleCategory,
  SolverSpec,
  SolverValueSpec,
} from './spec'
import type { SolverModuleInput } from './types'

type QuantityTarget = Readonly<{
  quantityKind: QuantityKindName
  referenceUnit: UcumUnit
  referenceBasis?: CartesianBasis
}>

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function transformOuterQuantityValue(
  value: unknown,
  outerRank: number,
  target: QuantityTarget,
  source: Readonly<{ unit: UcumUnit; basis?: CartesianBasis }>,
  path: string,
  depth = 0,
): unknown {
  if (depth === outerRank) {
    return transformQuantityValue(
      value,
      getQuantityKindComponentShape(target.quantityKind),
      source,
      { unit: target.referenceUnit, basis: target.referenceBasis },
      path,
    )
  }
  return Object.freeze(
    (value as readonly unknown[]).map((item, index) =>
      transformOuterQuantityValue(item, outerRank, target, source, `${path}[${index}]`, depth + 1),
    ),
  )
}

function transformTicks(
  ticks: readonly (number | string)[] | undefined,
  sourceUnit: UcumUnit,
  targetUnit: UcumUnit,
  path: string,
) {
  if (ticks === undefined) return undefined
  return Object.freeze(
    ticks.map((tick, index) =>
      typeof tick === 'number' ? convertUcumValue(tick, sourceUnit, targetUnit, `${path}[${index}]`) : tick,
    ),
  )
}

function transformDataDescriptor(
  descriptor: DataValueDescriptor,
  spec: SolverValueSpec,
  path: string,
): DataValueDescriptor {
  if (!isFloatDType(spec.dtype)) return descriptor
  const target = spec as SolverValueSpec & QuantityTarget
  const source = descriptor as DataValueDescriptor & {
    unit: UcumUnit
    basis?: CartesianBasis
  }
  const axes = descriptor.axes?.map((axis, axisIndex) => {
    const axisSpec = spec.axes?.[axisIndex]
    if (axisSpec?.quantityKind === undefined || axis.quantityKind === undefined) return axis
    const ticks = transformTicks(axis.ticks, axis.unit, axisSpec.referenceUnit, `${path}.axes[${axisIndex}].ticks`)
    return Object.freeze({
      length: axis.length,
      name: axis.name,
      ...(ticks === undefined ? {} : { ticks }),
      unit: axisSpec.referenceUnit,
      quantityKind: axisSpec.quantityKind,
    })
  })
  return Object.freeze({
    dtype: descriptor.dtype,
    value: transformOuterQuantityValue(
      descriptor.value,
      descriptor.axes?.length ?? 0,
      target,
      { unit: source.unit, basis: source.basis },
      `${path}.value`,
    ),
    ...(axes === undefined ? {} : { axes: Object.freeze(axes) }),
    unit: target.referenceUnit,
    quantityKind: target.quantityKind,
    ...(target.referenceBasis === undefined ? {} : { basis: target.referenceBasis }),
  }) as DataValueDescriptor
}

function transformParameters(
  parameters: Readonly<Record<string, SolverParameterValue>>,
  specs: Readonly<Record<string, SolverParameterSpec>>,
  path: string,
) {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(parameters).map(([key, value]) => {
        const spec = specs[key]
        if (!spec || !isRecord(value)) return [key, value]
        return [key, transformDataDescriptor(value as DataValueDescriptor, spec.value, `${path}.${key}`)]
      }),
    ),
  )
}

function transformResultSchema(
  result: RecordedDataResult,
  spec: SolverResultValueSpec,
  path: string,
): RecordedDataResult {
  if (!isFloatDType(spec.dtype)) return result
  const target = spec as SolverResultValueSpec & QuantityTarget
  const axes = result.axes?.map((axis, axisIndex) => {
    const axisSpec = spec.axes?.[axisIndex]
    if (axisSpec?.quantityKind === undefined || axis.quantityKind === undefined) return axis
    const ticks = transformTicks(axis.ticks, axis.unit, axisSpec.referenceUnit, `${path}.axes[${axisIndex}].ticks`)
    return Object.freeze({
      ...(axis.length === undefined ? {} : { length: axis.length }),
      name: axis.name,
      ...(ticks === undefined ? {} : { ticks }),
      unit: axisSpec.referenceUnit,
      quantityKind: axisSpec.quantityKind,
    })
  })
  return Object.freeze({
    dtype: result.dtype,
    ...(axes === undefined ? {} : { axes: Object.freeze(axes) }),
    unit: target.referenceUnit,
    quantityKind: target.quantityKind,
    ...(target.referenceBasis === undefined ? {} : { basis: target.referenceBasis }),
  }) as RecordedDataResult
}

function transformRule(
  rule: ExperimentRule | RecordedDataRule,
  method: SolverMethodSpec,
  category: SolverRuleCategory,
  path: string,
) {
  const transformed = {
    target: rule.target,
    label: rule.label,
    methodId: rule.methodId,
    parameters: transformParameters(rule.parameters, method.parameters, `${path}.parameters`),
  }
  if (category !== 'recordedData') return Object.freeze(transformed) as ExperimentRule
  return Object.freeze({
    ...transformed,
    result: transformResultSchema((rule as RecordedDataRule).result, method.result!, `${path}.result`),
  }) as RecordedDataRule
}

function transformRules(rules: EvaluatedExperimentRules, spec: SolverSpec) {
  return Object.freeze(
    Object.fromEntries(
      (['initializations', 'boundaryConditions', 'recordedData'] as const).map((category) => [
        category,
        Object.freeze(
          rules[category].map((rule, index) => {
            const method = spec.methods[category].find((candidate) => candidate.methodId === rule.methodId)!
            return transformRule(rule, method, category, `experiment.rules.${category}[${index}]`)
          }),
        ),
      ]),
    ),
  ) as EvaluatedExperimentRules
}

function materialTargets(spec: SolverSpec) {
  const targets = new Map<
    string,
    SolverMaterialPropertyValueSpec<MaterialPropertyKey> | SolverMaterialRelationValueSpec<MaterialModelKey>
  >()
  spec.materials.forEach((material) => {
    Object.entries(material.parameters).forEach(([key, parameter]) => {
      if (!targets.has(key)) targets.set(key, parameter.value)
    })
  })
  return targets
}

function transformMaterial(
  material: CadSceneMaterial,
  targets: ReturnType<typeof materialTargets>,
  path: string,
): CadSceneMaterial {
  const variables: Record<string, unknown> = {}
  Object.entries(material.variables).forEach(([key, value]) => {
    const target = targets.get(key)
    if (!target || key === 'color') {
      variables[key] = value
      return
    }
    if (Object.prototype.hasOwnProperty.call(materialParameterByKey, key)) {
      const quantityKind = materialParameterByKey[key as MaterialPropertyKey].quantity_kind
      const propertySpec = target as SolverMaterialPropertyValueSpec<MaterialPropertyKey>
      variables[key] = transformDataDescriptor(
        value as DataValueDescriptor,
        {
          ...propertySpec,
          quantityKind,
        } as SolverValueSpec,
        `${path}.variables.${key}`,
      )
      return
    }

    const modelKey = key as MaterialModelKey
    const definition = materialModelByKey[modelKey]
    const relation = value as ResolvedMaterialVariables[MaterialModelKey] & {
      input: Readonly<{ unit: UcumUnit; basis?: CartesianBasis; values: readonly unknown[] }>
      output: Readonly<{ unit: UcumUnit; basis?: CartesianBasis; values: readonly unknown[] }>
    }
    const relationSpec = target as SolverMaterialRelationValueSpec<MaterialModelKey>
    variables[key] = Object.freeze({
      kind: 'sampled_relation',
      input: Object.freeze({
        unit: relationSpec.input.referenceUnit,
        ...(relationSpec.input.referenceBasis === undefined ? {} : { basis: relationSpec.input.referenceBasis }),
        values: transformOuterQuantityValue(
          relation.input.values,
          1,
          {
            quantityKind: definition.input.quantity_kind,
            referenceUnit: relationSpec.input.referenceUnit,
            referenceBasis: relationSpec.input.referenceBasis,
          },
          { unit: relation.input.unit, basis: relation.input.basis },
          `${path}.variables.${key}.input.values`,
        ),
      }),
      output: Object.freeze({
        unit: relationSpec.output.referenceUnit,
        ...(relationSpec.output.referenceBasis === undefined ? {} : { basis: relationSpec.output.referenceBasis }),
        values: transformOuterQuantityValue(
          relation.output.values,
          1,
          {
            quantityKind: definition.output.quantity_kind,
            referenceUnit: relationSpec.output.referenceUnit,
            referenceBasis: relationSpec.output.referenceBasis,
          },
          { unit: relation.output.unit, basis: relation.output.basis },
          `${path}.variables.${key}.output.values`,
        ),
      }),
    })
  })
  return Object.freeze({
    name: material.name,
    ...(material.source === undefined ? {} : { source: material.source }),
    ...(material.version === undefined ? {} : { version: material.version }),
    ...(material.errorRate === undefined ? {} : { errorRate: material.errorRate }),
    variables: Object.freeze(variables) as ResolvedMaterialVariables,
  })
}

function cloneTree(node: CadSceneTreeNode): CadSceneTreeNode {
  return {
    ...node,
    ...(node.geometryIds === undefined ? {} : { geometryIds: [...node.geometryIds] }),
    children: node.children.map(cloneTree),
  }
}

function transformScene(
  scene: CadScene,
  spec: SolverSpec,
  targets: ReturnType<typeof materialTargets>,
  path: string,
): CadScene {
  const scale = convertUcumValue(1, scene.lengthUnit, spec.referenceLengthUnit, `${path}.lengthUnit`)
  return {
    lengthUnit: spec.referenceLengthUnit,
    parts: scene.parts.map((part, partIndex) => {
      const geometry = transforms.scale([scale, scale, scale], part.geometry as never)
      geometries.geom3.toPolygons(geometry).forEach((polygon) => geometries.poly3.plane(polygon))
      return {
        id: part.id,
        geometry,
        ...(part.material === undefined
          ? {}
          : { material: transformMaterial(part.material, targets, `${path}.parts[${partIndex}].material`) }),
        surfaces: part.surfaces.map((surface) => ({
          ...surface,
          polygonIndices: [...surface.polygonIndices],
        })),
      }
    }),
    tree: cloneTree(scene.tree),
    geometryGroups: scene.geometryGroups.map((group) => ({
      ...group,
      memberIds: [...group.memberIds],
      geometryIds: [...group.geometryIds],
      surfaceIds: [...group.surfaceIds],
      missingMemberIds: [...group.missingMemberIds],
    })),
    surfaceGroups: scene.surfaceGroups.map((group) => ({
      ...group,
      memberIds: [...group.memberIds],
      geometryIds: [...group.geometryIds],
      surfaceIds: [...group.surfaceIds],
      missingMemberIds: [...group.missingMemberIds],
    })),
  }
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== 'object' || value === null || seen.has(value) || ArrayBuffer.isView(value)) {
    return value
  }
  seen.add(value)
  Reflect.ownKeys(value).forEach((key) => {
    deepFreeze((value as Record<PropertyKey, unknown>)[key], seen)
  })
  return Object.freeze(value)
}

export function transformSolverInput(input: SolverModuleInput, spec: SolverSpec): SolverModuleInput {
  const targets = materialTargets(spec)
  const rules = transformRules(input.experiment.rules, spec)
  const solver: ResolvedExperimentSolver = Object.freeze({
    name: input.experiment.solver.name,
    version: input.experiment.solver.version,
    parameters: transformParameters(
      input.experiment.solver.parameters,
      spec.parameters,
      'experiment.solver.parameters',
    ),
  })
  return deepFreeze({
    structure: {
      ...input.structure,
      scene: transformScene(input.structure.scene, spec, targets, 'structure.scene'),
    },
    experiment: {
      ...input.experiment,
      scene: transformScene(input.experiment.scene, spec, targets, 'experiment.scene'),
      rules,
      solver,
    },
  }) as SolverModuleInput
}

function restoreResultValue(
  value: unknown,
  solverResult: RecordedDataResult,
  authorResult: RecordedDataResult,
  path: string,
) {
  if (!isFloatDType(authorResult.dtype)) return value
  const target = authorResult as RecordedDataResult & {
    quantityKind: QuantityKindName
    unit: UcumUnit
    basis?: CartesianBasis
  }
  return transformOuterQuantityValue(
    value,
    authorResult.axes?.length ?? 0,
    {
      quantityKind: target.quantityKind,
      referenceUnit: target.unit,
      referenceBasis: target.basis,
    },
    {
      unit: (solverResult as RecordedDataResult & { unit: UcumUnit }).unit,
      basis: (solverResult as RecordedDataResult & { basis?: CartesianBasis }).basis,
    },
    path,
  )
}

export function restoreAuthoringRecordedData(
  solverData: RecordedData,
  solverRules: readonly RecordedDataRule[],
  authorRules: readonly RecordedDataRule[],
): RecordedData {
  const solverRuleByLabel = new Map(solverRules.map((rule) => [rule.label, rule]))
  const restored = Object.fromEntries(
    authorRules.map((authorRule) => {
      const solverRule = solverRuleByLabel.get(authorRule.label)!
      const payload = solverData[authorRule.label]
      const axes = payload.axes?.map((axis, axisIndex) => {
        const authorAxis = authorRule.result.axes?.[axisIndex]
        const solverAxis = solverRule.result.axes?.[axisIndex]
        if (!authorAxis || !solverAxis || authorAxis.quantityKind === undefined) return axis
        const ticks =
          authorAxis.length !== undefined && authorAxis.ticks !== undefined
            ? authorAxis.ticks
            : transformTicks(
                axis.ticks,
                (solverAxis as typeof solverAxis & { unit: UcumUnit }).unit,
                authorAxis.unit,
                `recordedData[${JSON.stringify(authorRule.label)}].axes[${axisIndex}].ticks`,
              )
        return Object.freeze({ ...(ticks === undefined ? {} : { ticks }) })
      })
      return [
        authorRule.label,
        Object.freeze({
          value: restoreResultValue(
            payload.value,
            solverRule.result,
            authorRule.result,
            `recordedData[${JSON.stringify(authorRule.label)}].value`,
          ),
          ...(axes === undefined ? {} : { axes: Object.freeze(axes) }),
        }),
      ]
    }),
  )
  return normalizeRecordedData(authorRules, restored)
}
