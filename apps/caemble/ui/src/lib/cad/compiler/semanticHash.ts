import { parse } from '@babel/parser'
import type { CadSourceDocumentV2 } from '../source/document'
import { compileCadDocument } from './monacoCompiler'
import type { CompiledCadProjectV2 } from './types'

const ignoredAstFields = new Set([
  'comments',
  'end',
  'errors',
  'extra',
  'innerComments',
  'leadingComments',
  'loc',
  'start',
  'tokens',
  'trailingComments',
])

function canonicalAstValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalAstValue)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !ignoredAstFields.has(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalAstValue(item)]),
  )
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function rawCodeHash(code: string) {
  return sha256(code)
}

export async function compiledCadSemanticHash(project: CompiledCadProjectV2) {
  const modules = Object.entries(project.modules)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, module]) => {
      const code = module.code.replace(/\r?\n\/\/# sourceURL=caemble:\/\/[^\r\n]+\/?$/, '')
      const ast = parse(code, { attachComment: false, sourceType: 'script' })
      return [path, canonicalAstValue(ast.program)]
    })
  return sha256(JSON.stringify(modules))
}

export async function cadSemanticHash(document: CadSourceDocumentV2) {
  return compiledCadSemanticHash(await compileCadDocument(document))
}
