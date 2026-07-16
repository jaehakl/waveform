import { parse } from '@babel/parser'
import type { Expression, ObjectExpression, ObjectMethod, ObjectProperty, Statement } from '@babel/types'

export type ExperimentRuleCategory = 'initializations' | 'boundaryConditions' | 'recordedData'

export type ExperimentTensorSourceInfo = Readonly<{
  editable: boolean
  bindingName?: string
  reason?: string
  shared: boolean
}>

export type ExperimentTensorSourceUpdate = Readonly<{
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

function unwrapExpression(expression: Expression): Expression {
  if (
    expression.type === 'TSAsExpression'
    || expression.type === 'TSSatisfiesExpression'
    || expression.type === 'TSNonNullExpression'
    || expression.type === 'TypeCastExpression'
  ) {
    return unwrapExpression(expression.expression)
  }
  return expression
}

function expressionArgument(value: unknown, label: string): Expression {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    throw new ExperimentParameterSourceError(`${label} could not be resolved to a source expression.`)
  }
  const type = String(value.type)
  if (type === 'SpreadElement' || type === 'ArgumentPlaceholder') {
    throw new ExperimentParameterSourceError(`${label} cannot use a spread or argument placeholder.`)
  }
  return value as Expression
}

function propertyName(property: ObjectExpression['properties'][number]) {
  if (property.type === 'SpreadElement' || property.computed) return null
  if (property.key.type === 'Identifier') return property.key.name
  if (property.key.type === 'StringLiteral') return property.key.value
  return null
}

function importedName(statement: Statement, imported: 'Experiment' | 'Setup') {
  if (statement.type !== 'ImportDeclaration' || statement.source.value !== '@caemble/core') return []
  return statement.specifiers.flatMap((specifier) => {
    if (specifier.type !== 'ImportSpecifier') return []
    const name = specifier.imported.type === 'Identifier' ? specifier.imported.name : specifier.imported.value
    return name === imported ? [specifier.local.name] : []
  })
}

function collectBindings(statements: readonly Statement[]) {
  const bindings = new Map<string, Expression>()
  statements.forEach((statement) => {
    if (statement.type !== 'VariableDeclaration' || statement.kind !== 'const') return
    statement.declarations.forEach((declaration) => {
      if (declaration.id.type !== 'Identifier' || !declaration.init) return
      bindings.set(declaration.id.name, expressionArgument(declaration.init, declaration.id.name))
    })
  })
  return bindings
}

function resolveBinding(
  expression: Expression,
  bindings: ReadonlyMap<string, Expression>,
  visited = new Set<string>(),
): { expression: Expression; bindingName?: string } {
  const unwrapped = unwrapExpression(expression)
  if (unwrapped.type !== 'Identifier') return { expression: unwrapped }
  if (visited.has(unwrapped.name)) {
    throw new ExperimentParameterSourceError(`Circular source binding detected at ${unwrapped.name}.`)
  }
  const bound = bindings.get(unwrapped.name)
  if (!bound) return { expression: unwrapped }
  visited.add(unwrapped.name)
  const resolved = resolveBinding(bound, bindings, visited)
  return {
    expression: resolved.expression,
    bindingName: resolved.bindingName ?? unwrapped.name,
  }
}

function requireConstructor(expression: Expression, names: ReadonlySet<string>, label: 'Experiment' | 'Setup') {
  if (expression.type !== 'NewExpression' || expression.callee.type !== 'Identifier' || !names.has(expression.callee.name)) {
    throw new ExperimentParameterSourceError(`The active default export ${label} constructor could not be traced statically.`)
  }
  return expression
}

function activeExperimentSource(source: string) {
  let ast
  try {
    ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
  } catch (error) {
    throw new ExperimentParameterSourceError(
      error instanceof Error ? error.message : 'The Experiment source could not be parsed.',
    )
  }

  const statements = ast.program.body
  const setupNames = new Set(statements.flatMap((statement) => importedName(statement, 'Setup')))
  const experimentNames = new Set(statements.flatMap((statement) => importedName(statement, 'Experiment')))
  if (setupNames.size === 0 || experimentNames.size === 0) {
    throw new ExperimentParameterSourceError('Setup and Experiment must be named imports from @caemble/core.')
  }

  const defaultExports = statements.filter((statement) => statement.type === 'ExportDefaultDeclaration')
  if (defaultExports.length !== 1) {
    throw new ExperimentParameterSourceError('Exactly one default export is required for parameter editing.')
  }
  const declaration = defaultExports[0].declaration
  if (declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration' || declaration.type === 'TSDeclareFunction') {
    throw new ExperimentParameterSourceError('The default export must resolve to a Setup expression.')
  }

  const bindings = collectBindings(statements)
  const setup = requireConstructor(
    resolveBinding(declaration, bindings).expression,
    setupNames,
    'Setup',
  )
  const experimentArgument = setup.arguments[0]
  if (!experimentArgument) throw new ExperimentParameterSourceError('The active Setup does not have an Experiment argument.')
  const experiment = requireConstructor(
    resolveBinding(expressionArgument(experimentArgument, 'Setup Experiment'), bindings).expression,
    experimentNames,
    'Experiment',
  )
  const optionsArgument = experiment.arguments[0]
  if (!optionsArgument) throw new ExperimentParameterSourceError('The active Experiment does not have an options object.')
  const options = resolveBinding(expressionArgument(optionsArgument, 'Experiment options'), bindings).expression
  if (options.type !== 'ObjectExpression') {
    throw new ExperimentParameterSourceError(
      'The active Experiment options must be an object literal or a top-level const object literal.',
    )
  }
  return { ast, bindings, options }
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
  return {
    bindingName: resolved.bindingName,
    shared: resolved.shared,
    source: `${source.slice(0, resolved.start)}${text}${source.slice(resolved.end)}`,
  }
}
