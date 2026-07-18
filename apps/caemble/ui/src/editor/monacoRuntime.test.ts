import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  registerTypeScript: vi.fn(),
  setupMonaco: vi.fn(),
  typescript: { typescriptDefaults: {} },
}))

vi.mock('monaco-editor/esm/vs/editor/editor.worker.js?worker', () => ({
  default: class EditorWorker {},
}))
vi.mock('monaco-editor/esm/vs/language/typescript/ts.worker.js?worker', () => ({
  default: class TypeScriptWorker {},
}))
vi.mock('monaco-editor/esm/vs/editor/editor.api.js', () => ({
  editor: {},
  languages: {},
}))
vi.mock('monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js', () => {
  mocks.registerTypeScript()
  return {}
})
vi.mock('monaco-editor/esm/vs/language/typescript/monaco.contribution.js', () => mocks.typescript)
vi.mock('./monacoSetup', () => ({ setupMonaco: mocks.setupMonaco }))

import { loadMonaco } from './monacoRuntime'

describe('loadMonaco', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers TypeScript and preserves its ESM contribution', async () => {
    const monaco = await loadMonaco()

    expect(mocks.registerTypeScript).toHaveBeenCalledOnce()
    expect(monaco.typescript.typescriptDefaults).toBe(mocks.typescript.typescriptDefaults)
    expect(mocks.setupMonaco).toHaveBeenCalledOnce()
    expect(mocks.setupMonaco.mock.calls[0]?.[0]).toBe(monaco)
  })
})
