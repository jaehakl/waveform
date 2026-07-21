import type { Expression, ObjectExpression, ObjectMethod, ObjectProperty } from '@babel/types'
import {
  analyzeCadSourceV2,
  resolveSourceBinding as resolveBinding,
  sourceExpression as expressionArgument,
  unwrapSourceExpression as unwrapExpression,
} from './sourceAnalysis'

export type ExperimentRuleCategory = 'initializations' | 'boundaryConditions' | 'recordedData'

export type ExperimentTensorSourceInfo = Readonly<{
  editable: boolean
  bindingName?: string
  reason?: string
  shared: boolean
}>

export type ExperimentTensorSourceUpdate = Readonly<{
  edits: readonly Readonly<{ start: number; end: number; text: string }>[]
  source: string
  bindingName?: string
  shared: boolean
}>

export class ExperimentParameterSourceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExperimentParameterSourceError'
  }
}

function propertyName(property: ObjectExpression['properties'][number]) {
  if (property.type === 'SpreadElement' || property.computed) return null
  if (property.key.type === 'Identifier') return property.key.name
  if (property.key.type === 'StringLiteral') return property.key.value
  return null
}

function activeExperimentSource(source: string) {
  try {
    const analysis = analyzeCadSourceV2(source, 'experiment')
    if (analysis.options.properties.some((property) => property.type === 'SpreadElement' || property.computed)) {
      throw new ExperimentParameterSourceError(
        'The active experiment uses spread or computed options, so parameter editing is read-only.',
      )
    }
    return analysis
  } catch (error) {
    throw new ExperimentParameterSourceError(
      error instanceof Error ? error.message : 'The Experiment source could not be parsed.',
    )
  }
}

function objectProperty(
  object: ObjectExpression,
  name: string,
  label: string,
): ObjectProperty | ObjectMethod {
  const properties = object.properties.filter((property) => propertyName(property) === name)
  if (properties.length !== 1 || properties[0].type === 'SpreadElement') {
    throw new ExperimentParameterSourceError(`${label} must contain exactly one ${name} property.`)
  }
  return properties[0]
}

function propertyExpression(property: ObjectProperty | ObjectMethod, label: string) {
  if (property.type !== 'ObjectProperty') {
    throw new ExperimentParameterSourceError(`${label} must be an object property.`)
  }
  return expressionArgument(property.value, label)
}

function returnedExpression(property: ObjectProperty | ObjectMethod, label: string): Expression {
  if (property.type === 'ObjectMethod') {
    const returns = property.body.body.filter((statement) => statement.type === 'ReturnStatement')
    if (returns.length !== 1 || !returns[0].argument) {
      throw new ExperimentParameterSourceError(`${label} must have one static return value.`)
    }
    return expressionArgument(returns[0].argument, `${label} return value`)
  }

  const factory = unwrapExpression(propertyExpression(property, label))
  if (factory.type !== 'ArrowFunctionExpression' && factory.type !== 'FunctionExpression') {
    throw new ExperimentParameterSourceError(`${label} must be an inline function for parameter editing.`)
  }
  if (factory.body.type !== 'BlockStatement') return expressionArgument(factory.body, `${label} return value`)
  const returns = factory.body.body.filter((statement) => statement.type === 'ReturnStatement')
  if (returns.length !== 1 || !returns[0].argument) {
    throw new ExperimentParameterSourceError(`${label} must have one static return value.`)
  }
  return expressionArgument(returns[0].argument, `${label} return value`)
}

function countIdentifiers(value: unknown, name: string): number {
  if (!value || typeof value !== 'object') return 0
  if (Array.isArray(value)) return value.reduce((count, item) => count + countIdentifiers(item, name), 0)
  const record = value as Record<string, unknown>
  const ownMatch = record.type === 'Identifier' && record.name === name ? 1 : 0
  return Object.entries(record).reduce((count, [key, item]) => (
    key === 'loc' || key === 'start' || key === 'end'
      ? count
      : count + countIdentifiers(item, name)
  ), ownMatch)
}

function tensorValueSource(
  source: string,
  category: ExperimentRuleCategory,
  ruleIndex: number,
  parameterKey: string,
) {
  const { ast, bindings, options } = activeExperimentSource(source)
  const categoryProperty = objectProperty(options, category, `Experiment ${category}`)
  const rules = resolveBinding(returnedExpression(categoryProperty, `Experiment ${category}`), bindings).expression
  if (rules.type !== 'ArrayExpression') {
    throw new ExperimentParameterSourceError(`Experiment ${category} must return a static array for parameter editing.`)
  }
  const ruleElement = rules.elements[ruleIndex]
  if (!ruleElement) throw new ExperimentParameterSourceError(`Experiment ${category}[${ruleIndex}] could not be found.`)
  const rule = resolveBinding(expressionArgument(ruleElement, `Experiment ${category}[${ruleIndex}]`), bindings).expression
  if (rule.type !== 'ObjectExpression') {
    throw new ExperimentParameterSourceError(`Experiment ${category}[${ruleIndex}] must be a static object.`)
  }
  const parameters = resolveBinding(
    propertyExpression(
      objectProperty(rule, 'parameters', `Experiment ${category}[${ruleIndex}]`),
      `Experiment ${category}[${ruleIndex}].parameters`,
    ),
    bindings,
  ).expression
  if (parameters.type !== 'ObjectExpression') {
    throw new ExperimentParameterSourceError(`Experiment ${category}[${ruleIndex}].parameters must be a static object.`)
  }
  const descriptor = resolveBinding(
    propertyExpression(
      objectProperty(
        parameters,
        parameterKey,
        `Experiment ${category}[${ruleIndex}].parameters`,
      ),
      `Experiment ${category}[${ruleIndex}].parameters.${parameterKey}`,
    ),
    bindings,
  ).expression
  if (descriptor.type !== 'ObjectExpression') {
    throw new ExperimentParameterSourceError(
      `Experiment ${category}[${ruleIndex}].parameters.${parameterKey} must be a static tensor descriptor.`,
    )
  }
  const value = resolveBinding(
    propertyExpression(
      objectProperty(
        descriptor,
        'value',
        `Experiment ${category}[${ruleIndex}].parameters.${parameterKey}`,
      ),
      `Experiment ${category}[${ruleIndex}].parameters.${parameterKey}.value`,
    ),
    bindings,
  )
  if (value.expression.type !== 'ArrayExpression') {
    throw new ExperimentParameterSourceError(
      'Tensor values must use an inline array or a top-level const array to be edited here.',
    )
  }
  if (typeof value.expression.start !== 'number' || typeof value.expression.end !== 'number') {
    throw new ExperimentParameterSourceError('The tensor array source position could not be determined.')
  }
  return {
    bindingName: value.bindingName,
    end: value.expression.end,
    shared: value.bindingName ? countIdentifiers(ast.program, value.bindingName) > 2 : false,
    start: value.expression.start,
  }
}

export function inspectExperimentTensorSource(
  source: string,
  category: ExperimentRuleCategory,
  ruleIndex: number,
  parameterKey: string,
): ExperimentTensorSourceInfo {
  try {
    const resolved = tensorValueSource(source, category, ruleIndex, parameterKey)
    return {
      editable: true,
      bindingName: resolved.bindingName,
      shared: resolved.shared,
    }
  } catch (error) {
    return {
      editable: false,
      reason: error instanceof Error ? error.message : 'The tensor source could not be traced statically.',
      shared: false,
    }
  }
}

export function updateExperimentTensorSource(
  source: string,
  category: ExperimentRuleCategory,
  ruleIndex: number,
  parameterKey: string,
  value: unknown,
): ExperimentTensorSourceUpdate {
  if (!Array.isArray(value)) {
    throw new ExperimentParameterSourceError('A parameter tensor value must be a JSON array.')
  }
  const resolved = tensorValueSource(source, category, ruleIndex, parameterKey)
  const serialized = JSON.stringify(value, null, 2)
  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  const lineStart = source.lastIndexOf('\n', Math.max(0, resolved.start - 1)) + 1
  const continuationIndent = ' '.repeat(resolved.start - lineStart)
  const text = serialized.replace(/\n/g, `${newline}${continuationIndent}`)
  const edits = [{ start: resolved.start, end: resolved.end, text }]
  return {
    bindingName: resolved.bindingName,
    edits,
    shared: resolved.shared,
    source: `${source.slice(0, edits[0].start)}${edits[0].text}${source.slice(edits[0].end)}`,
  }
}
