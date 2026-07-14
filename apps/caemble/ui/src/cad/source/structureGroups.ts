import { parse } from '@babel/parser'
import type { Expression, ObjectExpression, Statement } from '@babel/types'
import type { StructureGroupMap } from '../model/core'
import type { CadDocumentType } from '../worker/protocol'

export type StructureGroupProperty = 'geometryGroup' | 'surfaceGroup'

export type StructureGroupSourceEdit = Readonly<{
  start: number
  end: number
  text: string
}>

export type StructureGroupSourceUpdate = Readonly<{
  edits: readonly StructureGroupSourceEdit[]
  source: string
}>

export class StructureGroupSyncError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StructureGroupSyncError'
  }
}

function unwrapExpression(expression: Expression): Expression {
  if (
    expression.type === 'TSAsExpression' ||
    expression.type === 'TSSatisfiesExpression' ||
    expression.type === 'TSNonNullExpression' ||
    expression.type === 'TypeCastExpression'
  ) {
    return unwrapExpression(expression.expression)
  }
  return expression
}

function expressionArgument(value: unknown, label: string) {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    throw new StructureGroupSyncError(`${label} could not be resolved to a source expression.`)
  }
  const nodeType = String(value.type)
  if (nodeType === 'SpreadElement' || nodeType === 'ArgumentPlaceholder') {
    throw new StructureGroupSyncError(`${label} cannot use a spread or argument placeholder.`)
  }
  return value as Expression
}

function resolveBinding(
  expression: Expression,
  bindings: ReadonlyMap<string, Expression>,
  visited = new Set<string>(),
): Expression {
  const unwrapped = unwrapExpression(expression)
  if (unwrapped.type !== 'Identifier') return unwrapped
  if (visited.has(unwrapped.name)) {
    throw new StructureGroupSyncError(`Circular source binding detected at ${unwrapped.name}.`)
  }
  const bound = bindings.get(unwrapped.name)
  if (!bound) return unwrapped
  visited.add(unwrapped.name)
  return resolveBinding(bound, bindings, visited)
}

type CoreConstructorName = 'Experiment' | 'Sample' | 'Setup' | 'Structure'

function importedName(statement: Statement, imported: CoreConstructorName) {
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

function requireConstructor(
  expression: Expression,
  names: ReadonlySet<string>,
  label: CoreConstructorName,
) {
  if (expression.type !== 'NewExpression' || expression.callee.type !== 'Identifier' || !names.has(expression.callee.name)) {
    throw new StructureGroupSyncError(`The active default export ${label} constructor could not be traced statically.`)
  }
  return expression
}

function findObjectOptions(source: string, documentType: CadDocumentType) {
  let ast
  try {
    ast = parse(source, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    })
  } catch (error) {
    throw new StructureGroupSyncError(error instanceof Error ? error.message : 'The Code Space source could not be parsed.')
  }

  const statements = ast.program.body
  const variableObjectName: 'Sample' | 'Setup' = documentType === 'structure' ? 'Sample' : 'Setup'
  const objectName: 'Experiment' | 'Structure' = documentType === 'structure' ? 'Structure' : 'Experiment'
  const variableObjectNames = new Set(
    statements.flatMap((statement) => importedName(statement, variableObjectName)),
  )
  const objectNames = new Set(statements.flatMap((statement) => importedName(statement, objectName)))
  if (variableObjectNames.size === 0 || objectNames.size === 0) {
    throw new StructureGroupSyncError(
      `${variableObjectName} and ${objectName} must be named imports from @caemble/core.`,
    )
  }

  const defaultExports = statements.filter((statement) => statement.type === 'ExportDefaultDeclaration')
  if (defaultExports.length !== 1) {
    throw new StructureGroupSyncError('Exactly one default export is required for group synchronization.')
  }

  const declaration = defaultExports[0].declaration
  if (declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration' || declaration.type === 'TSDeclareFunction') {
    throw new StructureGroupSyncError(`The default export must resolve to a ${variableObjectName} expression.`)
  }

  const bindings = collectBindings(statements)
  const variableObject = requireConstructor(
    resolveBinding(declaration, bindings),
    variableObjectNames,
    variableObjectName,
  )
  const objectArgument = variableObject.arguments[0]
  if (!objectArgument) {
    throw new StructureGroupSyncError(
      `The active ${variableObjectName} does not have an ${objectName} argument.`,
    )
  }
  const object = requireConstructor(
    resolveBinding(expressionArgument(objectArgument, `${variableObjectName} ${objectName}`), bindings),
    objectNames,
    objectName,
  )
  const optionsArgument = object.arguments[0]
  if (!optionsArgument) throw new StructureGroupSyncError(`The active ${objectName} does not have an options object.`)
  const options = resolveBinding(expressionArgument(optionsArgument, `${objectName} options`), bindings)
  if (options.type !== 'ObjectExpression') {
    throw new StructureGroupSyncError(
      `The active ${objectName} options must be an object literal or a top-level const object literal.`,
    )
  }
  return { objectName, options }
}

function propertyName(property: ObjectExpression['properties'][number]) {
  if (property.type === 'SpreadElement') return null
  if (property.computed) return null
  if (property.key.type === 'Identifier') return property.key.name
  if (property.key.type === 'StringLiteral') return property.key.value
  return null
}

function lineIndent(source: string, index: number) {
  const lineStart = source.lastIndexOf('\n', Math.max(0, index - 1)) + 1
  return source.slice(lineStart, index).match(/^[\t ]*/)?.[0] ?? ''
}

function newlineFor(source: string) {
  return source.includes('\r\n') ? '\r\n' : '\n'
}

function serializeGroups(groups: StructureGroupMap, propertyIndent: string, newline: string, indentUnit: string) {
  const entries = Object.entries(groups)
  if (entries.length === 0) return '{}'
  const memberIndent = `${propertyIndent}${indentUnit}`
  return `{${newline}${entries.map(([name, memberIds]) => (
    `${memberIndent}${JSON.stringify(name)}: [${memberIds.map((id) => JSON.stringify(id)).join(', ')}],`
  )).join(newline)}${newline}${propertyIndent}}`
}

function applySourceEdits(source: string, edits: readonly StructureGroupSourceEdit[]) {
  return [...edits]
    .sort((left, right) => right.start - left.start)
    .reduce((current, edit) => `${current.slice(0, edit.start)}${edit.text}${current.slice(edit.end)}`, source)
}

function position(value: number | null | undefined, label: string) {
  if (typeof value !== 'number') throw new StructureGroupSyncError(`Missing source position for ${label}.`)
  return value
}

function propertyEdits(
  source: string,
  options: ObjectExpression,
  objectName: 'Experiment' | 'Structure',
  target: StructureGroupProperty,
  groups: StructureGroupMap,
) {
  const matching = options.properties.filter((property) => propertyName(property) === target)
  if (matching.length > 1) {
    throw new StructureGroupSyncError(`The active ${objectName} contains duplicate ${target} properties.`)
  }

  const newline = newlineFor(source)
  const closingIndex = position(options.end, `${objectName} options`) - 1
  const closingIndent = lineIndent(source, closingIndex)
  const firstProperty = options.properties[0]
  const existingPropertyIndent = firstProperty?.start === null || firstProperty?.start === undefined
    ? ''
    : lineIndent(source, firstProperty.start)
  const indentUnit = existingPropertyIndent.startsWith(closingIndent) && existingPropertyIndent.length > closingIndent.length
    ? existingPropertyIndent.slice(closingIndent.length)
    : '  '

  if (matching.length === 1) {
    const property = matching[0]
    if (property.type !== 'ObjectProperty') {
      throw new StructureGroupSyncError(`${target} must be an object property.`)
    }
    const propertyIndent = lineIndent(source, position(property.start, target))
    const valueStart = position(property.value.start, `${target} value`)
    const valueEnd = position(property.value.end, `${target} value`)
    return [{
      start: valueStart,
      end: valueEnd,
      text: serializeGroups(groups, propertyIndent, newline, indentUnit),
    }]
  }

  const propertyIndent = `${closingIndent}${indentUnit}`
  const serialized = serializeGroups(groups, propertyIndent, newline, indentUnit)
  const edits: StructureGroupSourceEdit[] = []
  const lastProperty = options.properties[options.properties.length - 1]
  if (!lastProperty) {
    edits.push({
      start: closingIndex,
      end: closingIndex,
      text: `${newline}${propertyIndent}${target}: ${serialized},${newline}${closingIndent}`,
    })
    return edits
  }

  const lastEnd = position(lastProperty.end, 'last Structure property')
  const betweenLastAndClosing = source.slice(lastEnd, closingIndex)
  if (!betweenLastAndClosing.trimStart().startsWith(',')) {
    edits.push({ start: lastEnd, end: lastEnd, text: ',' })
  }

  const isMultiline = source.slice(position(options.start, `${objectName} options`), closingIndex).includes('\n')
  edits.push({
    start: closingIndex,
    end: closingIndex,
    text: isMultiline
      ? `${indentUnit}${target}: ${serialized},${newline}${closingIndent}`
      : `${newline}${propertyIndent}${target}: ${serialized},${newline}${closingIndent}`,
  })
  return edits
}

export function updateStructureGroupSource(
  source: string,
  target: StructureGroupProperty,
  groups: StructureGroupMap,
): StructureGroupSourceUpdate {
  return updateModelGroupSource(source, 'structure', target, groups)
}

export function updateModelGroupSource(
  source: string,
  documentType: CadDocumentType,
  target: StructureGroupProperty,
  groups: StructureGroupMap,
): StructureGroupSourceUpdate {
  const { objectName, options } = findObjectOptions(source, documentType)
  const edits = propertyEdits(source, options, objectName, target, groups)
  return {
    edits,
    source: applySourceEdits(source, edits),
  }
}
