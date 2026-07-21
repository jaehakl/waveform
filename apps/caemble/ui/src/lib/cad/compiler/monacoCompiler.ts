import type * as Monaco from 'monaco-editor'
import { analyzeCadSourceV2, staticCadSourceImportsV2 } from '../source/sourceAnalysis'
import {
  assertCadSourceDocumentV2,
  cadEntrySource,
  cadProjectHash,
  type CadSourceDocumentV2,
} from '../source/document'
import type { CadDiagnosticV2 } from '../worker/protocol'
import {
  CAD_COMPILER_VERSION,
  type CompiledCadModuleV2,
  type CompiledCadProjectV2,
} from './types'

const compilationCache = new Map<string, Promise<CompiledCadProjectV2>>()
const maximumCompilationCacheEntries = 32

export class CadCompilationError extends Error {
  readonly diagnostics: readonly CadDiagnosticV2[]
  readonly errorType: 'compile' | 'policy' | 'type'

  constructor(
    errorType: 'compile' | 'policy' | 'type',
    message: string,
    diagnostics: readonly CadDiagnosticV2[] = [],
  ) {
    super(message)
    this.name = 'CadCompilationError'
    this.errorType = errorType
    this.diagnostics = diagnostics
  }
}

function resolveVirtualImport(
  importer: string,
  specifier: string,
  files: Readonly<Record<string, string>>,
) {
  const segments = importer.split('/').slice(0, -1)
  specifier.split('/').forEach((segment) => {
    if (!segment || segment === '.') return
    if (segment === '..') {
      if (segments.length === 0) {
        throw new CadCompilationError('policy', `Import escapes the virtual project: ${specifier}`)
      }
      segments.pop()
      return
    }
    segments.push(segment)
  })
  const resolved = segments.join('/')
  const candidates = /\.(?:ts|tsx)$/.test(resolved)
    ? [resolved]
    : [`${resolved}.ts`, `${resolved}.tsx`, `${resolved}/index.ts`, `${resolved}/index.tsx`]
  const match = candidates.find((candidate) => Object.prototype.hasOwnProperty.call(files, candidate))
  if (!match) throw new CadCompilationError('policy', `Virtual project import was not found: ${importer} -> ${specifier}`)
  return match
}

function assertProjectPolicy(document: CadSourceDocumentV2) {
  analyzeCadSourceV2(cadEntrySource(document), document.kind)
  Object.entries(document.files).forEach(([path, source]) => {
    staticCadSourceImportsV2(source).forEach((specifier) => {
      if (specifier !== '@caemble/core/v2') resolveVirtualImport(path, specifier, document.files)
    })
  })
}

function diagnosticMessage(message: string | { messageText: string; next?: readonly unknown[] }): string {
  if (typeof message === 'string') return message
  const children = message.next?.flatMap((child) => (
    child && typeof child === 'object' && 'messageText' in child
      ? [diagnosticMessage(child as { messageText: string; next?: readonly unknown[] })]
      : []
  )) ?? []
  return [message.messageText, ...children].join('\n')
}

function convertDiagnostic(
  diagnostic: Monaco.typescript.Diagnostic,
  model: Monaco.editor.ITextModel,
  file: string,
  phase: 'semantic' | 'syntax',
): CadDiagnosticV2 {
  const start = Math.max(0, diagnostic.start ?? 0)
  const end = start + Math.max(0, diagnostic.length ?? 0)
  const startPosition = model.getPositionAt(start)
  const endPosition = model.getPositionAt(end)
  return Object.freeze({
    code: diagnostic.code,
    file,
    message: diagnosticMessage(diagnostic.messageText),
    phase,
    range: Object.freeze({
      startLineNumber: startPosition.lineNumber,
      startColumn: startPosition.column,
      endLineNumber: endPosition.lineNumber,
      endColumn: endPosition.column,
    }),
    severity: diagnostic.category === 1
      ? 'error' as const
      : diagnostic.category === 0
        ? 'warning' as const
        : 'info' as const,
  })
}

async function getTypeScriptWorker(monaco: typeof Monaco) {
  let registrationError: unknown
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      return await monaco.typescript.getTypeScriptWorker()
    } catch (error) {
      if (!String(error).includes('TypeScript not registered')) throw error
      registrationError = error
      await new Promise((resolve) => window.setTimeout(resolve, 20))
    }
  }
  throw registrationError
}

async function compile(document: CadSourceDocumentV2, sourceHash: string) {
  try {
    assertProjectPolicy(document)
  } catch (error) {
    if (error instanceof CadCompilationError) throw error
    const message = error instanceof Error ? error.message : String(error)
    throw new CadCompilationError('policy', message, [{
      code: 'CAD_POLICY',
      file: document.entryFile,
      message,
      phase: 'policy',
      range: {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
      },
      severity: 'error',
    }])
  }

  const { loadMonaco } = await import('./monacoRuntime')
  const monaco = await loadMonaco()
  const baseUri = monaco.Uri.parse(`file:///caemble-project/${sourceHash}/`)
  const models = Object.entries(document.files).map(([path, source]) => {
    const uri = monaco.Uri.joinPath(baseUri, ...path.split('/'))
    return {
      model: monaco.editor.createModel(source, path.endsWith('.tsx') ? 'typescript' : 'typescript', uri),
      path,
      uri,
    }
  })

  let timeout = 0
  try {
    const compilation = async () => {
      const workerFactory = await getTypeScriptWorker(monaco)
      const worker = await workerFactory(...models.map(({ uri }) => uri))
      const diagnostics: CadDiagnosticV2[] = []
      for (const { model, path, uri } of models) {
        const [syntactic, semantic] = await Promise.all([
          worker.getSyntacticDiagnostics(uri.toString()),
          worker.getSemanticDiagnostics(uri.toString()),
        ])
        diagnostics.push(
          ...syntactic.map((diagnostic) => convertDiagnostic(diagnostic, model, path, 'syntax')),
          ...semantic.map((diagnostic) => convertDiagnostic(diagnostic, model, path, 'semantic')),
        )
      }
      const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error')
      if (errors.length > 0) {
        throw new CadCompilationError('type', errors.map((diagnostic) => (
          `${diagnostic.file}:${diagnostic.range.startLineNumber}:${diagnostic.range.startColumn} ${diagnostic.message}`
        )).join('\n'), diagnostics)
      }

      const modules: Record<string, CompiledCadModuleV2> = {}
      for (const { path, uri } of models) {
        const output = await worker.getEmitOutput(uri.toString())
        const code = output.outputFiles.find((file) => file.name.endsWith('.js'))?.text
        const sourceMap = output.outputFiles.find((file) => file.name.endsWith('.js.map'))?.text
        if (output.emitSkipped || code === undefined) {
          throw new CadCompilationError('compile', `TypeScript did not emit JavaScript for ${path}.`, diagnostics)
        }
        const executableCode = code.replace(/\r?\n\/\/# sourceMappingURL=.*?(?:\r?\n)?$/, '')
        modules[path] = Object.freeze({
          code: `${executableCode}\n//# sourceURL=caemble://${sourceHash}/${path}`,
          ...(sourceMap === undefined ? {} : { sourceMap }),
        })
      }
      return Object.freeze({
        apiVersion: 2 as const,
        compilerVersion: CAD_COMPILER_VERSION,
        entryFile: document.entryFile,
        modules: Object.freeze(modules),
        sourceHash,
      })
    }

    const timedOut = new Promise<never>((_resolve, reject) => {
      timeout = window.setTimeout(() => {
        reject(new CadCompilationError('compile', 'TypeScript compilation timed out after 5 seconds.'))
      }, 5000)
    })
    return await Promise.race([compilation(), timedOut])
  } finally {
    window.clearTimeout(timeout)
    models.forEach(({ model }) => model.dispose())
  }
}

export async function compileCadDocument(document: CadSourceDocumentV2) {
  assertCadSourceDocumentV2(document)
  const sourceHash = await cadProjectHash(document)
  const cacheKey = `${CAD_COMPILER_VERSION}:${sourceHash}`
  let cached = compilationCache.get(cacheKey)
  if (!cached) {
    cached = compile(document, sourceHash).catch((error) => {
      compilationCache.delete(cacheKey)
      throw error
    })
    compilationCache.set(cacheKey, cached)
    if (compilationCache.size > maximumCompilationCacheEntries) {
      compilationCache.delete(compilationCache.keys().next().value!)
    }
  }
  return cached
}
