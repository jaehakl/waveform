import { parse } from '@babel/parser'
import type { Expression, File, ObjectExpression, Statement } from '@babel/types'
import type { CadDocumentType } from '../worker/protocol'

export class SourceAnalysisV2Error extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SourceAnalysisV2Error'
  }
}

export type SourceAnalysisV2 = Readonly<{
  ast: File
  bindings: ReadonlyMap<string, Expression>
  factoryName: 'experiment' | 'structure'
  options: ObjectExpression
}>

export function unwrapSourceExpression(expression: Expression): Expression {
  if (
    expression.type === 'TSAsExpression'
    || expression.type === 'TSSatisfiesExpression'
    || expression.type === 'TSNonNullExpression'
    || expression.type === 'TypeCastExpression'
  ) {
    return unwrapSourceExpression(expression.expression)
  }
  return expression
}

export function sourceExpression(value: unknown, label: string): Expression {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    throw new SourceAnalysisV2Error(`${label} could not be resolved to a source expression.`)
  }
  const nodeType = String(value.type)
  if (nodeType === 'SpreadElement' || nodeType === 'ArgumentPlaceholder') {
    throw new SourceAnalysisV2Error(`${label} cannot use a spread or argument placeholder.`)
  }
  return value as Expression
}

export function collectSourceBindings(statements: readonly Statement[]) {
  const bindings = new Map<string, Expression>()
  statements.forEach((statement) => {
    if (statement.type !== 'VariableDeclaration' || statement.kind !== 'const') return
    statement.declarations.forEach((declaration) => {
      if (declaration.id.type !== 'Identifier' || !declaration.init) return
      bindings.set(declaration.id.name, sourceExpression(declaration.init, declaration.id.name))
    })
  })
  return bindings
}

export function resolveSourceBinding(
  expression: Expression,
  bindings: ReadonlyMap<string, Expression>,
  visited = new Set<string>(),
): { expression: Expression; bindingName?: string } {
  const unwrapped = unwrapSourceExpression(expression)
  if (unwrapped.type !== 'Identifier') return { expression: unwrapped }
  if (visited.has(unwrapped.name)) {
    throw new SourceAnalysisV2Error(`Circular source binding detected at ${unwrapped.name}.`)
  }
  const bound = bindings.get(unwrapped.name)
  if (!bound) return { expression: unwrapped }
  visited.add(unwrapped.name)
  const resolved = resolveSourceBinding(bound, bindings, visited)
  return {
    expression: resolved.expression,
    bindingName: resolved.bindingName ?? unwrapped.name,
  }
}

function importedFactoryNames(statements: readonly Statement[], factoryName: 'experiment' | 'structure') {
  return new Set(statements.flatMap((statement) => {
    if (
      statement.type !== 'ImportDeclaration'
      || (
        statement.source.value !== '@caemble/core/v2'
        && (factoryName === 'structure' || statement.source.value !== '@caemble/core/v3')
      )
    ) return []
    return statement.specifiers.flatMap((specifier) => {
      if (specifier.type !== 'ImportSpecifier') return []
      const imported = specifier.imported.type === 'Identifier' ? specifier.imported.name : specifier.imported.value
      return imported === factoryName ? [specifier.local.name] : []
    })
  }))
}

function assertImportPolicy(ast: File) {
  ast.program.body.forEach((statement) => {
    const source = statement.type === 'ImportDeclaration'
      || statement.type === 'ExportAllDeclaration'
      || statement.type === 'ExportNamedDeclaration'
      ? statement.source?.value
      : undefined
    if (source === undefined) return
    if (
      source !== '@caemble/core/v2'
      && source !== '@caemble/core/v3'
      && source !== '@caemble/kernels/v1'
      && !source.startsWith('./')
      && !source.startsWith('../')
    ) {
      throw new SourceAnalysisV2Error(`Import is not allowed in a Caemble CAD project: ${source}`)
    }
  })

  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    const node = value as Record<string, unknown>
    if (node.type === 'ImportExpression' || (node.type === 'CallExpression' && (node.callee as { type?: string })?.type === 'Import')) {
      throw new SourceAnalysisV2Error('Dynamic import is not supported in v2 CAD projects.')
    }
    if (
      node.type === 'CallExpression'
      && (node.callee as { name?: string; type?: string })?.type === 'Identifier'
      && (node.callee as { name?: string }).name === 'require'
    ) {
      throw new SourceAnalysisV2Error('Source-level require() is not supported in v2 CAD projects.')
    }
    Object.entries(node).forEach(([key, child]) => {
      if (key !== 'loc' && key !== 'start' && key !== 'end') visit(child)
    })
  }
  visit(ast.program)
}

export function parseCadSourceV2(source: string) {
  let ast: File
  try {
    ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
  } catch (error) {
    throw new SourceAnalysisV2Error(error instanceof Error ? error.message : 'The CAD source could not be parsed.')
  }
  assertImportPolicy(ast)
  return ast
}

export function staticCadSourceImportsV2(source: string) {
  const ast = parseCadSourceV2(source)
  return ast.program.body.flatMap((statement) => {
    if (
      statement.type !== 'ImportDeclaration'
      && statement.type !== 'ExportAllDeclaration'
      && statement.type !== 'ExportNamedDeclaration'
    ) return []
    return statement.source ? [statement.source.value] : []
  })
}

export function analyzeCadSourceV2(source: string, documentType: CadDocumentType): SourceAnalysisV2 {
  const ast = parseCadSourceV2(source)

  const statements = ast.program.body
  if (
    documentType === 'structure'
    && statements.some((statement) => {
      const moduleSource = statement.type === 'ImportDeclaration'
        || statement.type === 'ExportAllDeclaration'
        || statement.type === 'ExportNamedDeclaration'
        ? statement.source?.value
        : undefined
      return moduleSource === '@caemble/core/v3' || moduleSource === '@caemble/kernels/v1'
    })
  ) {
    throw new SourceAnalysisV2Error('Structure Source can only use @caemble/core/v2.')
  }
  const factoryName = documentType === 'structure' ? 'structure' : 'experiment'
  const factoryNames = importedFactoryNames(statements, factoryName)
  if (factoryNames.size === 0) {
    throw new SourceAnalysisV2Error(
      `${factoryName} must be a named import from @caemble/core/v2${documentType === 'experiment' ? ' or @caemble/core/v3' : ''}.`,
    )
  }

  const defaultExports = statements.filter((statement) => statement.type === 'ExportDefaultDeclaration')
  if (defaultExports.length !== 1) {
    throw new SourceAnalysisV2Error('Exactly one default export is required.')
  }
  const declaration = defaultExports[0].declaration
  if (declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration' || declaration.type === 'TSDeclareFunction') {
    throw new SourceAnalysisV2Error(`The default export must resolve to ${factoryName}({...}).`)
  }

  const bindings = collectSourceBindings(statements)
  const factory = resolveSourceBinding(declaration, bindings).expression
  if (factory.type !== 'CallExpression' || factory.callee.type !== 'Identifier' || !factoryNames.has(factory.callee.name)) {
    throw new SourceAnalysisV2Error(`The default export must resolve statically to ${factoryName}({...}).`)
  }
  const optionsArgument = factory.arguments[0]
  if (!optionsArgument) throw new SourceAnalysisV2Error(`${factoryName}() requires an options object.`)
  const options = resolveSourceBinding(sourceExpression(optionsArgument, `${factoryName} options`), bindings).expression
  if (options.type !== 'ObjectExpression') {
    throw new SourceAnalysisV2Error(
      `${factoryName} options must be an object literal or a directly connected top-level const object literal.`,
    )
  }
  return { ast, bindings, factoryName, options }
}
