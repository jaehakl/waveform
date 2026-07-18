import { describe, expect, it } from 'vitest'
import { createCadSourceDocumentV2, updateCadEntrySource } from './document'
import {
  StaleCadSourcePatchError,
  applyCadSourcePatchV2,
  createCadSourcePatchV2,
} from './sourcePatch'

describe('source-hash based visual patches', () => {
  it('applies non-overlapping edits only to their hashed revision', async () => {
    const document = createCadSourceDocumentV2('structure', 'const width = 10\nconst height = 20\n', 5)
    const patch = await createCadSourcePatchV2(document, document.entryFile, [
      { start: 14, end: 16, text: '30' },
      { start: 32, end: 34, text: '40' },
    ])
    const updated = await applyCadSourcePatchV2(document, patch)

    expect(updated.files[updated.entryFile]).toBe('const width = 30\nconst height = 40\n')
    expect(updated.realizationSeed).toBe(5)
    await expect(applyCadSourcePatchV2(updateCadEntrySource(document, 'changed'), patch))
      .rejects.toBeInstanceOf(StaleCadSourcePatchError)
  })

  it('rejects overlapping or out-of-bounds edit ranges', async () => {
    const document = createCadSourceDocumentV2('structure', '0123456789', 5)

    await expect(createCadSourcePatchV2(document, document.entryFile, [
      { start: 1, end: 5, text: 'a' },
      { start: 4, end: 6, text: 'b' },
    ])).rejects.toThrow('must not overlap')
    await expect(createCadSourcePatchV2(document, document.entryFile, [
      { start: 0, end: 11, text: 'a' },
    ])).rejects.toThrow('edit 0 is invalid')
  })
})
