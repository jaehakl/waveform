import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { editor as MonacoEditor } from 'monaco-editor'
import type {
  CadDocumentType,
  CadScene,
  CadWorkerRequest,
  CadWorkerResponse,
} from '../cad'
import { applyCadSceneGroups } from '../cad/evaluation/groups'
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

function sceneGroupMap(scene: CadScene, property: StructureGroupProperty): StructureGroupMap {
  const groups = property === 'geometryGroup' ? scene.geometryGroups : scene.surfaceGroups
  return Object.fromEntries(groups.map((group) => [group.name, group.memberIds]))
}

export function useCadDocument(
  initialCode: string,
  documentType: CadDocumentType,
  active: boolean,
) {
  const [code, setCode] = useState(initialCode)
  const [error, setError] = useState<RunError | null>(null)
  const [scene, setScene] = useState<CadScene | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draftSelection, setDraftSelection] = useState<DraftSelection | null>(null)
  const [status, setStatus] = useState<AppStatus>('Ready')
  const [workspaceTab, setWorkspaceTab] = useState<'code' | 'tree'>('code')
  const [workspaceLeftPercent, setWorkspaceLeftPercent] = useState(44)
  const activeTimeoutRef = useRef<number | null>(null)
  const activeWorkerRef = useRef<Worker | null>(null)
  const latestRequestIdRef = useRef('')
  const pendingRunRef = useRef<number | null>(null)
  const workspaceRef = useRef<HTMLElement | null>(null)
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)

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
    setStatus('Compiling')
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
      setStatus('Error')
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
        setStatus('Rendering')
        setError(null)
        setScene(response.scene)
        setSelectedId((current) => resolveCadSceneSelection(response.scene, current) ? current : null)
        return
      }

      setStatus('Error')
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
      setStatus('Error')
      setError({ title: 'Runtime Error', message: event.message })
    }

    worker.postMessage({
      type: 'run',
      requestId,
      source,
      documentType,
    } satisfies CadWorkerRequest)
  }, [clearActiveRun, documentType])

  const requestModelRun = useCallback((source: string) => {
    clearPendingRun()
    const requestId = createRequestId()
    latestRequestIdRef.current = requestId
    runModel(source, requestId)
  }, [clearPendingRun, runModel])

  useEffect(() => {
    if (!active) return

    pendingRunRef.current = window.setTimeout(() => {
      pendingRunRef.current = null
      requestModelRun(code)
    }, 500)

    return clearPendingRun
  }, [active, clearPendingRun, code, requestModelRun])

  useEffect(() => {
    if (active) return
    clearPendingRun()
    clearActiveRun()
  }, [active, clearActiveRun, clearPendingRun])

  useEffect(() => () => {
    clearPendingRun()
    clearActiveRun()
  }, [clearActiveRun, clearPendingRun])

  const handleRenderStart = useCallback(() => setStatus('Rendering'), [])
  const handleRenderEnd = useCallback(() => setStatus('Ready'), [])
  const handleRenderError = useCallback((message: string) => {
    setStatus('Error')
    setError({ title: 'Rendering Error', message })
  }, [])

  const runIsBusy = status === 'Compiling' || status === 'Rendering'
  const selection = useMemo(
    () => draftSelection
      ? resolveCadSceneDraftSelection(scene, draftSelection)
      : resolveCadSceneSelection(scene, selectedId),
    [draftSelection, scene, selectedId],
  )

  const handleReroll = useCallback(() => {
    if (runIsBusy) return
    requestModelRun(code)
  }, [code, requestModelRun, runIsBusy])

  const handleGroupsChange = useCallback((property: StructureGroupProperty, groups: StructureGroupMap) => {
    const editor = editorRef.current
    const model = editor?.getModel()
    const source = model?.getValue() ?? code

    try {
      const update = updateModelGroupSource(source, documentType, property, groups)
      if (editor && model && model.getValue() === source) {
        editor.pushUndoStop()
        editor.executeEdits('geometry-tree-groups', update.edits.map((edit) => {
          const start = model.getPositionAt(edit.start)
          const end = model.getPositionAt(edit.end)
          return {
            range: {
              startLineNumber: start.lineNumber,
              startColumn: start.column,
              endLineNumber: end.lineNumber,
              endColumn: end.column,
            },
            text: edit.text,
            forceMoveMarkers: true,
          }
        }))
        editor.pushUndoStop()
        setCode(model.getValue())
      } else {
        setCode(update.source)
      }

      if (scene) {
        const nextScene = applyCadSceneGroups(scene, {
          geometryGroup: property === 'geometryGroup' ? groups : sceneGroupMap(scene, 'geometryGroup'),
          surfaceGroup: property === 'surfaceGroup' ? groups : sceneGroupMap(scene, 'surfaceGroup'),
        })
        setScene(nextScene)
        setSelectedId((current) => resolveCadSceneSelection(nextScene, current) ? current : null)
      }
      setError(null)
    } catch (groupError) {
      setStatus('Error')
      setError({
        title: 'Group Sync Error',
        message: groupError instanceof StructureGroupSyncError || groupError instanceof Error
          ? groupError.message
          : `The ${documentType} group could not be synchronized with Code Space.`,
      })
    }
  }, [code, documentType, scene])

  return {
    code,
    documentType,
    draftSelection,
    editorRef,
    error,
    handleGroupsChange,
    handleRenderEnd,
    handleRenderError,
    handleRenderStart,
    handleReroll,
    runIsBusy,
    scene,
    selectedId,
    selection,
    setCode,
    setDraftSelection,
    setSelectedId,
    setWorkspaceLeftPercent,
    setWorkspaceTab,
    status,
    workspaceLeftPercent,
    workspaceRef,
    workspaceTab,
  }
}

export type CadDocumentController = ReturnType<typeof useCadDocument>
