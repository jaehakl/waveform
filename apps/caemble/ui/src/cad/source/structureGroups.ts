import type { Expression, ObjectExpression } from '@babel/types'
import type { StructureGroupMap } from '../model/core'
import type { CadDocumentType } from '../worker/protocol'
import {
  analyzeCadSourceV2,
  resolveSourceBinding,
  sourceExpression,
} from './sourceAnalysis'

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

function findObjectOptions(source: string, documentType: CadDocumentType) {
  try {
    return analyzeCadSourceV2(source, documentType)
  } catch (error) {
    throw new StructureGroupSyncError(error instanceof Error ? error.message : 'The Code Space source could not be parsed.')
  }
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
  bindings: ReadonlyMap<string, Expression>,
  objectName: 'experiment' | 'structure',
  target: StructureGroupProperty,
  groups: StructureGroupMap,
) {
  if (options.properties.some((property) => property.type === 'SpreadElement' || property.computed)) {
    throw new StructureGroupSyncError(
      `The active ${objectName} uses spread or computed options, so group editing is read-only.`,
    )
  }
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
    const resolved = resolveSourceBinding(
      sourceExpression(property.value, `${target} value`),
      bindings,
    ).expression
    if (resolved.type !== 'ObjectExpression') {
      throw new StructureGroupSyncError(
        `${target} must be an object literal or a directly connected top-level const object for group editing.`,
      )
    }
    const valueStart = position(resolved.start, `${target} value`)
    const valueEnd = position(resolved.end, `${target} value`)
    const propertyIndent = lineIndent(source, valueStart)
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
  const { bindings, factoryName, options } = findObjectOptions(source, documentType)
  const edits = propertyEdits(source, options, bindings, factoryName, target, groups)
  return {
    edits,
    source: applySourceEdits(source, edits),
  }
}
