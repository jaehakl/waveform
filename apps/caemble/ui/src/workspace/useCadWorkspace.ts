import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CadDocumentType,
  CadScene,
  CadWorkerRequest,
  CadWorkerResponse,
  EvaluatedExperimentRules,
  RecordedData,
  ResolvedExperimentSolver,
  Vars,
} from '../cad'
import { resolveCadSceneDraftSelection, resolveCadSceneSelection } from '../cad/evaluation/selection'
import type { StructureGroupMap } from '../cad/model/core'
import {
  StructureGroupSyncError,
  updateModelGroupSource,
  type StructureGroupProperty,
} from '../cad/source/structureGroups'
import type { SolverProcess } from '../solver'
import type { DraftSelection } from './groupDraft'

export type AppStatus = 'Ready' | 'Compiling' | 'Rendering' | 'Error'

export type RunError = {
  title: string
  message: string
  stack?: string
}

const errorTitles = {
  compile: 'Compile Error',
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
  handleSuccess: (response: Extract<CadWorkerResponse, { type: 'document-success' }>) => void
  handleError: (response: Extract<CadWorkerResponse, { type: 'document-error' }>) => void
  handleWorkerFailure: (message: string) => void
  getSnapshot: () => Readonly<{
    source: string | null | undefined
    revision: number
    successfulRevision: number
  }>
}>

type DocumentStateOptions = Readonly<{
  source: string | null | undefined
  documentType: CadDocumentType
  onSourceChange: ((source: string) => void) | undefined
  onInvalidate: () => void
  requestEvaluation: (documentType: CadDocumentType, source: string, revision: number) => void
}>

function useDocumentState({
  documentType,
  onInvalidate,
  onSourceChange,
  requestEvaluation,
  source,
}: DocumentStateOptions) {
  const [draftSelection, setDraftSelection] = useState<DraftSelection | null>(null)
  const [error, setError] = useState<RunError | null>(null)
  const [experimentRules, setExperimentRules] = useState<EvaluatedExperimentRules | null>(null)
  const [scene, setScene] = useState<CadScene | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [solver, setSolver] = useState<ResolvedExperimentSolver | null>(null)
  const [status, setStatus] = useState<AppStatus>('Ready')
  const [variables, setVariables] = useState<Readonly<Vars> | null>(null)
  const [revision, setRevision] = useState(0)
  const [successfulRevision, setSuccessfulRevision] = useState(-1)
  const latestRequestIdRef = useRef('')
  const pendingRunRef = useRef<number | null>(null)
  const revisionRef = useRef(0)
  const sourceRef = useRef(source)
  const statusRef = useRef<AppStatus>('Ready')
  const successfulRevisionRef = useRef(-1)

  sourceRef.current = source

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

    if (source === null || source === undefined) {
      latestRequestIdRef.current = ''
      setDraftSelection(null)
      setError(null)
      setExperimentRules(null)
      setScene(null)
      setSelectedId(null)
      setSolver(null)
      setVariables(null)
      updateSuccessfulRevision(-1)
      updateStatus('Ready')
      return
    }

    pendingRunRef.current = window.setTimeout(() => {
      pendingRunRef.current = null
      requestEvaluation(documentType, source, next)
    }, 500)

    return clearPendingRun
  }, [
    clearPendingRun,
    documentType,
    nextRevision,
    onInvalidate,
    requestEvaluation,
    source,
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

  const runIsBusy = status === 'Compiling' || status === 'Rendering'
  const selection = useMemo(
    () => draftSelection
      ? resolveCadSceneDraftSelection(scene, draftSelection)
      : resolveCadSceneSelection(scene, selectedId),
    [draftSelection, scene, selectedId],
  )

  const handleReroll = useCallback(() => {
    if (runIsBusy || source === null || source === undefined) return
    clearPendingRun()
    const next = nextRevision()
    onInvalidate()
    requestEvaluation(documentType, source, next)
  }, [clearPendingRun, documentType, nextRevision, onInvalidate, requestEvaluation, runIsBusy, source])

  const handleSourceChange = useCallback((nextSource: string) => {
    onSourceChange?.(nextSource)
  }, [onSourceChange])

  const handleGroupsChange = useCallback((property: StructureGroupProperty, groups: StructureGroupMap) => {
    if (source === null || source === undefined || !onSourceChange) return

    try {
      const update = updateModelGroupSource(source, documentType, property, groups)
      onSourceChange(update.source)
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
  }, [documentType, onSourceChange, source, updateStatus])

  const handlers: DocumentWorkerHandlers = {
    handleStart(requestId, requestRevision) {
      if (requestRevision !== revisionRef.current) return
      latestRequestIdRef.current = requestId
      updateStatus('Compiling')
      setError(null)
    },
    handleSuccess(response) {
      if (
        response.documentType !== documentType
        || response.revision !== revisionRef.current
        || response.requestId !== latestRequestIdRef.current
      ) return
      updateStatus('Ready')
      setError(null)
      setScene(response.scene)
      setVariables(response.variables)
      setExperimentRules(response.experimentRules ?? null)
      setSolver(response.solver ?? null)
      updateSuccessfulRevision(response.revision)
      setSelectedId((current) => resolveCadSceneSelection(response.scene, current) ? current : null)
    },
    handleError(response) {
      if (
        response.documentType !== documentType
        || response.revision !== revisionRef.current
        || response.requestId !== latestRequestIdRef.current
      ) return
      updateStatus('Error')
      updateSuccessfulRevision(-1)
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
      setError({ title: 'Runtime Error', message })
    },
    getSnapshot() {
      return {
        source: sourceRef.current,
        revision: revisionRef.current,
        successfulRevision: successfulRevisionRef.current,
      }
    },
  }

  return {
    controller: {
      documentType,
      draftSelection,
      error,
      experimentRules,
      handleGroupsChange,
      handleRenderEnd,
      handleRenderError,
      handleRenderStart,
      handleReroll,
      handleSourceChange,
      readOnly: !onSourceChange,
      revision,
      runIsBusy,
      scene,
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

export type CadDocumentController = ReturnType<typeof useDocumentState>['controller']

export type SimulationController = Readonly<{
  canRun: boolean
  cancel: () => void
  process: SolverProcess
  recordedData: RecordedData | null
  run: () => void
  stale: boolean
}>

export function useCadWorkspace(
  structure: string | null | undefined,
  experiment: string | null | undefined,
  onStructureChange: ((source: string) => void) | undefined,
  onExperimentChange: ((source: string) => void) | undefined,
) {
  const workerRef = useRef<Worker | null>(null)
  const documentHandlersRef = useRef<Partial<Record<CadDocumentType, DocumentWorkerHandlers>>>({})
  const workerMessageRef = useRef<(response: CadWorkerResponse) => void>(() => undefined)
  const workerFailureRef = useRef<(message: string) => void>(() => undefined)
  const evaluationTimeoutsRef = useRef<Partial<Record<CadDocumentType, Readonly<{
    requestId: string
    timeout: number
  }>>>>({})
  const timeoutHandlerRef = useRef<(
    documentType: CadDocumentType,
    requestId: string,
    revision: number,
  ) => void>(() => undefined)
  const activeSolverRequestIdRef = useRef<string | null>(null)
  const solverStartedAtRef = useRef<number | null>(null)
  const recordedDataRef = useRef<RecordedData | null>(null)
  const [process, setProcess] = useState<SolverProcess>(idleSolverProcess)
  const [recordedData, setRecordedData] = useState<RecordedData | null>(null)
  const [stale, setStale] = useState(false)

  const clearEvaluationTimeout = useCallback((documentType: CadDocumentType, requestId?: string) => {
    const active = evaluationTimeoutsRef.current[documentType]
    if (!active || (requestId && active.requestId !== requestId)) return
    window.clearTimeout(active.timeout)
    delete evaluationTimeoutsRef.current[documentType]
  }, [])

  const startWorker = useCallback(() => {
    const worker = new Worker(new URL('../cad/worker/cad.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<CadWorkerResponse>) => workerMessageRef.current(event.data)
    worker.onerror = (event) => workerFailureRef.current(event.message || 'The shared CAD Worker failed.')
    workerRef.current = worker
    return worker
  }, [])

  const postRequest = useCallback((request: CadWorkerRequest) => {
    const worker = workerRef.current ?? startWorker()
    worker.postMessage(request)
  }, [startWorker])

  const requestEvaluation = useCallback((
    documentType: CadDocumentType,
    source: string,
    revision: number,
  ) => {
    clearEvaluationTimeout(documentType)
    const requestId = createRequestId(documentType)
    documentHandlersRef.current[documentType]?.handleStart(requestId, revision)
    postRequest({
      type: 'evaluate-document',
      requestId,
      revision,
      source,
      documentType,
    })
    const timeout = window.setTimeout(
      () => timeoutHandlerRef.current(documentType, requestId, revision),
      3000,
    )
    evaluationTimeoutsRef.current[documentType] = Object.freeze({ requestId, timeout })
  }, [clearEvaluationTimeout, postRequest])

  const invalidateResults = useCallback(() => {
    if (recordedDataRef.current) setStale(true)
  }, [])

  const structureState = useDocumentState({
    source: structure,
    documentType: 'structure',
    onSourceChange: onStructureChange,
    onInvalidate: invalidateResults,
    requestEvaluation,
  })
  const experimentState = useDocumentState({
    source: experiment,
    documentType: 'experiment',
    onSourceChange: onExperimentChange,
    onInvalidate: invalidateResults,
    requestEvaluation,
  })
  documentHandlersRef.current.structure = structureState.handlers
  documentHandlersRef.current.experiment = experimentState.handlers

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

  timeoutHandlerRef.current = (documentType, requestId, revision) => {
    const active = evaluationTimeoutsRef.current[documentType]
    if (!active || active.requestId !== requestId) return
    clearEvaluationTimeout(documentType, requestId)
    const peerType: CadDocumentType = documentType === 'structure' ? 'experiment' : 'structure'
    const peer = documentHandlersRef.current[peerType]?.getSnapshot()
    Object.keys(evaluationTimeoutsRef.current).forEach((key) => clearEvaluationTimeout(key as CadDocumentType))
    workerRef.current?.terminate()
    workerRef.current = null
    documentHandlersRef.current[documentType]?.handleWorkerFailure(
      `Model generation timed out after 3 seconds for revision ${revision}.`,
    )
    cancelProcessForWorkerReset('Solver run was cancelled because the shared CAD Worker restarted.')
    startWorker()
    if (
      peer
      && peer.source !== null
      && peer.source !== undefined
      && peer.successfulRevision === peer.revision
    ) {
      requestEvaluation(peerType, peer.source, peer.revision)
    }
  }

  workerFailureRef.current = (message) => {
    Object.keys(evaluationTimeoutsRef.current).forEach((key) => clearEvaluationTimeout(key as CadDocumentType))
    workerRef.current?.terminate()
    workerRef.current = null
    documentHandlersRef.current.structure?.handleWorkerFailure(message)
    documentHandlersRef.current.experiment?.handleWorkerFailure(message)
    cancelProcessForWorkerReset('Solver run was cancelled because the shared CAD Worker failed.')
  }

  workerMessageRef.current = (response) => {
    if (response.type === 'document-success' || response.type === 'document-error') {
      clearEvaluationTimeout(response.documentType, response.requestId)
      const handlers = documentHandlersRef.current[response.documentType]
      if (response.type === 'document-success') handlers?.handleSuccess(response)
      else handlers?.handleError(response)
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
    const evaluationTimeouts = evaluationTimeoutsRef.current
    startWorker()
    return () => {
      Object.keys(evaluationTimeouts).forEach((key) => {
        const documentType = key as CadDocumentType
        const active = evaluationTimeouts[documentType]
        if (active) window.clearTimeout(active.timeout)
        delete evaluationTimeouts[documentType]
      })
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [startWorker])

  const processActive = process.status === 'preparing' || process.status === 'running'
  const canRun = !processActive
    && structureState.controller.status === 'Ready'
    && experimentState.controller.status === 'Ready'
    && structureState.controller.successfulRevision === structureState.controller.revision
    && experimentState.controller.successfulRevision === experimentState.controller.revision
    && experimentState.controller.solver !== null

  const run = useCallback(() => {
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
  }, [experimentState.controller.solver, postRequest])

  const cancel = useCallback(() => {
    const requestId = activeSolverRequestIdRef.current
    if (!requestId) return
    postRequest({ type: 'cancel-solver', requestId })
  }, [postRequest])

  const simulation: SimulationController = {
    canRun,
    cancel,
    process,
    recordedData,
    run,
    stale,
  }

  return {
    experimentDocument: experimentState.controller,
    simulation,
    structureDocument: structureState.controller,
  }
}
