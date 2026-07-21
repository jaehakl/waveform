import { CadModelError } from '../model/core'
import type { Tensor } from '../model/types'
import type { CadDocumentType } from '../worker/protocol'

export const CAD_SOURCE_FORMAT_VERSION = 2 as const
export const CAD_SOURCE_API_VERSION = 2 as const
export const MAX_CAD_SOURCE_FILES = 32
export const MAX_CAD_SOURCE_BYTES = 1024 * 1024

export type CadSourceDocumentV2 = Readonly<{
  kind: CadDocumentType
  formatVersion: typeof CAD_SOURCE_FORMAT_VERSION
  apiVersion: typeof CAD_SOURCE_API_VERSION
  files: Readonly<Record<string, string>>
  entryFile: string
  realizationSeed: number
}>

export type CadEvaluationInputV2 = Readonly<{
  document: CadSourceDocumentV2
  vars?: Readonly<Record<string, Tensor>>
  seed: number
}>

function normalizeProjectPath(path: string) {
  const normalized = path.replace(/\\/g, '/').replace(/^\.\//, '')
  if (
    !normalized
    || normalized.startsWith('/')
    || normalized.includes('../')
    || normalized.split('/').some((segment) => !segment || segment === '.' || segment === '..')
    || !/\.(?:ts|tsx)$/.test(normalized)
  ) {
    throw new CadModelError(`Invalid virtual source path: ${path}`)
  }
  return normalized
}

export function assertCadSourceDocumentV2(value: unknown): asserts value is CadSourceDocumentV2 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CadModelError('CAD source document must be an object.')
  }
  const document = value as Partial<CadSourceDocumentV2>
  if (document.kind !== 'structure' && document.kind !== 'experiment') {
    throw new CadModelError('CAD source document kind must be structure or experiment.')
  }
  if (document.formatVersion !== CAD_SOURCE_FORMAT_VERSION || document.apiVersion !== CAD_SOURCE_API_VERSION) {
    throw new CadModelError('Only CAD source format/API version 2 is supported.')
  }
  if (!Number.isSafeInteger(document.realizationSeed) || document.realizationSeed! < 0) {
    throw new CadModelError('CAD source realizationSeed must be a non-negative safe integer.')
  }
  if (typeof document.files !== 'object' || document.files === null || Array.isArray(document.files)) {
    throw new CadModelError('CAD source document files must be an object.')
  }
  const entries = Object.entries(document.files)
  if (entries.length === 0 || entries.length > MAX_CAD_SOURCE_FILES) {
    throw new CadModelError(`CAD source documents must contain between 1 and ${MAX_CAD_SOURCE_FILES} files.`)
  }
  let sourceBytes = 0
  entries.forEach(([path, source]) => {
    normalizeProjectPath(path)
    if (typeof source !== 'string') throw new CadModelError(`CAD source file ${path} must contain text.`)
    sourceBytes += new TextEncoder().encode(source).byteLength
  })
  if (sourceBytes > MAX_CAD_SOURCE_BYTES) {
    throw new CadModelError(`CAD source project exceeds ${MAX_CAD_SOURCE_BYTES} bytes.`)
  }
  if (typeof document.entryFile !== 'string') {
    throw new CadModelError('CAD source document entryFile must be a string.')
  }
  const entryFile = normalizeProjectPath(document.entryFile)
  if (!Object.prototype.hasOwnProperty.call(document.files, entryFile)) {
    throw new CadModelError(`CAD source entry file was not found: ${entryFile}`)
  }
}

export function createRealizationSeed() {
  const seed = new Uint32Array(1)
  globalThis.crypto.getRandomValues(seed)
  return seed[0]
}

export function createCadSourceDocumentV2(
  kind: CadDocumentType,
  source: string,
  realizationSeed = createRealizationSeed(),
): CadSourceDocumentV2 {
  const entryFile = `${kind}.tsx`
  const document = Object.freeze({
    kind,
    formatVersion: CAD_SOURCE_FORMAT_VERSION,
    apiVersion: CAD_SOURCE_API_VERSION,
    files: Object.freeze({ [entryFile]: source }),
    entryFile,
    realizationSeed,
  })
  assertCadSourceDocumentV2(document)
  return document
}

export function cadEntrySource(document: CadSourceDocumentV2) {
  assertCadSourceDocumentV2(document)
  return document.files[document.entryFile]
}

export function updateCadEntrySource(document: CadSourceDocumentV2, source: string): CadSourceDocumentV2 {
  const updated = Object.freeze({
    ...document,
    files: Object.freeze({ ...document.files, [document.entryFile]: source }),
  })
  assertCadSourceDocumentV2(updated)
  return updated
}

export function rerollCadSourceDocument(document: CadSourceDocumentV2): CadSourceDocumentV2 {
  const generatedSeed = createRealizationSeed()
  const realizationSeed = generatedSeed === document.realizationSeed
    ? (generatedSeed + 1) >>> 0
    : generatedSeed
  const rerolled = Object.freeze({ ...document, realizationSeed })
  assertCadSourceDocumentV2(rerolled)
  return rerolled
}

export async function cadProjectHash(document: CadSourceDocumentV2) {
  assertCadSourceDocumentV2(document)
  const input = JSON.stringify({
    apiVersion: document.apiVersion,
    kind: document.kind,
    entryFile: document.entryFile,
    files: Object.entries(document.files).sort(([left], [right]) => left.localeCompare(right)),
  })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
