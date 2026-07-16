import { type CSSProperties, useEffect, useState } from 'react'
import type { CadDocumentType } from '../cad'
import CadEditor from '../editor/CadEditor'
import JscadViewer from '../viewer/JscadViewer'
import GeometryTree from './GeometryTree'
import { useCadDocument, type CadDocumentController } from './useCadDocument'

export type StructureExperimentViewerProps = {
  structure?: string | null
  experiment?: string | null
  onStructureChange?: (source: string) => void
  onExperimentChange?: (source: string) => void
}

const workspaceTabs = [
  { id: 'structure-source', documentType: 'structure', panel: 'source', label: 'Structure Source' },
  { id: 'structure-tree', documentType: 'structure', panel: 'tree', label: 'Structure Tree' },
  { id: 'experiment-source', documentType: 'experiment', panel: 'source', label: 'Experiment Source' },
  { id: 'experiment-tree', documentType: 'experiment', panel: 'tree', label: 'Experiment Tree' },
] as const

type WorkspaceTab = (typeof workspaceTabs)[number]['id']

const defaultWorkspaceLeftPercent = 44

function clampWorkspaceLeftPercent(percent: number, workspaceWidth: number) {
  const minimum = Math.max(25, (360 / workspaceWidth) * 100)
  const maximum = Math.min(75, ((workspaceWidth - 320) / workspaceWidth) * 100)
  return Math.min(maximum, Math.max(minimum, percent))
}

function Status({ document }: { document: CadDocumentController }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          document.status === 'Error'
            ? 'bg-rose-500'
            : document.status === 'Ready'
              ? 'bg-emerald-500'
              : 'bg-amber-500'
        }`}
      />
      <span className="font-medium text-slate-700">{document.status}</span>
    </div>
  )
}

export function StructureExperimentViewer({
  experiment,
  onExperimentChange,
  onStructureChange,
  structure,
}: StructureExperimentViewerProps) {
  const hasStructure = structure !== null && structure !== undefined
  const hasExperiment = experiment !== null && experiment !== undefined
  const availableTabs = workspaceTabs.filter((tab) => (
    tab.documentType === 'structure' ? hasStructure : hasExperiment
  ))
  const [activeTab, setActiveTab] = useState<WorkspaceTab | null>(() => (
    hasStructure ? 'structure-source' : hasExperiment ? 'experiment-source' : null
  ))
  const selectedTab = activeTab && availableTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : availableTabs[0]?.id ?? null
  const activeDocumentType: CadDocumentType | null = selectedTab?.startsWith('structure')
    ? 'structure'
    : selectedTab
      ? 'experiment'
      : null
  const structureDocument = useCadDocument(
    structure,
    'structure',
    activeDocumentType === 'structure',
    onStructureChange,
  )
  const experimentDocument = useCadDocument(
    experiment,
    'experiment',
    activeDocumentType === 'experiment',
    onExperimentChange,
  )
  const activeDocument = activeDocumentType === 'structure'
    ? structureDocument
    : activeDocumentType === 'experiment'
      ? experimentDocument
      : null

  useEffect(() => {
    if (activeTab !== selectedTab) setActiveTab(selectedTab)
  }, [activeTab, selectedTab])

  if (!activeDocument) {
    return (
      <section
        aria-label="Structure and Experiment viewer"
        className="grid min-h-0 flex-1 place-items-center bg-slate-50 px-6 py-16 text-center"
      >
        <div>
          <h2 className="text-base font-semibold text-slate-800">No modeling source</h2>
          <p className="mt-2 text-sm text-slate-500">Provide a Structure or Experiment source to open the viewer.</p>
        </div>
      </section>
    )
  }

  return (
    <section aria-label="Structure and Experiment viewer" className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-3">
        <div
          aria-label="Structure and Experiment panels"
          className="flex min-w-0 items-center gap-1 overflow-x-auto"
          role="tablist"
        >
          {availableTabs.map((tab) => (
            <button
              aria-controls={`${tab.id}-panel`}
              aria-selected={selectedTab === tab.id}
              className={`h-12 shrink-0 border-b-2 px-3 text-xs font-semibold uppercase tracking-wide ${
                selectedTab === tab.id
                  ? 'border-slate-900 text-slate-950'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
              id={`${tab.id}-tab`}
              key={tab.id}
              role="tab"
              tabIndex={selectedTab === tab.id ? 0 : -1}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-3 pb-1 text-sm sm:pb-0">
          <button
            aria-label={`Reroll ${activeDocument.documentType}`}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={activeDocument.runIsBusy}
            title={`Re-run the current ${activeDocument.documentType} code`}
            type="button"
            onClick={activeDocument.handleReroll}
          >
            Reroll
          </button>
          <Status document={activeDocument} />
        </div>
      </div>

      <div
        className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(360px,var(--workspace-left-width))_5px_minmax(0,1fr)]"
        ref={activeDocument.workspaceRef}
        style={{ '--workspace-left-width': `${activeDocument.workspaceLeftPercent}%` } as CSSProperties}
      >
        <div className="min-h-[360px] border-b border-slate-200 lg:min-h-0 lg:border-b-0">
          {availableTabs.map((tab) => {
            const document = tab.documentType === 'structure' ? structureDocument : experimentDocument
            const source = tab.documentType === 'structure' ? structure : experiment

            return (
              <div
                aria-labelledby={`${tab.id}-tab`}
                className={selectedTab === tab.id ? 'h-full min-h-0' : 'hidden'}
                hidden={selectedTab !== tab.id}
                id={`${tab.id}-panel`}
                key={tab.id}
                role="tabpanel"
              >
                {tab.panel === 'source' ? (
                  <CadEditor
                    modelPath={`file:///${tab.documentType}.tsx`}
                    readOnly={document.readOnly}
                    value={source ?? ''}
                    onChange={document.handleSourceChange}
                  />
                ) : (
                  <GeometryTree
                    draftSelection={document.draftSelection}
                    readOnly={document.readOnly}
                    scene={document.scene}
                    selectedId={document.selectedId}
                    onDraftSelectionChange={document.setDraftSelection}
                    onGroupsChange={document.handleGroupsChange}
                    onSelect={document.setSelectedId}
                  />
                )}
              </div>
            )
          })}
        </div>

        <div
          aria-label="Resize modeling panels and Viewer"
          aria-orientation="vertical"
          aria-valuemax={75}
          aria-valuemin={25}
          aria-valuenow={Math.round(activeDocument.workspaceLeftPercent)}
          className="group hidden cursor-col-resize touch-none items-stretch justify-center bg-slate-100 outline-none hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500 lg:flex"
          role="separator"
          tabIndex={0}
          onDoubleClick={() => activeDocument.setWorkspaceLeftPercent(defaultWorkspaceLeftPercent)}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            const workspaceWidth = activeDocument.workspaceRef.current?.getBoundingClientRect().width
            if (!workspaceWidth) return
            event.preventDefault()
            activeDocument.setWorkspaceLeftPercent((current) => clampWorkspaceLeftPercent(
              current + (event.key === 'ArrowLeft' ? -2 : 2),
              workspaceWidth,
            ))
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
            const bounds = activeDocument.workspaceRef.current?.getBoundingClientRect()
            if (!bounds) return
            const percent = ((event.clientX - bounds.left) / bounds.width) * 100
            activeDocument.setWorkspaceLeftPercent(clampWorkspaceLeftPercent(percent, bounds.width))
          }}
          onPointerUp={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }}
        >
          <span className="w-px bg-slate-300 group-hover:bg-slate-400" />
        </div>

        <div className="min-h-[360px] min-w-0">
          <JscadViewer
            onRenderEnd={activeDocument.handleRenderEnd}
            onRenderError={activeDocument.handleRenderError}
            onRenderStart={activeDocument.handleRenderStart}
            parts={activeDocument.scene?.parts ?? []}
            selection={activeDocument.selection}
          />
        </div>
      </div>

      <footer className="min-h-24 shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3">
        {activeDocument.error ? (
          <div className="max-h-36 overflow-auto">
            <div className="text-sm font-semibold text-rose-700">{activeDocument.error.title}</div>
            <pre className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-700">
              {activeDocument.error.message}
              {activeDocument.error.stack ? `\n\n${activeDocument.error.stack}` : ''}
            </pre>
          </div>
        ) : (
          <div className="text-sm text-slate-600">
            {activeDocument.documentType === 'structure'
              ? 'Edit the Structure and Sample. Successful geometry remains visible while new errors are shown here.'
              : 'Edit the Experiment and Setup. Structure targets remain name-based until simulation time.'}
          </div>
        )}
      </footer>
    </section>
  )
}
