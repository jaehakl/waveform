import { CadModelError } from '../model/core'
import {
  assertCadSourceDocumentV2,
  cadProjectHash,
  type CadSourceDocumentV2,
} from './document'

export type CadSourceTextEditV2 = Readonly<{
  start: number
  end: number
  text: string
}>

export type CadSourcePatchV2 = Readonly<{
  apiVersion: 2
  sourceHash: string
  file: string
  edits: readonly CadSourceTextEditV2[]
}>

export class StaleCadSourcePatchError extends CadModelError {
  constructor() {
    super('The CAD Source changed after this visual edit was created. Reopen the current revision and try again.')
    this.name = 'StaleCadSourcePatchError'
  }
}

function validateEdits(source: string, edits: readonly CadSourceTextEditV2[]) {
  if (!Array.isArray(edits) || edits.length === 0 || edits.length > 100) {
    throw new CadModelError('A CAD Source patch must contain between 1 and 100 edits.')
  }
  const ordered = [...edits].sort((left, right) => left.start - right.start || left.end - right.end)
  ordered.forEach((edit, index) => {
    if (
      typeof edit !== 'object'
      || edit === null
      || Object.getPrototypeOf(edit) !== Object.prototype
      || Object.keys(edit).some((key) => !['start', 'end', 'text'].includes(key))
      || !Number.isSafeInteger(edit.start)
      || !Number.isSafeInteger(edit.end)
      || edit.start < 0
      || edit.end < edit.start
      || edit.end > source.length
      || typeof edit.text !== 'string'
    ) {
      throw new CadModelError(`CAD Source patch edit ${index} is invalid.`)
    }
    if (index > 0 && ordered[index - 1].end > edit.start) {
      throw new CadModelError('CAD Source patch edits must not overlap.')
    }
  })
}

export async function createCadSourcePatchV2(
  document: CadSourceDocumentV2,
  file: string,
  edits: readonly CadSourceTextEditV2[],
): Promise<CadSourcePatchV2> {
  assertCadSourceDocumentV2(document)
  const source = document.files[file]
  if (source === undefined) throw new CadModelError(`CAD Source patch file was not found: ${file}`)
  validateEdits(source, edits)
  return Object.freeze({
    apiVersion: 2 as const,
    edits: Object.freeze(edits.map((edit) => Object.freeze({ ...edit }))),
    file,
    sourceHash: await cadProjectHash(document),
  })
}

export async function applyCadSourcePatchV2(
  document: CadSourceDocumentV2,
  patch: CadSourcePatchV2,
): Promise<CadSourceDocumentV2> {
  assertCadSourceDocumentV2(document)
  if (
    typeof patch !== 'object'
    || patch === null
    || Object.getPrototypeOf(patch) !== Object.prototype
    || Object.keys(patch).some((key) => !['apiVersion', 'sourceHash', 'file', 'edits'].includes(key))
    || patch.apiVersion !== 2
    || !/^[0-9a-f]{64}$/.test(patch.sourceHash)
    || typeof patch.file !== 'string'
  ) {
    throw new CadModelError('CAD Source patch provenance is invalid.')
  }
  if (await cadProjectHash(document) !== patch.sourceHash) throw new StaleCadSourcePatchError()
  const source = document.files[patch.file]
  if (source === undefined) throw new CadModelError(`CAD Source patch file was not found: ${patch.file}`)
  validateEdits(source, patch.edits)
  const updatedSource = [...patch.edits]
    .sort((left, right) => right.start - left.start || right.end - left.end)
    .reduce((current, edit) => `${current.slice(0, edit.start)}${edit.text}${current.slice(edit.end)}`, source)
  const updated = Object.freeze({
    ...document,
    files: Object.freeze({ ...document.files, [patch.file]: updatedSource }),
  })
  assertCadSourceDocumentV2(updated)
  return updated
}
