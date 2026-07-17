import { useEffect, useState } from 'react'
import type { CadDocumentType } from '../cad'
import CadEditor from '../editor/CadEditor'
import ExperimentalParameters from './ExperimentalParameters'
import GeometryTree from './GeometryTree'
import SolverSpecSheet from './SolverSpecSheet'
import type { CadDocumentController } from './useCadWorkspace'

export type StructureExperimentViewerProps = {
  activeDocumentType: CadDocumentType | null
  structure?: string | null
  experiment?: string | null
  structureDocument: CadDocumentController
  experimentDocument: CadDocumentController
  onActiveDocumentTypeChange: (documentType: CadDocumentType) => void
}

const workspaceTabs = [
  { id: 'structure-source', documentType: 'structure', panel: 'source', label: 'Structure Source' },
  { id: 'structure-tree', documentType: 'structure', panel: 'tree', label: 'Structure Tree' },
  { id: 'experiment-source', documentType: 'experiment', panel: 'source', label: 'Experiment Source' },
  { id: 'experiment-tree', documentType: 'experiment', panel: 'tree', label: 'Experiment Tree' },
  {
    id: 'experimental-parameters',
    documentType: 'experiment',
    panel: 'parameters',
    label: 'Experimental Parameters',
  },
  { id: 'solver-spec', documentType: 'experiment', panel: 'spec', label: 'Solver Spec' },
] as const

type WorkspaceTab = (typeof workspaceTabs)[number]['id']

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
  activeDocumentType,
  experiment,
  experimentDocument,
  onActiveDocumentTypeChange,
  structure,
  structureDocument,
}: StructureExperimentViewerProps) {
  const hasStructure = structure !== null && structure !== undefined
  const hasExperiment = experiment !== null && experiment !== undefined
  const availableTabs = workspaceTabs.filter((tab) => (
    tab.documentType === 'structure' ? hasStructure : hasExperiment
  ))
  const [activeTab, setActiveTab] = useState<WorkspaceTab | null>(() => (
    activeDocumentType === 'experiment' && hasExperiment
      ? 'experiment-source'
      : hasStructure
        ? 'structure-source'
        : hasExperiment
          ? 'experiment-source'
          : null
  ))
  const selectedTab = activeTab && availableTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : availableTabs[0]?.id ?? null
  const selectedDocumentType: CadDocumentType | null = selectedTab?.startsWith('structure')
    ? 'structure'
    : selectedTab
      ? 'experiment'
      : null
  const activeDocument = selectedDocumentType === 'structure'
    ? structureDocument
    : selectedDocumentType === 'experiment'
      ? experimentDocument
      : null

  useEffect(() => {
    if (activeTab !== selectedTab) setActiveTab(selectedTab)
    if (selectedDocumentType && selectedDocumentType !== activeDocumentType) {
      onActiveDocumentTypeChange(selectedDocumentType)
    }
  }, [activeDocumentType, activeTab, onActiveDocumentTypeChange, selectedDocumentType, selectedTab])

  if (!activeDocument) {
    return (
      <section
        aria-label="Structure and Experiment workspace"
        className="grid h-full min-h-[360px] place-items-center bg-slate-50 px-6 py-16 text-center"
      >
        <div>
          <h2 className="text-base font-semibold text-slate-800">No modeling source</h2>
          <p className="mt-2 text-sm text-slate-500">Provide a Structure or Experiment source to open the workspace.</p>
        </div>
      </section>
    )
  }

  return (
    <section
      aria-label="Structure and Experiment workspace"
      className="flex h-full min-h-[360px] min-w-0 flex-col bg-white"
    >
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
              onClick={() => {
                setActiveTab(tab.id)
                onActiveDocumentTypeChange(tab.documentType)
              }}
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
            title={`Re-evaluate and randomize the current ${activeDocument.documentType}`}
            type="button"
            onClick={activeDocument.handleReroll}
          >
            Reroll
          </button>
          <Status document={activeDocument} />
        </div>
      </div>

      <div className="min-h-0 flex-1">
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
              ) : tab.panel === 'tree' ? (
                <GeometryTree
                  draftSelection={document.draftSelection}
                  readOnly={document.readOnly}
                  scene={document.scene}
                  selectedId={document.selectedId}
                  onDraftSelectionChange={document.setDraftSelection}
                  onGroupsChange={document.handleGroupsChange}
                  onSelect={document.setSelectedId}
                />
              ) : tab.panel === 'parameters' ? (
                <ExperimentalParameters
                  onSourceChange={experimentDocument.handleSourceChange}
                  readOnly={experimentDocument.readOnly}
                  rules={experimentDocument.experimentRules}
                  source={experiment ?? ''}
                />
              ) : (
                <SolverSpecSheet
                  solver={experimentDocument.solver}
                  spec={experimentDocument.solverSpec}
                />
              )}
            </div>
          )
        })}
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
