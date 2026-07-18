import type * as Monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker'
import TypeScriptWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker.js?worker'
import { setupMonaco } from './monacoSetup'

let runtime: Promise<typeof Monaco> | null = null

export function loadMonaco() {
  runtime ??= Promise.all([
    import('monaco-editor/esm/vs/editor/editor.api.js'),
    import('monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js'),
    import('monaco-editor/esm/vs/language/typescript/monaco.contribution.js'),
  ]).then(([monaco, , typescript]) => {
    const environment = {
      getWorker(_moduleId: string, label: string) {
        return label === 'typescript' || label === 'javascript'
          ? new TypeScriptWorker()
          : new EditorWorker()
      },
    }
    ;(globalThis as typeof globalThis & { MonacoEnvironment?: typeof environment }).MonacoEnvironment = environment
    const monacoRuntime = { ...monaco, typescript } as unknown as typeof Monaco
    setupMonaco(monacoRuntime)
    return monacoRuntime
  })
  return runtime
}

export function prefetchMonaco() {
  void loadMonaco()
}
