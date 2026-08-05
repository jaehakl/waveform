import { CadModelError } from '../model/core'
import { assertCadSourceDocument, cadSourceHash, updateCadSource, type CadSourceDocument } from './document'

export type CadSourceTextEdit = Readonly<{
  start: number
  end: number
  text: string
}>

export type CadSourcePatch = Readonly<{
  apiVersion: 3
  sourceHash: string
  edits: readonly CadSourceTextEdit[]
}>

export class StaleCadSourcePatchError extends CadModelError {
  constructor() {
    super('The CAD Source changed after this visual edit was created. Reopen the current revision and try again.')
    this.name = 'StaleCadSourcePatchError'
  }
}

function validateEdits(source: string, edits: readonly CadSourceTextEdit[]) {
  if (!Array.isArray(edits) || edits.length === 0 || edits.length > 100) {
    throw new CadModelError('A CAD Source patch must contain between 1 and 100 edits.')
  }
  const ordered = [...edits].sort((left, right) => left.start - right.start || left.end - right.end)
  ordered.forEach((edit, index) => {
    if (
      typeof edit !== 'object' ||
      edit === null ||
      Object.getPrototypeOf(edit) !== Object.prototype ||
      Object.keys(edit).some((key) => !['start', 'end', 'text'].includes(key)) ||
      !Number.isSafeInteger(edit.start) ||
      !Number.isSafeInteger(edit.end) ||
      edit.start < 0 ||
      edit.end < edit.start ||
      edit.end > source.length ||
      typeof edit.text !== 'string'
    ) {
      throw new CadModelError(`CAD Source patch edit ${index} is invalid.`)
    }
    if (index > 0 && ordered[index - 1].end > edit.start) {
      throw new CadModelError('CAD Source patch edits must not overlap.')
    }
  })
}

export async function createCadSourcePatch(
  document: CadSourceDocument,
  edits: readonly CadSourceTextEdit[],
): Promise<CadSourcePatch> {
  assertCadSourceDocument(document)
  validateEdits(document.source, edits)
  return Object.freeze({
    apiVersion: 3 as const,
    edits: Object.freeze(edits.map((edit) => Object.freeze({ ...edit }))),
    sourceHash: await cadSourceHash(document),
  })
}

export async function applyCadSourcePatch(
  document: CadSourceDocument,
  patch: CadSourcePatch,
): Promise<CadSourceDocument> {
  assertCadSourceDocument(document)
  if (
    typeof patch !== 'object' ||
    patch === null ||
    Object.getPrototypeOf(patch) !== Object.prototype ||
    Object.keys(patch).some((key) => !['apiVersion', 'sourceHash', 'edits'].includes(key)) ||
    patch.apiVersion !== 3 ||
    !/^[0-9a-f]{64}$/.test(patch.sourceHash)
  ) {
    throw new CadModelError('CAD Source patch provenance is invalid.')
  }
  if ((await cadSourceHash(document)) !== patch.sourceHash) throw new StaleCadSourcePatchError()
  validateEdits(document.source, patch.edits)
  const updatedSource = [...patch.edits]
    .sort((left, right) => right.start - left.start || right.end - left.end)
    .reduce((current, edit) => `${current.slice(0, edit.start)}${edit.text}${current.slice(edit.end)}`, document.source)
  return updateCadSource(document, updatedSource)
}
