import { parse } from '@babel/parser'
import type {
  Expression,
  File,
  FunctionExpression,
  Node,
  ObjectExpression,
  ObjectMethod,
  ObjectProperty,
  Statement,
} from '@babel/types'
import type { CadDocumentType } from '../worker/protocol'
import { analyzeCadSourceV2 } from './sourceAnalysis'

type CodemodEdit = Readonly<{ start: number; end: number; text: string }>

export type CadV1CodemodIssue = Readonly<{
  column: number
  line: number
  message: string
}>

export type CadV1CodemodResult = Readonly<{
  converted: boolean
  issues: readonly CadV1CodemodIssue[]
  source: string
}>

function issue(node: Node, message: string): CadV1CodemodIssue {
  return {
    column: (node.loc?.start.column ?? 0) + 1,
    line: node.loc?.start.line ?? 1,
    message,
  }
}

function nodeRange(node: Node, label: string) {
  if (typeof node.start !== 'number' || typeof node.end !== 'number') {
    throw new Error(`Missing source range for ${label}.`)
  }
  return { start: node.start, end: node.end }
}

function propertyName(property: ObjectExpression['properties'][number]) {
  if (property.type === 'SpreadElement' || property.computed) return null
  if (property.key.type === 'Identifier') return property.key.name
  if (property.key.type === 'StringLiteral') return property.key.value
  return null
}

function topLevelBindings(statements: readonly Statement[]) {
  const bindings = new Map<string, Expression>()
  statements.forEach((statement) => {
    if (statement.type !== 'VariableDeclaration' || statement.kind !== 'const') return
    statement.declarations.forEach((declaration) => {
      if (declaration.id.type === 'Identifier' && declaration.init) {
        bindings.set(declaration.id.name, declaration.init)
      }
    })
  })
  return bindings
}

function resolveExpression(expression: Expression, bindings: ReadonlyMap<string, Expression>, seen = new Set<string>()): Expression {
  if (expression.type === 'TSAsExpression' || expression.type === 'TSSatisfiesExpression') {
    return resolveExpression(expression.expression, bindings, seen)
  }
  if (expression.type !== 'Identifier' || !bindings.has(expression.name)) return expression
  if (seen.has(expression.name)) return expression
  seen.add(expression.name)
  return resolveExpression(bindings.get(expression.name)!, bindings, seen)
}

function objectProperty(object: ObjectExpression, name: string) {
  const matching = object.properties.filter((property) => propertyName(property) === name)
  return matching.length === 1 && matching[0].type !== 'SpreadElement' ? matching[0] : undefined
}

function propertyValue(property: ObjectProperty | ObjectMethod | undefined) {
  if (property?.type !== 'ObjectProperty') return undefined
  if (['ArrayPattern', 'AssignmentPattern', 'ObjectPattern', 'RestElement'].includes(property.value.type)) return undefined
  return property.value as Expression
}

function visitNode(
  value: unknown,
  visitor: (node: Node, parent: Node | null) => void,
  parent: Node | null = null,
) {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item) => visitNode(item, visitor, parent))
    return
  }
  const record = value as Record<string, unknown>
  if (typeof record.type !== 'string') return
  const node = value as Node
  visitor(node, parent)
  Object.entries(record).forEach(([key, child]) => {
    if (!['loc', 'start', 'end', 'leadingComments', 'trailingComments', 'innerComments'].includes(key)) {
      visitNode(child, visitor, node)
    }
  })
}

function callbackEdit(
  source: string,
  callback: FunctionExpression | ObjectMethod | Extract<Expression, { type: 'ArrowFunctionExpression' }>,
) {
  if (callback.params.length > 0) return undefined
  const range = nodeRange(callback, 'model callback')
  const bodyStart = nodeRange(callback.body, 'model callback body').start
  const open = source.indexOf('(', range.start)
  const close = source.lastIndexOf(')', bodyStart)
  if (open < range.start || close < open || close > bodyStart) {
    throw new Error('The callback parameter list could not be located.')
  }
  return { start: open + 1, end: close, text: '{ vars }' }
}

function functionValue(expression: Expression | undefined) {
  if (!expression) return undefined
  return expression.type === 'ArrowFunctionExpression' || expression.type === 'FunctionExpression'
    ? expression
    : undefined
}

export function migrateCadSourceV1ToV2(source: string, documentType: CadDocumentType): CadV1CodemodResult {
  let ast: File
  try {
    ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
  } catch (error) {
    return {
      converted: false,
      issues: [{
        column: 1,
        line: 1,
        message: error instanceof Error ? error.message : 'The v1 source could not be parsed.',
      }],
      source,
    }
  }

  const issues: CadV1CodemodIssue[] = []
  const edits: CodemodEdit[] = []
  const statements = ast.program.body
  const bindings = topLevelBindings(statements)
  const declaredNames = new Set<string>()
  statements.forEach((statement) => {
    if (statement.type === 'VariableDeclaration') {
      statement.declarations.forEach((declaration) => {
        if (declaration.id.type === 'Identifier') declaredNames.add(declaration.id.name)
      })
    } else if (
      (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration')
      && statement.id
    ) {
      declaredNames.add(statement.id.name)
    }
  })

  const constructorFactories = new Map<string, string>()
  const constructorKinds = new Map<string, CadDocumentType>()
  const wrappers = new Map<string, 'experiment' | 'structure'>()
  const globalVarsNames = new Set<string>()
  const coreImports = statements.flatMap((statement) => (
    statement.type === 'ImportDeclaration' && statement.source.value === '@caemble/core'
      ? [statement]
      : []
  ))
  if (coreImports.length === 0) {
    return {
      converted: false,
      issues: [{ column: 1, line: 1, message: 'No @caemble/core v1 import was found.' }],
      source,
    }
  }

  coreImports.forEach((declaration) => {
    const imported: string[] = []
    declaration.specifiers.forEach((specifier) => {
      if (specifier.type !== 'ImportSpecifier') {
        issues.push(issue(specifier, 'Default and namespace @caemble/core imports require manual migration.'))
        return
      }
      const importedName = specifier.imported.type === 'Identifier'
        ? specifier.imported.name
        : specifier.imported.value
      if (importedName === 'vars') {
        globalVarsNames.add(specifier.local.name)
        return
      }
      if (importedName === 'Sample' || importedName === 'Setup') {
        wrappers.set(specifier.local.name, importedName === 'Sample' ? 'structure' : 'experiment')
        return
      }
      if (importedName === 'Structure' || importedName === 'Experiment') {
        const factoryName = importedName === 'Structure' ? 'structure' : 'experiment'
        let localName = factoryName
        let suffix = 2
        if (declaredNames.has(localName)) {
          localName = `define${importedName}V2`
          while (declaredNames.has(localName)) {
            localName = `define${importedName}V2_${suffix}`
            suffix += 1
          }
        }
        declaredNames.add(localName)
        constructorFactories.set(specifier.local.name, localName)
        constructorKinds.set(specifier.local.name, factoryName)
        imported.push(localName === factoryName ? factoryName : `${factoryName} as ${localName}`)
        return
      }
      const typePrefix = declaration.importKind !== 'type' && specifier.importKind === 'type' ? 'type ' : ''
      imported.push(`${typePrefix}${importedName}${specifier.local.name === importedName ? '' : ` as ${specifier.local.name}`}`)
    })
    const range = nodeRange(declaration, '@caemble/core import')
    edits.push({
      ...range,
      text: imported.length > 0
        ? `import${declaration.importKind === 'type' ? ' type' : ''} { ${imported.join(', ')} } from '@caemble/core/v2'`
        : '',
    })
  })

  const callbackRanges: { start: number; end: number }[] = []
  visitNode(ast.program, (node) => {
    if (node.type !== 'NewExpression' || node.callee.type !== 'Identifier') return
    const factoryLocal = constructorFactories.get(node.callee.name)
    if (!factoryLocal) return
    const factoryRange = nodeRange(node.callee, 'v1 constructor')
    edits.push({ start: nodeRange(node, 'v1 constructor').start, end: factoryRange.end, text: factoryLocal })
    const optionsArgument = node.arguments[0]
    if (!optionsArgument || optionsArgument.type === 'SpreadElement' || optionsArgument.type === 'ArgumentPlaceholder') {
      issues.push(issue(node, 'The v1 constructor options could not be resolved statically.'))
      return
    }
    const options = resolveExpression(optionsArgument, bindings)
    if (options.type !== 'ObjectExpression') {
      issues.push(issue(options, 'The v1 constructor must use an object literal or a top-level const object.'))
      return
    }
    const callbacks: (FunctionExpression | ObjectMethod | Extract<Expression, { type: 'ArrowFunctionExpression' }>)[] = []
    const geometryProperty = objectProperty(options, 'geometry')
    if (geometryProperty?.type === 'ObjectMethod') callbacks.push(geometryProperty)
    else {
      const geometry = functionValue(propertyValue(geometryProperty))
      if (geometry) callbacks.push(geometry)
    }
    const constructorKind = constructorKinds.get(node.callee.name)
    if (constructorKind === 'experiment' || documentType === 'experiment') {
      const solverValue = propertyValue(objectProperty(options, 'solver'))
      const solver = solverValue ? resolveExpression(solverValue, bindings) : undefined
      if (solver?.type === 'ObjectExpression') {
        const parametersProperty = objectProperty(solver, 'parameters')
        if (parametersProperty?.type === 'ObjectMethod') callbacks.push(parametersProperty)
        else {
          const parameters = functionValue(propertyValue(parametersProperty))
          if (parameters) callbacks.push(parameters)
        }
      }
      ;(['initializations', 'boundaryConditions', 'recordedData'] as const).forEach((name) => {
        const property = objectProperty(options, name)
        if (property?.type === 'ObjectMethod') callbacks.push(property)
        else {
          const callback = functionValue(propertyValue(property))
          if (callback) callbacks.push(callback)
        }
      })
    }
    callbacks.forEach((callback) => {
      const range = nodeRange(callback, 'model callback')
      callbackRanges.push(range)
      if (callback.params.length > 0) {
        const parameter = callback.params[0]
        const hasVars = parameter.type === 'ObjectPattern' && parameter.properties.some((property) => (
          property.type === 'ObjectProperty'
          && property.key.type === 'Identifier'
          && property.key.name === 'vars'
        ))
        if (!hasVars) issues.push(issue(callback, 'A non-empty callback parameter list requires manual v2 migration.'))
        return
      }
      try {
        const edit = callbackEdit(source, callback)
        if (edit) edits.push(edit)
      } catch (error) {
        issues.push(issue(callback, error instanceof Error ? error.message : 'The callback could not be migrated.'))
      }
    })
  })

  const defaultExports = statements.filter((statement) => statement.type === 'ExportDefaultDeclaration')
  if (defaultExports.length !== 1) {
    issues.push({ column: 1, line: 1, message: 'Exactly one default export is required for v1 migration.' })
  } else {
    const declaration = defaultExports[0].declaration
    if (
      declaration.type === 'NewExpression'
      && declaration.callee.type === 'Identifier'
      && wrappers.has(declaration.callee.name)
    ) {
      const wrapperKind = wrappers.get(declaration.callee.name)!
      const argument = declaration.arguments[0]
      if (wrapperKind !== documentType) {
        issues.push(issue(declaration, `A ${documentType} document cannot export the v1 ${declaration.callee.name} wrapper.`))
      } else if (
        declaration.arguments.length !== 1
        || !argument
        || argument.type === 'SpreadElement'
        || argument.type === 'ArgumentPlaceholder'
        || argument.type === 'NewExpression'
      ) {
        issues.push(issue(
          declaration,
          `${declaration.callee.name} must wrap one named definition without partial vars; move fixed vars to external evaluation input.`,
        ))
      } else {
        edits.push({ ...nodeRange(declaration, 'v1 default wrapper'), text: source.slice(argument.start!, argument.end!) })
      }
    }
  }

  visitNode(ast.program, (node, parent) => {
    if (node.type !== 'Identifier') return
    const isImport = parent?.type === 'ImportSpecifier'
    if (isImport) return
    if (constructorFactories.has(node.name)) {
      const valid = parent?.type === 'NewExpression' && parent.callee === node
      if (!valid) issues.push(issue(node, `${node.name} is used outside a supported constructor call.`))
      return
    }
    if (wrappers.has(node.name)) {
      const valid = parent?.type === 'NewExpression' && parent.callee === node
      if (!valid) issues.push(issue(node, `${node.name} is used outside a supported default wrapper.`))
      return
    }
    if (!globalVarsNames.has(node.name)) return
    const range = nodeRange(node, 'global vars reference')
    const insideCallback = callbackRanges.some((callback) => range.start >= callback.start && range.end <= callback.end)
    if (!insideCallback) {
      issues.push(issue(
        node,
        `Module-level ${node.name} dependency cannot be migrated safely; pass values from the nearest model callback.`,
      ))
    } else if (node.name !== 'vars') {
      edits.push({ ...range, text: 'vars' })
    }
  })

  visitNode(ast.program, (node) => {
    if (node.type !== 'TSAsExpression' || node.expression.type !== 'MemberExpression') return
    const object = node.expression.object
    if (object.type !== 'Identifier' || !globalVarsNames.has(object.name)) return
    const expressionEnd = nodeRange(node.expression, 'vars cast expression').end
    const castEnd = nodeRange(node, 'vars cast').end
    edits.push({ start: expressionEnd, end: castEnd, text: '' })
  })

  if (issues.length > 0) return { converted: false, issues: Object.freeze(issues), source }
  const ordered = [...edits].sort((left, right) => right.start - left.start || right.end - left.end)
  const overlap = ordered.find((edit, index) => index > 0 && edit.end > ordered[index - 1].start)
  if (overlap) {
    return {
      converted: false,
      issues: [issue(ast.program, 'The v1 source produced overlapping edits and requires manual migration.')],
      source,
    }
  }
  const migrated = ordered.reduce(
    (current, edit) => `${current.slice(0, edit.start)}${edit.text}${current.slice(edit.end)}`,
    source,
  )
  try {
    analyzeCadSourceV2(migrated, documentType)
  } catch (error) {
    return {
      converted: false,
      issues: [{
        column: 1,
        line: 1,
        message: `The migrated source did not satisfy v2 policy: ${error instanceof Error ? error.message : String(error)}`,
      }],
      source,
    }
  }
  return { converted: true, issues: Object.freeze([]), source: migrated }
}
