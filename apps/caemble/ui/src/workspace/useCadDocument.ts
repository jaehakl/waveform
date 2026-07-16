import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CadDocumentType,
  CadScene,
  CadWorkerRequest,
  CadWorkerResponse,
  EvaluatedExperimentRules,
  Vars,
} from '../cad'
import { resolveCadSceneDraftSelection, resolveCadSceneSelection } from '../cad/evaluation/selection'
import type { StructureGroupMap } from '../cad/model/core'
import {
  StructureGroupSyncError,
  updateModelGroupSource,
  type StructureGroupProperty,
} from '../cad/source/structureGroups'
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

function createRequestId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

export function useCadDocument(
  source: string | null | undefined,
  documentType: CadDocumentType,
  active: boolean,
  onSourceChange: ((source: string) => void) | undefined,
) {
  const [error, setError] = useState<RunError | null>(null)
  const [experimentRules, setExperimentRules] = useState<EvaluatedExperimentRules | null>(null)
  const [scene, setScene] = useState<CadScene | null>(null)
  const [variables, setVariables] = useState<Readonly<Vars> | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draftSelection, setDraftSelection] = useState<DraftSelection | null>(null)
  const [status, setStatus] = useState<AppStatus>('Ready')
  const activeTimeoutRef = useRef<number | null>(null)
  const activeWorkerRef = useRef<Worker | null>(null)
  const latestRequestIdRef = useRef('')
  const pendingRunRef = useRef<number | null>(null)
  const statusRef = useRef<AppStatus>('Ready')

  const updateStatus = useCallback((nextStatus: AppStatus) => {
    statusRef.current = nextStatus
    setStatus(nextStatus)
  }, [])

  const clearPendingRun = useCallback(() => {
    if (pendingRunRef.current === null) return
    window.clearTimeout(pendingRunRef.current)
    pendingRunRef.current = null
  }, [])

  const clearActiveRun = useCallback(() => {
    if (activeTimeoutRef.current !== null) {
      window.clearTimeout(activeTimeoutRef.current)
      activeTimeoutRef.current = null
    }
    activeWorkerRef.current?.terminate()
    activeWorkerRef.current = null
  }, [])

  const runModel = useCallback((source: string, requestId: string) => {
    clearActiveRun()
    updateStatus('Compiling')
    setError(null)

    const worker = new Worker(new URL('../cad/worker/cad.worker.ts', import.meta.url), {
      type: 'module',
    })
    activeWorkerRef.current = worker

    activeTimeoutRef.current = window.setTimeout(() => {
      if (latestRequestIdRef.current !== requestId) return

      worker.terminate()
      activeWorkerRef.current = null
      activeTimeoutRef.current = null
      updateStatus('Error')
      setError({
        title: 'Timeout Error',
        message: 'Model generation timed out after 3 seconds.',
      })
    }, 3000)

    worker.onmessage = (event: MessageEvent<CadWorkerResponse>) => {
      const response = event.data
      if (response.requestId !== latestRequestIdRef.current) return

      if (activeTimeoutRef.current !== null) {
        window.clearTimeout(activeTimeoutRef.current)
        activeTimeoutRef.current = null
      }

      worker.terminate()
      activeWorkerRef.current = null

      if (response.type === 'success') {
        updateStatus('Ready')
        setError(null)
        setScene(response.scene)
        setVariables(response.variables)
        setExperimentRules(response.experimentRules ?? null)
        setSelectedId((current) => resolveCadSceneSelection(response.scene, current) ? current : null)
        return
      }

      updateStatus('Error')
      setError({
        title: errorTitles[response.errorType],
        message: response.message,
        stack: response.stack,
      })
    }

    worker.onerror = (event) => {
      if (latestRequestIdRef.current !== requestId) return

      if (activeTimeoutRef.current !== null) {
        window.clearTimeout(activeTimeoutRef.current)
        activeTimeoutRef.current = null
      }

      worker.terminate()
      activeWorkerRef.current = null
      updateStatus('Error')
      setError({ title: 'Runtime Error', message: event.message })
    }

    worker.postMessage({
      type: 'run',
      requestId,
      source,
      documentType,
    } satisfies CadWorkerRequest)
  }, [clearActiveRun, documentType, updateStatus])

  const requestModelRun = useCallback((source: string) => {
    clearPendingRun()
    const requestId = createRequestId()
    latestRequestIdRef.current = requestId
    runModel(source, requestId)
  }, [clearPendingRun, runModel])

  useEffect(() => {
    if (!active || source === null || source === undefined) return

    pendingRunRef.current = window.setTimeout(() => {
      pendingRunRef.current = null
      requestModelRun(source)
    }, 500)

    return clearPendingRun
  }, [active, clearPendingRun, requestModelRun, source])

  useEffect(() => {
    if (active) return
    clearPendingRun()
    clearActiveRun()
  }, [active, clearActiveRun, clearPendingRun])

  useEffect(() => () => {
    clearPendingRun()
    clearActiveRun()
  }, [clearActiveRun, clearPendingRun])

  useEffect(() => {
    if (source !== null && source !== undefined) return

    clearPendingRun()
    clearActiveRun()
    setDraftSelection(null)
    setError(null)
    setExperimentRules(null)
    setScene(null)
    setSelectedId(null)
    setVariables(null)
    updateStatus('Ready')
  }, [clearActiveRun, clearPendingRun, source, updateStatus])

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
    requestModelRun(source)
  }, [requestModelRun, runIsBusy, source])

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

  return {
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
    runIsBusy,
    scene,
    selectedId,
    selection,
    setDraftSelection,
    setSelectedId,
    status,
    variables,
  }
}

export type CadDocumentController = ReturnType<typeof useCadDocument>
