import { describe, expect, it } from 'vitest'
import { createCadSourceDocument, updateCadSource } from './document'
import { StaleCadSourcePatchError, applyCadSourcePatch, createCadSourcePatch } from './sourcePatch'

describe('CAD source patches', () => {
  it('applies validated edits only to the source revision used to create them', async () => {
    const document = createCadSourceDocument('structure', 'const width = 10\nconst height = 20\n', 5)
    const patch = await createCadSourcePatch(document, [
      { start: 14, end: 16, text: '12' },
      { start: 32, end: 34, text: '24' },
    ])
    const updated = await applyCadSourcePatch(document, patch)

    expect(updated.source).toBe('const width = 12\nconst height = 24\n')
    expect(updated.realizationSeed).toBe(5)
    await expect(applyCadSourcePatch(updateCadSource(document, 'changed'), patch)).rejects.toBeInstanceOf(
      StaleCadSourcePatchError,
    )
  })

  it('rejects overlapping and out-of-range edits', async () => {
    const document = createCadSourceDocument('structure', '0123456789', 5)

    await expect(
      createCadSourcePatch(document, [
        { start: 1, end: 5, text: 'a' },
        { start: 4, end: 7, text: 'b' },
      ]),
    ).rejects.toThrow('must not overlap')
    await expect(createCadSourcePatch(document, [{ start: 5, end: 11, text: 'a' }])).rejects.toThrow('is invalid')
  })
})
