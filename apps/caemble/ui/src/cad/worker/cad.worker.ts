import * as esbuild from 'esbuild-wasm'
import wasmUrl from 'esbuild-wasm/esbuild.wasm?url'
import { CadModelError } from '../model/core'
import { executeCompiledCode } from '../execution/userModule'
import type { CadWorkerErrorType, CadWorkerRequest, CadWorkerResponse } from './protocol'

const forbiddenPatterns = [
  { label: 'dynamic import', pattern: /\bimport\s*\(/ },
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

function postError(requestId: string, errorType: CadWorkerErrorType, error: unknown) {
  const typedError = error as { message?: string; stack?: string }

  const response: CadWorkerResponse = {
    type: 'error',
    requestId,
    errorType,
    message: typedError.message ?? String(error),
    stack: typedError.stack,
  }
  self.postMessage(response)
}

self.onmessage = async (event: MessageEvent<CadWorkerRequest>) => {
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
      const scene = executeCompiledCode(jsCode, message.documentType)

      const response: CadWorkerResponse = {
        type: 'success',
        requestId: message.requestId,
        scene,
      }
      self.postMessage(response)
    } catch (error) {
      postError(message.requestId, error instanceof CadModelError ? 'model' : 'runtime', error)
    }
  } catch (error) {
    postError(message.requestId, 'runtime', error)
  }
}
