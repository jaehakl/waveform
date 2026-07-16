import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CadDocumentType } from './cad'
import { defaultCode } from './defaultCode'
import { defaultExperimentCode } from './defaultExperimentCode'
import { caembleExamples } from './examples'
import SyntaxHelp from './help/SyntaxHelp'
import { appViewFromHash, viewHashes, type AppView } from './navigation'
import CadViewer from './viewer/CadViewer'
import { StructureExperimentViewer } from './workspace/StructureExperimentViewer'
import { useCadWorkspace } from './workspace/useCadWorkspace'

const defaultWorkspaceLeftPercent = 44

function clampWorkspaceLeftPercent(percent: number, workspaceWidth: number) {
  const minimum = Math.max(25, (360 / workspaceWidth) * 100)
  const maximum = Math.min(75, ((workspaceWidth - 320) / workspaceWidth) * 100)
  return Math.min(maximum, Math.max(minimum, percent))
}

function initialAppView() {
  return typeof window === 'undefined' ? 'viewer' : appViewFromHash(window.location.hash)
}

function navigationClass(active: boolean) {
  return `border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
    active
      ? 'border-slate-950 text-slate-950'
      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900'
  }`
}

function App() {
  const [view, setView] = useState<AppView>(initialAppView)
  const [structure, setStructure] = useState(defaultCode)
  const [experiment, setExperiment] = useState(defaultExperimentCode)
  const [activeDocumentType, setActiveDocumentType] = useState<CadDocumentType>('structure')
  const [workspaceLeftPercent, setWorkspaceLeftPercent] = useState(defaultWorkspaceLeftPercent)
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const { experimentDocument, simulation, structureDocument } = useCadWorkspace(
    structure,
    experiment,
    setStructure,
    setExperiment,
  )
  const {
    handleRenderEnd: handleStructureRenderEnd,
    handleRenderError: handleStructureRenderError,
    handleRenderStart: handleStructureRenderStart,
  } = structureDocument
  const {
    handleRenderEnd: handleExperimentRenderEnd,
    handleRenderError: handleExperimentRenderError,
    handleRenderStart: handleExperimentRenderStart,
  } = experimentDocument

  useEffect(() => {
    const knownHash = Object.values(viewHashes).includes(window.location.hash)
    if (!knownHash) window.history.replaceState(null, '', viewHashes.viewer)

    const handleHashChange = () => setView(appViewFromHash(window.location.hash))
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const selectedExample = caembleExamples.find((example) => example.code === structure)
  const selectedExampleId = selectedExample?.id ?? ''
  const structureViewerDocument = useMemo(() => ({
    scene: structureDocument.scene,
    variables: structureDocument.variables,
  }), [structureDocument.scene, structureDocument.variables])
  const experimentViewerDocument = useMemo(() => ({
    experimentRules: experimentDocument.experimentRules,
    scene: experimentDocument.scene,
    variables: experimentDocument.variables,
  }), [experimentDocument.experimentRules, experimentDocument.scene, experimentDocument.variables])
  const activeDocument = activeDocumentType === 'structure' ? structureDocument : experimentDocument
  const viewerSelection = useMemo(() => activeDocument.selection ? {
    documentType: activeDocumentType,
    selection: activeDocument.selection,
  } : null, [activeDocument.selection, activeDocumentType])
  const handleRenderStart = useCallback((sources: readonly CadDocumentType[]) => {
    if (sources.includes('structure')) handleStructureRenderStart()
    if (sources.includes('experiment')) handleExperimentRenderStart()
  }, [handleExperimentRenderStart, handleStructureRenderStart])
  const handleRenderEnd = useCallback((sources: readonly CadDocumentType[]) => {
    if (sources.includes('structure')) handleStructureRenderEnd()
    if (sources.includes('experiment')) handleExperimentRenderEnd()
  }, [handleExperimentRenderEnd, handleStructureRenderEnd])
  const handleRenderError = useCallback((message: string, sources: readonly CadDocumentType[]) => {
    if (sources.includes('structure')) handleStructureRenderError(message)
    if (sources.includes('experiment')) handleExperimentRenderError(message)
  }, [handleExperimentRenderError, handleStructureRenderError])

  return (
    <main className="flex min-h-screen flex-col bg-white text-slate-950">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-2">
        <div>
          <h1 className="text-base font-semibold leading-5">Caemble</h1>
          <p className="text-xs text-slate-500">
            {view === 'viewer' ? 'Structure + Experiment Viewer' : 'Modeling Reference'}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-4 text-sm">
          <nav aria-label="Main navigation" className="flex items-center gap-4">
            {(['viewer', 'help'] as const).map((targetView) => (
              <a
                aria-current={view === targetView ? 'page' : undefined}
                className={navigationClass(view === targetView)}
                href={viewHashes[targetView]}
                key={targetView}
              >
                {targetView === 'viewer' ? 'Viewer' : 'Help'}
              </a>
            ))}
          </nav>

          {view === 'viewer' ? (
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span>Structure Example</span>
              <select
                aria-label="Select structure example"
                className="max-w-64 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-400 focus:border-slate-500 focus:outline-none"
                title={selectedExample?.description}
                value={selectedExampleId}
                onChange={(event) => {
                  const example = caembleExamples.find(({ id }) => id === event.target.value)
                  if (example) setStructure(example.code)
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
          ) : null}
        </div>
      </header>

      {view === 'viewer' ? (
        <section aria-label="Structure and Experiment viewer" className="flex min-h-0 flex-1 flex-col">
          <div
            className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(360px,var(--workspace-left-width))_5px_minmax(0,1fr)]"
            ref={workspaceRef}
            style={{ '--workspace-left-width': `${workspaceLeftPercent}%` } as CSSProperties}
          >
            <div className="min-h-[360px] min-w-0 border-b border-slate-200 lg:min-h-0 lg:border-b-0">
              <StructureExperimentViewer
                activeDocumentType={activeDocumentType}
                experiment={experiment}
                experimentDocument={experimentDocument}
                structure={structure}
                structureDocument={structureDocument}
                onActiveDocumentTypeChange={setActiveDocumentType}
              />
            </div>

            <div
              aria-label="Resize modeling panels and Viewer"
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

            <CadViewer
              experiment={experimentViewerDocument}
              recordedData={simulation.recordedData}
              selected={viewerSelection}
              simulation={{
                canRun: simulation.canRun,
                cancel: simulation.cancel,
                process: simulation.process,
                run: simulation.run,
                solver: experimentDocument.solver,
                stale: simulation.stale,
              }}
              structure={structureViewerDocument}
              onRenderEnd={handleRenderEnd}
              onRenderError={handleRenderError}
              onRenderStart={handleRenderStart}
            />
          </div>
        </section>
      ) : (
        <SyntaxHelp />
      )}
    </main>
  )
}

export default App
