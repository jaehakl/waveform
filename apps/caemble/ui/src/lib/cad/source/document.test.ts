import { describe, expect, it, vi } from 'vitest'
import {
  CAD_SOURCE_API_VERSION,
  CAD_SOURCE_FORMAT_VERSION,
  MAX_CAD_SOURCE_BYTES,
  MAX_CAD_SOURCE_FILES,
  assertCadSourceDocumentV2,
  cadProjectHash,
  createCadSourceDocumentV2,
  rerollCadSourceDocument,
  updateCadEntrySource,
  type CadSourceDocumentV2,
} from './document'

function project(files: Readonly<Record<string, string>>, entryFile = 'structure.tsx'): CadSourceDocumentV2 {
  return {
    apiVersion: CAD_SOURCE_API_VERSION,
    entryFile,
    files,
    formatVersion: CAD_SOURCE_FORMAT_VERSION,
    kind: 'structure',
    realizationSeed: 7,
  }
}

describe('CadSourceDocumentV2', () => {
  it('hashes canonical project source with SHA-256 while ignoring realization seed', async () => {
    const left = project({ 'helpers/size.ts': 'export const size = 2', 'structure.tsx': 'source' })
    const reordered = project({ 'structure.tsx': 'source', 'helpers/size.ts': 'export const size = 2' })
    const differentSeed = { ...left, realizationSeed: 99 }
    const hash = await cadProjectHash(left)

    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    await expect(cadProjectHash(reordered)).resolves.toBe(hash)
    await expect(cadProjectHash(differentSeed)).resolves.toBe(hash)
    await expect(cadProjectHash(updateCadEntrySource(left, 'changed'))).resolves.not.toBe(hash)
  })

  it('preserves every virtual file on entry edits and changes only seed on reroll', async () => {
    const document = project({
      'helpers/size.ts': 'export const size = 2',
      'structure.tsx': 'before',
    })
    const edited = updateCadEntrySource(document, 'after')
    const getRandomValues = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(((array: Uint32Array) => {
      array[0] = 7
      return array
    }) as Crypto['getRandomValues'])

    try {
      const rerolled = rerollCadSourceDocument(edited)
      expect(edited.files).toEqual({
        'helpers/size.ts': 'export const size = 2',
        'structure.tsx': 'after',
      })
      expect(rerolled.files).toBe(edited.files)
      expect(rerolled.realizationSeed).toBe(8)
      await expect(cadProjectHash(rerolled)).resolves.toBe(await cadProjectHash(edited))
    } finally {
      getRandomValues.mockRestore()
    }
  })

  it('enforces path, file-count, entry, and UTF-8 byte limits', () => {
    const tooManyFiles = Object.fromEntries(Array.from(
      { length: MAX_CAD_SOURCE_FILES + 1 },
      (_, index) => [`file-${index}.ts`, ''],
    ))

    expect(() => assertCadSourceDocumentV2(project({ '../escape.ts': '' }, '../escape.ts'))).toThrow(
      'Invalid virtual source path',
    )
    expect(() => assertCadSourceDocumentV2(project({ 'structure.tsx': '' }, 'missing.tsx'))).toThrow(
      'entry file was not found',
    )
    expect(() => assertCadSourceDocumentV2(project(tooManyFiles))).toThrow(
      `between 1 and ${MAX_CAD_SOURCE_FILES} files`,
    )
    expect(() => createCadSourceDocumentV2('structure', 'x'.repeat(MAX_CAD_SOURCE_BYTES + 1), 1)).toThrow(
      `exceeds ${MAX_CAD_SOURCE_BYTES} bytes`,
    )
  })
})
