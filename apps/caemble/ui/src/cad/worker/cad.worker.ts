import * as esbuild from 'esbuild-wasm'
import wasmUrl from 'esbuild-wasm/esbuild.wasm?url'
import {
  evaluateDocumentEntry,
  loadCompiledCode,
  type CadExecutionResult,
  type CadDocumentEntry,
} from '../execution/userModule'
import { CadModelError, Sample, Setup } from '../model/core'
import { SolverController } from '../../solver'
import { solverModules } from '../../solver/modules'
import type {
  CadDocumentType,
  CadWorkerErrorType,
  CadWorkerRequest,
  CadWorkerResponse,
} from './protocol'

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

let initialization: Promise<void> | null = null
let activeSolverRequestId: string | null = null
const latestRevisions: Record<CadDocumentType, number> = { structure: 0, experiment: 0 }
const cachedEntries: Partial<Record<CadDocumentType, Readonly<{
  revision: number
  entry: CadDocumentEntry
  execution: CadExecutionResult
}>>> = {}
const solverController = new SolverController(solverModules)

solverController.subscribe((process) => {
  if (!activeSolverRequestId) return
  postResponse({
    type: 'solver-process',
    requestId: activeSolverRequestId,
    process,
  })
})

async function ensureEsbuildReady() {
  initialization ??= esbuild.initialize({
    wasmURL: wasmUrl,
    worker: false,
  })
  await initialization
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

function postResponse(response: CadWorkerResponse) {
  self.postMessage(response)
}

function postSolverPreflight() {
  const experiment = cachedEntries.experiment
  if (!experiment?.execution.experimentRules || !experiment.execution.solver) return
  const structure = cachedEntries.structure
  const result = solverController.preflight({
    ...(structure ? { structure: { scene: structure.execution.scene } } : {}),
    experiment: {
      scene: experiment.execution.scene,
      rules: experiment.execution.experimentRules,
      solver: experiment.execution.solver,
    },
  })
  postResponse({
    type: 'solver-preflight',
    requestId: `preflight-${structure?.revision ?? 'none'}-${experiment.revision}`,
    ...(structure ? { structureRevision: structure.revision } : {}),
    experimentRevision: experiment.revision,
    result,
  })
}

function errorDetails(error: unknown) {
  const typedError = error as { message?: string; stack?: string }
  return {
    message: typedError.message ?? String(error),
    stack: typedError.stack,
  }
}

function postDocumentError(
  request: Extract<CadWorkerRequest, { type: 'evaluate-document' }>,
  errorType: CadWorkerErrorType,
  error: unknown,
) {
  if (latestRevisions[request.documentType] !== request.revision) return
  postResponse({
    type: 'document-error',
    requestId: request.requestId,
    revision: request.revision,
    documentType: request.documentType,
    errorType,
    ...errorDetails(error),
  })
}

async function evaluateDocument(request: Extract<CadWorkerRequest, { type: 'evaluate-document' }>) {
  try {
    let jsCode = ''
    try {
      jsCode = await compileUserCode(request.source)
    } catch (error) {
      postDocumentError(request, error instanceof CadModelError ? 'model' : 'compile', error)
      return
    }
    if (latestRevisions[request.documentType] !== request.revision) return

    try {
      const entry = loadCompiledCode(jsCode, request.documentType)
      const execution = evaluateDocumentEntry(entry, request.documentType)
      if (latestRevisions[request.documentType] !== request.revision) return
      cachedEntries[request.documentType] = Object.freeze({ revision: request.revision, entry, execution })
      postResponse({
        type: 'document-success',
        requestId: request.requestId,
        revision: request.revision,
        documentType: request.documentType,
        ...execution,
      })
      postSolverPreflight()
    } catch (error) {
      postDocumentError(request, error instanceof CadModelError ? 'model' : 'runtime', error)
    }
  } catch (error) {
    postDocumentError(request, 'runtime', error)
  }
}

async function runSolver(request: Extract<CadWorkerRequest, { type: 'run-solver' }>) {
  const structure = cachedEntries.structure
  const experiment = cachedEntries.experiment
  if (
    !structure
    || !experiment
    || structure.revision !== request.structureRevision
    || experiment.revision !== request.experimentRevision
    || !(structure.entry instanceof Sample)
    || !(experiment.entry instanceof Setup)
  ) {
    postResponse({
      type: 'solver-error',
      requestId: request.requestId,
      message: 'Both current Structure and Experiment documents must be ready before running the solver.',
    })
    return
  }
  if (activeSolverRequestId) {
    postResponse({
      type: 'solver-error',
      requestId: request.requestId,
      message: 'A solver run is already active.',
    })
    return
  }

  activeSolverRequestId = request.requestId
  try {
    const recordedData = await solverController.run(structure.entry, experiment.entry)
    postResponse({
      type: 'solver-success',
      requestId: request.requestId,
      structureRevision: request.structureRevision,
      experimentRevision: request.experimentRevision,
      recordedData,
    })
  } catch {
    // SolverController publishes the failed or cancelled process state.
  } finally {
    activeSolverRequestId = null
  }
}

self.onmessage = (event: MessageEvent<CadWorkerRequest>) => {
  const message = event.data
  if (message.type === 'evaluate-document') {
    latestRevisions[message.documentType] = Math.max(latestRevisions[message.documentType], message.revision)
    void evaluateDocument(message)
    return
  }
  if (message.type === 'run-solver') {
    void runSolver(message)
    return
  }
  if (message.type === 'cancel-solver' && message.requestId === activeSolverRequestId) {
    solverController.cancel()
  }
}
