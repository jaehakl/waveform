import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { editor as MonacoEditor } from 'monaco-editor'
import CadEditor from './editor/CadEditor'
import { defaultCode } from './defaultCode'
import { caembleExamples } from './examples'
import SyntaxHelp from './help/SyntaxHelp'
import type { CadScene, CadWorkerRequest, CadWorkerResponse } from './cad'
import { applyCadSceneGroups } from './cad/evaluation/groups'
import { resolveCadSceneDraftSelection, resolveCadSceneSelection } from './cad/evaluation/selection'
import type { StructureGroupMap } from './cad/model/core'
import {
  StructureGroupSyncError,
  updateStructureGroupSource,
  type StructureGroupProperty,
} from './cad/source/structureGroups'
import JscadViewer from './viewer/JscadViewer'
import GeometryTree from './workspace/GeometryTree'
import type { DraftSelection } from './workspace/groupDraft'

type AppStatus = 'Ready' | 'Compiling' | 'Rendering' | 'Error'
type AppView = 'workspace' | 'help'
type WorkspaceTab = 'code' | 'tree'

const defaultWorkspaceLeftPercent = 44

function clampWorkspaceLeftPercent(percent: number, workspaceWidth: number) {
  const minimum = Math.max(25, (360 / workspaceWidth) * 100)
  const maximum = Math.min(75, ((workspaceWidth - 320) / workspaceWidth) * 100)
  return Math.min(maximum, Math.max(minimum, percent))
}

type RunError = {
  title: string
  message: string
  stack?: string
}

const errorTitles = {
  compile: 'Compile Error',
  model: 'Model Error',
  runtime: 'Runtime Error',
}

export function WorkspaceTabBar({
  activeTab,
  geometryCount,
  onSelect,
}: {
  activeTab: WorkspaceTab
  geometryCount: number
  onSelect: (tab: WorkspaceTab) => void
}) {
  return (
    <div
      aria-label="Workspace panels"
      className="flex h-11 shrink-0 items-center border-b border-slate-200 px-2"
      role="tablist"
    >
      <button
        aria-controls="workspace-code-panel"
        aria-selected={activeTab === 'code'}
        className={`h-full border-b-2 px-3 text-xs font-semibold uppercase tracking-wide ${
          activeTab === 'code'
            ? 'border-slate-900 text-slate-950'
            : 'border-transparent text-slate-500 hover:text-slate-800'
        }`}
        id="workspace-code-tab"
        role="tab"
        tabIndex={activeTab === 'code' ? 0 : -1}
        type="button"
        onClick={() => onSelect('code')}
      >
        Code Space
      </button>
      <button
        aria-controls="workspace-tree-panel"
        aria-selected={activeTab === 'tree'}
        className={`h-full border-b-2 px-3 text-xs font-semibold uppercase tracking-wide ${
          activeTab === 'tree'
            ? 'border-slate-900 text-slate-950'
            : 'border-transparent text-slate-500 hover:text-slate-800'
        }`}
        id="workspace-tree-tab"
        role="tab"
        tabIndex={activeTab === 'tree' ? 0 : -1}
        type="button"
        onClick={() => onSelect('tree')}
      >
        Geometry Tree
      </button>
      {activeTab === 'tree' ? (
        <span className="ml-auto pr-1 text-[10px] text-slate-400">{geometryCount} geometries</span>
      ) : null}
    </div>
  )
}

function createRequestId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function sceneGroupMap(scene: CadScene, property: StructureGroupProperty): StructureGroupMap {
  const groups = property === 'geometryGroup' ? scene.geometryGroups : scene.surfaceGroups
  return Object.fromEntries(groups.map((group) => [group.name, group.memberIds]))
}

function App() {
  const [code, setCode] = useState(defaultCode)
  const [error, setError] = useState<RunError | null>(null)
  const [scene, setScene] = useState<CadScene | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draftSelection, setDraftSelection] = useState<DraftSelection | null>(null)
  const [status, setStatus] = useState<AppStatus>('Ready')
  const [view, setView] = useState<AppView>('workspace')
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('code')
  const [workspaceLeftPercent, setWorkspaceLeftPercent] = useState(defaultWorkspaceLeftPercent)
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

  const runModel = useCallback(
    (source: string, requestId: string) => {
      clearActiveRun()
      setStatus('Compiling')
      setError(null)

      const worker = new Worker(new URL('./cad/worker/cad.worker.ts', import.meta.url), {
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
          setSelectedId((current) => {
            return resolveCadSceneSelection(response.scene, current) ? current : null
          })
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
        setError({
          title: 'Runtime Error',
          message: event.message,
        })
      }

      worker.postMessage({
        type: 'run',
        requestId,
        source,
      } satisfies CadWorkerRequest)
    },
    [clearActiveRun],
  )

  const requestModelRun = useCallback(
    (source: string) => {
      clearPendingRun()
      const requestId = createRequestId()
      latestRequestIdRef.current = requestId
      runModel(source, requestId)
    },
    [clearPendingRun, runModel],
  )

  useEffect(() => {
    pendingRunRef.current = window.setTimeout(() => {
      pendingRunRef.current = null
      requestModelRun(code)
    }, 500)

    return clearPendingRun
  }, [clearPendingRun, code, requestModelRun])

  useEffect(() => clearActiveRun, [clearActiveRun])

  const handleRenderStart = useCallback(() => {
    setStatus('Rendering')
  }, [])

  const handleRenderEnd = useCallback(() => {
    setStatus('Ready')
  }, [])

  const handleRenderError = useCallback((message: string) => {
    setStatus('Error')
    setError({
      title: 'Rendering Error',
      message,
    })
  }, [])

  const runIsBusy = status === 'Compiling' || status === 'Rendering'
  const selection = useMemo(
    () => draftSelection
      ? resolveCadSceneDraftSelection(scene, draftSelection)
      : resolveCadSceneSelection(scene, selectedId),
    [draftSelection, scene, selectedId],
  )
  const selectedExample = caembleExamples.find((example) => example.code === code)
  const selectedExampleId = selectedExample?.id ?? ''

  const handleReroll = useCallback(() => {
    if (runIsBusy) return
    requestModelRun(code)
  }, [code, requestModelRun, runIsBusy])

  const handleGroupsChange = useCallback((property: StructureGroupProperty, groups: StructureGroupMap) => {
    const editor = editorRef.current
    const model = editor?.getModel()
    const source = model?.getValue() ?? code

    try {
      const update = updateStructureGroupSource(source, property, groups)
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
          : 'The Structure group could not be synchronized with Code Space.',
      })
    }
  }, [code, scene])

  return (
    <main className="flex min-h-screen flex-col bg-white text-slate-950">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-2">
        <div>
          <h1 className="text-base font-semibold leading-5">Caemble</h1>
          <p className="text-xs text-slate-500">Code to CAD</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex rounded border border-slate-200 bg-slate-50 p-0.5">
            <button
              className={`px-3 py-1 text-sm font-medium ${
                view === 'workspace' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'
              }`}
              type="button"
              onClick={() => setView('workspace')}
            >
              Workspace
            </button>
            <button
              className={`px-3 py-1 text-sm font-medium ${
                view === 'help' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'
              }`}
              type="button"
              onClick={() => setView('help')}
            >
              Syntax Help
            </button>
          </div>

          {view === 'workspace' ? (
            <>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <span>Example</span>
                <select
                  aria-label="Select example"
                  className="max-w-64 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-400 focus:border-slate-500 focus:outline-none"
                  title={selectedExample?.description}
                  value={selectedExampleId}
                  onChange={(event) => {
                    const example = caembleExamples.find(({ id }) => id === event.target.value)
                    if (!example) return
                    setCode(example.code)
                  }}
                >
                  <option disabled value="">Custom</option>
                  {caembleExamples.map((example) => (
                    <option key={example.id} title={example.description} value={example.id}>
                      {example.title}
                    </option>
                  ))}
                </select>
              </label>
              <button
                aria-label="Reroll random structure"
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={runIsBusy}
                title="Re-run the current code to generate a new random structure"
                type="button"
                onClick={handleReroll}
              >
                Reroll
              </button>
            </>
          ) : null}

          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                status === 'Error'
                  ? 'bg-rose-500'
                  : status === 'Ready'
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
              }`}
            />
            <span className="font-medium text-slate-700">{status}</span>
          </div>
        </div>
      </header>

      {view === 'workspace' ? (
        <section
          className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(360px,var(--workspace-left-width))_5px_minmax(0,1fr)]"
          ref={workspaceRef}
          style={{ '--workspace-left-width': `${workspaceLeftPercent}%` } as CSSProperties}
        >
          <div className="flex min-h-[360px] flex-col border-b border-slate-200 lg:min-h-0 lg:border-b-0">
            <WorkspaceTabBar
              activeTab={workspaceTab}
              geometryCount={scene?.parts.length ?? 0}
              onSelect={setWorkspaceTab}
            />

            <div
              aria-labelledby="workspace-code-tab"
              className={workspaceTab === 'code' ? 'min-h-0 flex-1' : 'hidden'}
              hidden={workspaceTab !== 'code'}
              id="workspace-code-panel"
              role="tabpanel"
            >
              <CadEditor
                value={code}
                onChange={setCode}
                onMount={(editor) => {
                  editorRef.current = editor
                }}
              />
            </div>

            <div
              aria-labelledby="workspace-tree-tab"
              className={workspaceTab === 'tree' ? 'min-h-0 flex-1' : 'hidden'}
              hidden={workspaceTab !== 'tree'}
              id="workspace-tree-panel"
              role="tabpanel"
            >
              <GeometryTree
                draftSelection={draftSelection}
                scene={scene}
                selectedId={selectedId}
                onDraftSelectionChange={setDraftSelection}
                onGroupsChange={handleGroupsChange}
                onSelect={setSelectedId}
              />
            </div>
          </div>

          <div
            aria-label="Resize Code Space and Viewer"
            aria-orientation="vertical"
            aria-valuemax={75}
            aria-valuemin={25}
            aria-valuenow={Math.round(workspaceLeftPercent)}
            className="group hidden cursor-col-resize touch-none items-stretch justify-center bg-slate-100 outline-none hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500 lg:flex"
            role="separator"
            tabIndex={0}
            onDoubleClick={() => setWorkspaceLeftPercent(defaultWorkspaceLeftPercent)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
              const workspaceWidth = workspaceRef.current?.getBoundingClientRect().width
              if (!workspaceWidth) return
              event.preventDefault()
              setWorkspaceLeftPercent((current) => clampWorkspaceLeftPercent(
                current + (event.key === 'ArrowLeft' ? -2 : 2),
                workspaceWidth,
              ))
            }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
              const bounds = workspaceRef.current?.getBoundingClientRect()
              if (!bounds) return
              const percent = ((event.clientX - bounds.left) / bounds.width) * 100
              setWorkspaceLeftPercent(clampWorkspaceLeftPercent(percent, bounds.width))
            }}
            onPointerUp={(event) => {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }}
          >
            <span className="w-px bg-slate-300 group-hover:bg-slate-400" />
          </div>

          <div className="min-h-[360px] min-w-0">
            <JscadViewer
              onRenderEnd={handleRenderEnd}
              onRenderError={handleRenderError}
              onRenderStart={handleRenderStart}
              parts={scene?.parts ?? []}
              selection={selection}
            />
          </div>
        </section>
      ) : (
        <SyntaxHelp />
      )}

      <footer className="min-h-24 shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3">
        {error ? (
          <div className="max-h-36 overflow-auto">
            <div className="text-sm font-semibold text-rose-700">{error.title}</div>
            <pre className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-700">
              {error.message}
              {error.stack ? `\n\n${error.stack}` : ''}
            </pre>
          </div>
        ) : (
          <div className="text-sm text-slate-600">
            Edit the Structure and Sample on the left. Successful geometry remains visible while new errors are shown here.
          </div>
        )}
      </footer>
    </main>
  )
}

export default App
