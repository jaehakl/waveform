import * as esbuild from 'esbuild-wasm'
import wasmUrl from 'esbuild-wasm/esbuild.wasm?url'
import { CadModelError, Fragment, h } from '../runtime/cadJsx'

type WorkerRequest = {
  type: 'run'
  requestId: string
  source: string
}

type WorkerErrorType = 'compile' | 'runtime' | 'model'

const forbiddenPatterns = [
  { label: 'import', pattern: /\bimport\b/ },
  { label: 'fetch', pattern: /\bfetch\s*\(/ },
  { label: 'XMLHttpRequest', pattern: /\bXMLHttpRequest\b/ },
  { label: 'localStorage', pattern: /\blocalStorage\b/ },
  { label: 'sessionStorage', pattern: /\bsessionStorage\b/ },
  { label: 'indexedDB', pattern: /\bindexedDB\b/ },
  { label: 'document', pattern: /\bdocument\b/ },
  { label: 'window', pattern: /\bwindow\b/ },
  { label: 'navigator', pattern: /\bnavigator\b/ },
  { label: 'self', pattern: /\bself\b/ },
  { label: 'globalThis', pattern: /\bglobalThis\b/ },
  { label: 'Worker', pattern: /\bWorker\b/ },
  { label: 'WebSocket', pattern: /\bWebSocket\b/ },
  { label: 'eval', pattern: /\beval\s*\(/ },
  { label: 'Function', pattern: /\bFunction\b/ },
  { label: 'importScripts', pattern: /\bimportScripts\b/ },
]

let initialized = false

async function ensureEsbuildReady() {
  if (initialized) return

  await esbuild.initialize({
    wasmURL: wasmUrl,
    worker: false,
  })
  initialized = true
}

function assertSourceIsAllowed(source: string) {
  for (const forbidden of forbiddenPatterns) {
    if (forbidden.pattern.test(source)) {
      throw new CadModelError(`Forbidden code pattern: ${forbidden.label}`)
    }
  }
}

async function compileUserCode(source: string) {
  assertSourceIsAllowed(source)
  await ensureEsbuildReady()

  const result = await esbuild.transform(source, {
    format: 'cjs',
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    loader: 'tsx',
    platform: 'browser',
    sourcemap: 'inline',
    target: 'es2020',
  })

  return result.code
}

async function executeUserCode(jsCode: string) {
  const exports: Record<string, unknown> = {}
  const module = { exports }
  const runner = new Function(
    'h',
    'Fragment',
    'exports',
    'module',
    `"use strict";\n${jsCode}\nreturn module.exports;`,
  )
  const moduleExports = runner(h, Fragment, exports, module) as Record<string, unknown>
  const entry = moduleExports.default ?? moduleExports.main ?? exports.default ?? exports.main

  if (typeof entry !== 'function') {
    throw new CadModelError('Default export or named main export must be a function that returns CAD geometry.')
  }

  const geometry = await entry()

  if (!geometry || (Array.isArray(geometry) && geometry.length === 0)) {
    throw new CadModelError('Model function did not return geometry.')
  }

  return geometry
}

function postError(requestId: string, errorType: WorkerErrorType, error: unknown) {
  const typedError = error as { message?: string; stack?: string }

  self.postMessage({
    type: 'error',
    requestId,
    errorType,
    message: typedError.message ?? String(error),
    stack: typedError.stack,
  })
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data

  if (message.type !== 'run') return

  try {
    let jsCode = ''

    try {
      jsCode = await compileUserCode(message.source)
    } catch (error) {
      postError(message.requestId, error instanceof CadModelError ? 'model' : 'compile', error)
      return
    }

    try {
      const geometry = await executeUserCode(jsCode)

      self.postMessage({
        type: 'success',
        requestId: message.requestId,
        geometry,
      })
    } catch (error) {
      postError(message.requestId, error instanceof CadModelError ? 'model' : 'runtime', error)
    }
  } catch (error) {
    postError(message.requestId, 'runtime', error)
  }
}
