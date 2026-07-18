import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CadDocumentType,
  CadDiagnosticV2,
  CadEvaluationResponseV2,
  CadSourceDocumentV2,
  CadScene,
  CadWorkerRequest,
  CadWorkerResponse,
  EvaluatedExperimentRules,
  RecordedData,
  ResolvedExperimentSolver,
  Vars,
} from '../cad'
import { CadCompilationError, compileCadDocument } from '../cad/compiler/monacoCompiler'
import { evaluateInIsolatedRunner } from '../cad/runner/client'
import type { EvaluatedDocumentSnapshotV2 } from '../cad/execution/snapshot'
import { deserializeCadScene } from '../cad/execution/mesh'
import {
  cadEntrySource,
  rerollCadSourceDocument,
  updateCadEntrySource,
} from '../cad/source/document'
import {
  applyCadSourcePatchV2,
  createCadSourcePatchV2,
  type CadSourceTextEditV2,
} from '../cad/source/sourcePatch'
import { resolveCadSceneDraftSelection, resolveCadSceneSelection } from '../cad/evaluation/selection'
import type { StructureGroupMap } from '../cad/model/core'
import {
  StructureGroupSyncError,
  updateModelGroupSource,
  type StructureGroupProperty,
} from '../cad/source/structureGroups'
import type {
  SolverCompatibility,
  SolverProcess,
  SolverRunProvenanceV2,
  SolverSpec,
  SolverValidationIssue,
  SolverValidationResult,
} from '../solver'
import type { DraftSelection } from './groupDraft'

export type AppStatus = 'Dirty' | 'Checking' | 'Compiling' | 'Evaluating' | 'Ready' | 'Rendering' | 'Error'
export type EvaluationTimeoutMs = 3000 | 10000 | 30000

export type RunError = {
  title: string
  message: string
  stack?: string
}

const errorTitles = {
  compile: 'Compile Error',
  type: 'Type Error',
  policy: 'Source Policy Error',
  model: 'Model Error',
  runtime: 'Runtime Error',
}

const idleSolverProcess: SolverProcess = Object.freeze({
  runId: null,
  status: 'idle',
  solver: null,
  error: null,
  startedAt: null,
  finishedAt: null,
})

function createRequestId(prefix: string) {
  return `${prefix}-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`
}

type DocumentWorkerHandlers = Readonly<{
  handleStart: (requestId: string, revision: number) => void
  handlePhase: (requestId: string, revision: number, phase: AppStatus) => void
  handleSuccess: (response: Extract<CadEvaluationResponseV2, { type: 'document-success' }>) => void
  handleError: (response: Extract<CadEvaluationResponseV2, { type: 'document-error' }>) => void
  handleWorkerFailure: (message: string) => void
  getSnapshot: () => Readonly<{
    document: CadSourceDocumentV2 | null | undefined
    evaluatedSnapshot: EvaluatedDocumentSnapshotV2 | null
    revision: number
    successfulRevision: number
  }>
}>

type DocumentStateOptions = Readonly<{
  document: CadSourceDocumentV2 | null | undefined
  documentType: CadDocumentType
  externalVars?: Readonly<Vars>
  onDocumentChange: ((document: CadSourceDocumentV2) => void) | undefined
  onInvalidate: () => void
  requestEvaluation: (
    document: CadSourceDocumentV2,
    revision: number,
    externalVars?: Readonly<Vars>,
  ) => void
}>

function useDocumentState({
  document,
  documentType,
  externalVars,
  onInvalidate,
  onDocumentChange,
  requestEvaluation,
}: DocumentStateOptions) {
  const source = document ? cadEntrySource(document) : null
  const [draftSelection, setDraftSelection] = useState<DraftSelection | null>(null)
  const [diagnostics, setDiagnostics] = useState<readonly CadDiagnosticV2[]>([])
  const [error, setError] = useState<RunError | null>(null)
  const [experimentRules, setExperimentRules] = useState<EvaluatedExperimentRules | null>(null)
  const [scene, setScene] = useState<CadScene | null>(null)
  const [evaluatedSnapshot, setEvaluatedSnapshot] = useState<EvaluatedDocumentSnapshotV2 | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [solver, setSolver] = useState<ResolvedExperimentSolver | null>(null)
  const [status, setStatus] = useState<AppStatus>('Ready')
  const [variables, setVariables] = useState<Readonly<Vars> | null>(null)
  const [revision, setRevision] = useState(0)
  const [successfulRevision, setSuccessfulRevision] = useState(-1)
  const latestRequestIdRef = useRef('')
  const pendingRunRef = useRef<number | null>(null)
  const revisionRef = useRef(0)
  const documentRef = useRef(document)
  const statusRef = useRef<AppStatus>('Ready')
  const successfulRevisionRef = useRef(-1)

  documentRef.current = document

  const updateStatus = useCallback((nextStatus: AppStatus) => {
    statusRef.current = nextStatus
    setStatus(nextStatus)
  }, [])

  const updateSuccessfulRevision = useCallback((nextRevision: number) => {
    successfulRevisionRef.current = nextRevision
    setSuccessfulRevision(nextRevision)
  }, [])

  const clearPendingRun = useCallback(() => {
    if (pendingRunRef.current === null) return
    window.clearTimeout(pendingRunRef.current)
    pendingRunRef.current = null
  }, [])

  const nextRevision = useCallback(() => {
    const next = revisionRef.current + 1
    revisionRef.current = next
    setRevision(next)
    return next
  }, [])

  useEffect(() => {
    clearPendingRun()
    const next = nextRevision()
    onInvalidate()

    if (!document) {
      latestRequestIdRef.current = ''
      setDraftSelection(null)
      setDiagnostics([])
      setError(null)
      setExperimentRules(null)
      setEvaluatedSnapshot(null)
      setScene(null)
      setSelectedId(null)
      setSolver(null)
      setVariables(null)
      updateSuccessfulRevision(-1)
      updateStatus('Ready')
      return
    }

    updateStatus('Dirty')
    pendingRunRef.current = window.setTimeout(() => {
      pendingRunRef.current = null
      requestEvaluation(document, next, externalVars)
    }, 500)

    return clearPendingRun
  }, [
    clearPendingRun,
    document,
    externalVars,
    nextRevision,
    onInvalidate,
    requestEvaluation,
    updateStatus,
    updateSuccessfulRevision,
  ])

  useEffect(() => clearPendingRun, [clearPendingRun])

  const handleRenderStart = useCallback(() => {
    if (statusRef.current !== 'Ready') return
    updateStatus('Rendering')
  }, [updateStatus])
  const handleRenderEnd = useCallback(() => {
    if (statusRef.current !== 'Rendering') return
    updateStatus('Ready')
  }, [updateStatus])
  const handleRenderError = useCallback((message: string) => {
    if (statusRef.current === 'Compiling' || statusRef.current === 'Error') return
    updateStatus('Error')
    setError({ title: 'Rendering Error', message })
  }, [updateStatus])

  const runIsBusy = status === 'Checking'
    || status === 'Compiling'
    || status === 'Evaluating'
    || status === 'Rendering'
  const selection = useMemo(
    () => draftSelection
      ? resolveCadSceneDraftSelection(scene, draftSelection)
      : resolveCadSceneSelection(scene, selectedId),
    [draftSelection, scene, selectedId],
  )

  const handleReroll = useCallback(() => {
    if (runIsBusy || !document || !onDocumentChange) return
    clearPendingRun()
    onDocumentChange(rerollCadSourceDocument(document))
  }, [clearPendingRun, document, onDocumentChange, runIsBusy])

  const handleSourceChange = useCallback((nextSource: string) => {
    if (!document || !onDocumentChange) return
    onDocumentChange(updateCadEntrySource(document, nextSource))
  }, [document, onDocumentChange])

  const handleSourcePatch = useCallback((
    edits: readonly CadSourceTextEditV2[],
    expectedSource: string,
  ) => {
    const baseDocument = documentRef.current
    if (!baseDocument || !onDocumentChange) return
    if (cadEntrySource(baseDocument) !== expectedSource) {
      updateStatus('Error')
      setError({
        title: 'Source Patch Error',
        message: 'The CAD Source changed before this visual edit could be saved.',
      })
      return
    }
    void createCadSourcePatchV2(baseDocument, baseDocument.entryFile, edits)
      .then((patch) => {
        const currentDocument = documentRef.current
        if (!currentDocument) throw new Error('The CAD Source document is no longer available.')
        return applyCadSourcePatchV2(currentDocument, patch)
      })
      .then(onDocumentChange)
      .catch((patchError: unknown) => {
        updateStatus('Error')
        setError({
          title: 'Source Patch Error',
          message: patchError instanceof Error ? patchError.message : String(patchError),
        })
      })
  }, [onDocumentChange, updateStatus])

  const handleGroupsChange = useCallback((property: StructureGroupProperty, groups: StructureGroupMap) => {
    if (!document || !onDocumentChange) return

    try {
      const update = updateModelGroupSource(source ?? '', documentType, property, groups)
      handleSourcePatch(update.edits, source ?? '')
      setError(null)
    } catch (groupError) {
      updateStatus('Error')
      setError({
        title: 'Group Sync Error',
        message: groupError instanceof StructureGroupSyncError || groupError instanceof Error
          ? groupError.message
          : `The ${documentType} group could not be synchronized with Code Space.`,
      })
    }
  }, [document, documentType, handleSourcePatch, onDocumentChange, source, updateStatus])

  const handlers: DocumentWorkerHandlers = {
    handleStart(requestId, requestRevision) {
      if (requestRevision !== revisionRef.current) return
      latestRequestIdRef.current = requestId
      updateStatus('Checking')
      setDiagnostics([])
      setError(null)
    },
    handlePhase(requestId, requestRevision, phase) {
      if (requestRevision !== revisionRef.current || requestId !== latestRequestIdRef.current) return
      updateStatus(phase)
    },
    handleSuccess(response) {
      if (
        response.documentType !== documentType
        || response.revision !== revisionRef.current
        || response.requestId !== latestRequestIdRef.current
      ) return
      updateStatus('Ready')
      setDiagnostics([])
      setError(null)
      const runtimeScene = deserializeCadScene(response.snapshot.scene)
      setScene(runtimeScene)
      setEvaluatedSnapshot(response.snapshot)
      setVariables(response.snapshot.variables)
      setExperimentRules(response.snapshot.experimentRules ?? null)
      setSolver(response.snapshot.solver ?? null)
      updateSuccessfulRevision(response.revision)
      setSelectedId((current) => resolveCadSceneSelection(runtimeScene, current) ? current : null)
    },
    handleError(response) {
      if (
        response.documentType !== documentType
        || response.revision !== revisionRef.current
        || response.requestId !== latestRequestIdRef.current
      ) return
      updateStatus('Error')
      updateSuccessfulRevision(-1)
      setDiagnostics(response.diagnostics ?? [])
      setError({
        title: errorTitles[response.errorType],
        message: response.message,
        stack: response.stack,
      })
    },
    handleWorkerFailure(message) {
      latestRequestIdRef.current = ''
      updateStatus('Error')
      updateSuccessfulRevision(-1)
      setDiagnostics([])
      setError({ title: 'Runtime Error', message })
    },
    getSnapshot() {
      return {
        document: documentRef.current,
        evaluatedSnapshot,
        revision: revisionRef.current,
        successfulRevision: successfulRevisionRef.current,
      }
    },
  }

  return {
    controller: {
      documentType,
      diagnostics,
      draftSelection,
      error,
      experimentRules,
      handleGroupsChange,
      handleRenderEnd,
      handleRenderError,
      handleRenderStart,
      handleReroll,
      handleSourceChange,
      handleSourcePatch,
      readOnly: !onDocumentChange,
      sourceReadOnly: !onDocumentChange,
      structuredReadOnly: !onDocumentChange || successfulRevision !== revision,
      revision,
      runIsBusy,
      scene,
      sceneHash: evaluatedSnapshot?.scene.sceneHash ?? null,
      selectedId,
      selection,
      setDraftSelection,
      setSelectedId,
      solver,
      status,
      successfulRevision,
      variables,
    },
    handlers,
  }
}

type BaseCadDocumentController = ReturnType<typeof useDocumentState>['controller']

export type CadDocumentController = BaseCadDocumentController & Readonly<{
  evaluationTimeoutMs: EvaluationTimeoutMs
  preflightIssues: readonly SolverValidationIssue[]
  setEvaluationTimeoutMs: (timeout: EvaluationTimeoutMs) => void
  solverSpec: SolverSpec | null
}>

export function attachPreflightMetadata(
  controller: BaseCadDocumentController,
  issues: readonly SolverValidationIssue[],
  solverSpec: SolverSpec | null,
  evaluationTimeoutMs: EvaluationTimeoutMs,
  setEvaluationTimeoutMs: (timeout: EvaluationTimeoutMs) => void,
): CadDocumentController {
  return {
    ...controller,
    evaluationTimeoutMs,
    preflightIssues: issues,
    setEvaluationTimeoutMs,
    solverSpec,
  }
}

export type SimulationController = Readonly<{
  canRun: boolean
  cancel: () => void
  compatibility: SolverCompatibility
  process: SolverProcess
  provenance: SolverRunProvenanceV2 | null
  recordedData: RecordedData | null
  run: () => void
  stale: boolean
}>

export function useCadWorkspace(
  structure: CadSourceDocumentV2 | null | undefined,
  experiment: CadSourceDocumentV2 | null | undefined,
  onStructureChange: ((document: CadSourceDocumentV2) => void) | undefined,
  onExperimentChange: ((document: CadSourceDocumentV2) => void) | undefined,
  structureVars?: Readonly<Vars>,
  experimentVars?: Readonly<Vars>,
) {
  const workerRef = useRef<Worker | null>(null)
  const documentHandlersRef = useRef<Partial<Record<CadDocumentType, DocumentWorkerHandlers>>>({})
  const workerMessageRef = useRef<(response: CadWorkerResponse) => void>(() => undefined)
  const workerFailureRef = useRef<(message: string) => void>(() => undefined)
  const evaluationJobsRef = useRef<Partial<Record<CadDocumentType, {
    cancel: () => void
    requestId: string
    timeout: number | null
  }>>>({})
  const activeSolverRequestIdRef = useRef<string | null>(null)
  const solverStartedAtRef = useRef<number | null>(null)
  const recordedDataRef = useRef<RecordedData | null>(null)
  const [process, setProcess] = useState<SolverProcess>(idleSolverProcess)
  const [provenance, setProvenance] = useState<SolverRunProvenanceV2 | null>(null)
  const [recordedData, setRecordedData] = useState<RecordedData | null>(null)
  const [stale, setStale] = useState(false)
  const [evaluationTimeoutMs, setEvaluationTimeoutMs] = useState<EvaluationTimeoutMs>(3000)
  const evaluationTimeoutMsRef = useRef<EvaluationTimeoutMs>(evaluationTimeoutMs)
  const [preflight, setPreflight] = useState<Readonly<{
    structureRevision?: number
    experimentRevision: number
    result: SolverValidationResult
  }> | null>(null)

  const clearEvaluationJob = useCallback((documentType: CadDocumentType, requestId?: string) => {
    const active = evaluationJobsRef.current[documentType]
    if (!active || (requestId && active.requestId !== requestId)) return
    if (active.timeout !== null) window.clearTimeout(active.timeout)
    active.cancel()
    delete evaluationJobsRef.current[documentType]
  }, [])

  const finishEvaluationJob = useCallback((documentType: CadDocumentType, requestId: string) => {
    const active = evaluationJobsRef.current[documentType]
    if (!active || active.requestId !== requestId) return false
    if (active.timeout !== null) window.clearTimeout(active.timeout)
    delete evaluationJobsRef.current[documentType]
    return true
  }, [])

  const startWorker = useCallback(() => {
    const worker = new Worker(new URL('../cad/worker/cad.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<CadWorkerResponse>) => {
      if (workerRef.current === worker) workerMessageRef.current(event.data)
    }
    worker.onerror = (event) => {
      if (workerRef.current === worker) workerFailureRef.current(event.message || 'The Solver Worker failed.')
    }
    workerRef.current = worker
    return worker
  }, [])

  const postRequest = useCallback((request: CadWorkerRequest) => {
    const worker = workerRef.current ?? startWorker()
    worker.postMessage(request)
  }, [startWorker])

  const requestEvaluation = useCallback((
    document: CadSourceDocumentV2,
    revision: number,
    externalVars?: Readonly<Vars>,
  ) => {
    const documentType = document.kind
    clearEvaluationJob(documentType)
    const requestId = createRequestId(documentType)
    documentHandlersRef.current[documentType]?.handleStart(requestId, revision)
    const job: { cancel: () => void; requestId: string; timeout: number | null } = {
      cancel: () => undefined,
      requestId,
      timeout: null,
    }
    evaluationJobsRef.current[documentType] = job
    documentHandlersRef.current[documentType]?.handlePhase(requestId, revision, 'Compiling')

    void compileCadDocument(document).then((compiledProject) => {
      if (evaluationJobsRef.current[documentType]?.requestId !== requestId) return
      documentHandlersRef.current[documentType]?.handlePhase(requestId, revision, 'Evaluating')
      job.cancel = evaluateInIsolatedRunner({
        type: 'evaluate-document',
        requestId,
        revision,
        document: {
          apiVersion: document.apiVersion,
          kind: document.kind,
          realizationSeed: document.realizationSeed,
        },
        compiledProject,
        ...(externalVars ? { vars: externalVars } : {}),
      }, {
        onFailure(message) {
          if (!finishEvaluationJob(documentType, requestId)) return
          documentHandlersRef.current[documentType]?.handleWorkerFailure(message)
        },
        onStart() {
          if (evaluationJobsRef.current[documentType]?.requestId !== requestId) return
          job.timeout = window.setTimeout(() => {
            if (evaluationJobsRef.current[documentType]?.requestId !== requestId) return
            clearEvaluationJob(documentType, requestId)
            documentHandlersRef.current[documentType]?.handleWorkerFailure(
              `Model evaluation timed out after ${evaluationTimeoutMsRef.current / 1000} seconds for revision ${revision}.`,
            )
          }, evaluationTimeoutMsRef.current)
        },
        onResponse(response) {
          if (!finishEvaluationJob(documentType, requestId)) return
          const handlers = documentHandlersRef.current[documentType]
          if (response.type === 'document-success') {
            handlers?.handleSuccess(response)
            postRequest({
              type: 'cache-snapshot',
              requestId: `cache-${requestId}`,
              revision,
              snapshot: response.snapshot,
            })
          } else {
            handlers?.handleError(response)
          }
        },
      })
    }).catch((error: unknown) => {
      if (!finishEvaluationJob(documentType, requestId)) return
      const compilationError = error instanceof CadCompilationError ? error : null
      documentHandlersRef.current[documentType]?.handleError({
        type: 'document-error',
        requestId,
        revision,
        documentType,
        errorType: compilationError?.errorType ?? 'compile',
        message: error instanceof Error ? error.message : String(error),
        ...(compilationError?.diagnostics.length ? { diagnostics: compilationError.diagnostics } : {}),
        ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
      })
    })
  }, [clearEvaluationJob, finishEvaluationJob, postRequest])

  const invalidateResults = useCallback(() => {
    if (recordedDataRef.current) setStale(true)
  }, [])

  const invalidateWorkspace = useCallback(() => {
    invalidateResults()
    setPreflight(null)
  }, [invalidateResults])

  const structureState = useDocumentState({
    document: structure,
    documentType: 'structure',
    externalVars: structureVars,
    onDocumentChange: onStructureChange,
    onInvalidate: invalidateWorkspace,
    requestEvaluation,
  })
  const experimentState = useDocumentState({
    document: experiment,
    documentType: 'experiment',
    externalVars: experimentVars,
    onDocumentChange: onExperimentChange,
    onInvalidate: invalidateWorkspace,
    requestEvaluation,
  })
  documentHandlersRef.current.structure = structureState.handlers
  documentHandlersRef.current.experiment = experimentState.handlers
  evaluationTimeoutMsRef.current = evaluationTimeoutMs

  const cancelProcessForWorkerReset = useCallback((message: string) => {
    if (!activeSolverRequestIdRef.current) return
    const now = Date.now()
    setProcess(Object.freeze({
      runId: activeSolverRequestIdRef.current,
      status: 'cancelled',
      solver: experimentState.controller.solver
        ? Object.freeze({
            name: experimentState.controller.solver.name,
            version: experimentState.controller.solver.version,
          })
        : null,
      error: message,
      startedAt: solverStartedAtRef.current,
      finishedAt: now,
    }))
    activeSolverRequestIdRef.current = null
    if (recordedDataRef.current) setStale(true)
  }, [experimentState.controller.solver])

  workerFailureRef.current = (message) => {
    workerRef.current?.terminate()
    workerRef.current = null
    setPreflight(null)
    cancelProcessForWorkerReset(`Solver run was cancelled because the Solver Worker failed: ${message}`)
    const replacement = startWorker()
    ;(['structure', 'experiment'] as const).forEach((documentType) => {
      const current = documentHandlersRef.current[documentType]?.getSnapshot()
      if (!current?.evaluatedSnapshot || current.successfulRevision !== current.revision) return
      replacement.postMessage({
        type: 'cache-snapshot',
        requestId: `restore-${documentType}-${current.revision}`,
        revision: current.revision,
        snapshot: current.evaluatedSnapshot,
      } satisfies CadWorkerRequest)
    })
  }

  workerMessageRef.current = (response) => {
    if (response.type === 'solver-preflight') {
      const structureSnapshot = documentHandlersRef.current.structure?.getSnapshot()
      const experimentSnapshot = documentHandlersRef.current.experiment?.getSnapshot()
      const experimentMatches = experimentSnapshot?.revision === response.experimentRevision
        && experimentSnapshot.successfulRevision === response.experimentRevision
      const structureMatches = response.structureRevision === undefined
        ? structureSnapshot?.successfulRevision !== structureSnapshot?.revision
        : structureSnapshot?.revision === response.structureRevision
          && structureSnapshot.successfulRevision === response.structureRevision
      if (experimentMatches && structureMatches) setPreflight(Object.freeze(response))
      return
    }
    if (response.requestId !== activeSolverRequestIdRef.current) return
    if (response.type === 'solver-process') {
      setProcess(response.process)
      if (response.process.status === 'failed' || response.process.status === 'cancelled') {
        activeSolverRequestIdRef.current = null
        if (recordedDataRef.current) setStale(true)
      }
      return
    }
    if (response.type === 'solver-success') {
      recordedDataRef.current = response.recordedData
      setRecordedData(response.recordedData)
      setProvenance(response.provenance)
      const structureSnapshot = documentHandlersRef.current.structure?.getSnapshot()
      const experimentSnapshot = documentHandlersRef.current.experiment?.getSnapshot()
      setStale(
        structureSnapshot?.revision !== response.structureRevision
        || experimentSnapshot?.revision !== response.experimentRevision,
      )
      activeSolverRequestIdRef.current = null
      return
    }
    if (response.type === 'solver-error') {
      const now = Date.now()
      setProcess(Object.freeze({
        runId: response.requestId,
        status: 'failed',
        solver: experimentState.controller.solver
          ? Object.freeze({
              name: experimentState.controller.solver.name,
              version: experimentState.controller.solver.version,
            })
          : null,
        error: response.message,
        startedAt: solverStartedAtRef.current,
        finishedAt: now,
      }))
      activeSolverRequestIdRef.current = null
      if (recordedDataRef.current) setStale(true)
    }
  }

  useEffect(() => {
    const evaluationJobs = evaluationJobsRef.current
    startWorker()
    return () => {
      Object.keys(evaluationJobs).forEach((key) => clearEvaluationJob(key as CadDocumentType))
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [clearEvaluationJob, startWorker])

  const structureIssues = preflight?.result.issues.filter((issue) => issue.documentType === 'structure') ?? []
  const experimentIssues = preflight?.result.issues.filter((issue) => issue.documentType === 'experiment') ?? []
  const structureDocument = attachPreflightMetadata(
    structureState.controller,
    structureIssues,
    null,
    evaluationTimeoutMs,
    setEvaluationTimeoutMs,
  )
  const experimentDocument = attachPreflightMetadata(
    experimentState.controller,
    experimentIssues,
    preflight?.result.spec ?? null,
    evaluationTimeoutMs,
    setEvaluationTimeoutMs,
  )
  const compatibility = useMemo<SolverCompatibility>(() => {
    if (experimentState.controller.solver === null) {
      return Object.freeze({ status: 'unavailable', issues: Object.freeze([]) })
    }
    if (preflight === null) {
      return Object.freeze({ status: 'checking', issues: Object.freeze([]) })
    }
    if (preflight.result.issues.length > 0) {
      return Object.freeze({ status: 'incompatible', issues: preflight.result.issues })
    }
    if (!preflight.result.complete) {
      return Object.freeze({ status: 'checking', issues: Object.freeze([]) })
    }
    return Object.freeze({ status: 'compatible', issues: Object.freeze([]) })
  }, [experimentState.controller.solver, preflight])
  const processActive = process.status === 'preparing' || process.status === 'running'
  const canRun = !processActive
    && structureDocument.status === 'Ready'
    && experimentDocument.status === 'Ready'
    && structureState.controller.successfulRevision === structureState.controller.revision
    && experimentState.controller.successfulRevision === experimentState.controller.revision
    && compatibility.status === 'compatible'

  const run = useCallback(() => {
    if (compatibility.status !== 'compatible') return
    const structureSnapshot = documentHandlersRef.current.structure?.getSnapshot()
    const experimentSnapshot = documentHandlersRef.current.experiment?.getSnapshot()
    if (
      !structureSnapshot
      || !experimentSnapshot
      || structureSnapshot.successfulRevision !== structureSnapshot.revision
      || experimentSnapshot.successfulRevision !== experimentSnapshot.revision
      || activeSolverRequestIdRef.current
    ) return

    const requestId = createRequestId('simulation')
    const startedAt = Date.now()
    activeSolverRequestIdRef.current = requestId
    solverStartedAtRef.current = startedAt
    if (recordedDataRef.current) setStale(true)
    const solver = experimentState.controller.solver
    setProcess(Object.freeze({
      runId: requestId,
      status: 'preparing',
      solver: solver ? Object.freeze({ name: solver.name, version: solver.version }) : null,
      error: null,
      startedAt,
      finishedAt: null,
    }))
    postRequest({
      type: 'run-solver',
      requestId,
      structureRevision: structureSnapshot.revision,
      experimentRevision: experimentSnapshot.revision,
    })
  }, [compatibility.status, experimentState.controller.solver, postRequest])

  const cancel = useCallback(() => {
    const requestId = activeSolverRequestIdRef.current
    if (!requestId) return
    postRequest({ type: 'cancel-solver', requestId })
  }, [postRequest])

  const simulation: SimulationController = {
    canRun,
    cancel,
    compatibility,
    process,
    provenance,
    recordedData,
    run,
    stale,
  }

  return {
    experimentDocument,
    simulation,
    structureDocument,
  }
}
