import { type CSSProperties, useEffect } from 'react'
import CadEditor from '../editor/CadEditor'
import JscadViewer from '../viewer/JscadViewer'
import GeometryTree from './GeometryTree'
import type { CadDocumentController } from './useCadDocument'

type WorkspaceTab = 'code' | 'tree'

const defaultWorkspaceLeftPercent = 44

function clampWorkspaceLeftPercent(percent: number, workspaceWidth: number) {
  const minimum = Math.max(25, (360 / workspaceWidth) * 100)
  const maximum = Math.min(75, ((workspaceWidth - 320) / workspaceWidth) * 100)
  return Math.min(maximum, Math.max(minimum, percent))
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

export function CadWorkspace({ document }: { document: CadDocumentController }) {
  const {
    documentType,
    draftSelection,
    editorRef,
    handleGroupsChange,
    handleRenderEnd,
    handleRenderError,
    handleRenderStart,
    scene,
    selectedId,
    selection,
    setCode,
    setDraftSelection,
    setSelectedId,
    setWorkspaceLeftPercent,
    setWorkspaceTab,
    workspaceLeftPercent,
    workspaceRef,
    workspaceTab,
  } = document

  useEffect(() => () => {
    editorRef.current = null
  }, [editorRef])

  return (
    <section
      aria-label={`${documentType === 'structure' ? 'Structure' : 'Experiment'} editor`}
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
            modelPath={`file:///${documentType}.tsx`}
            value={document.code}
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
  )
}
