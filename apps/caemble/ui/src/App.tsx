import { useEffect, useState } from 'react'
import { defaultCode } from './defaultCode'
import { defaultExperimentCode } from './defaultExperimentCode'
import { caembleExamples } from './examples'
import SyntaxHelp from './help/SyntaxHelp'
import { appViewFromHash, viewHashes, type AppView } from './navigation'
import { CadWorkspace, WorkspaceTabBar } from './workspace/CadWorkspace'
import { useCadDocument, type CadDocumentController } from './workspace/useCadDocument'

export { WorkspaceTabBar }

function initialAppView() {
  return typeof window === 'undefined' ? 'structure' : appViewFromHash(window.location.hash)
}

function navigationClass(active: boolean) {
  return `border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
    active
      ? 'border-slate-950 text-slate-950'
      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900'
  }`
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

function App() {
  const [view, setView] = useState<AppView>(initialAppView)
  const structureDocument = useCadDocument(defaultCode, 'structure', view === 'structure')
  const experimentDocument = useCadDocument(defaultExperimentCode, 'experiment', view === 'experiment')

  useEffect(() => {
    const knownHash = Object.values(viewHashes).includes(window.location.hash)
    if (!knownHash) window.history.replaceState(null, '', viewHashes.structure)

    const handleHashChange = () => setView(appViewFromHash(window.location.hash))
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const activeDocument = view === 'structure'
    ? structureDocument
    : view === 'experiment'
      ? experimentDocument
      : null
  const selectedExample = caembleExamples.find((example) => example.code === structureDocument.code)
  const selectedExampleId = selectedExample?.id ?? ''
  const pageDescription = view === 'structure'
    ? 'Structure Editor'
    : view === 'experiment'
      ? 'Experiment Editor'
      : 'Modeling Reference'

  return (
    <main className="flex min-h-screen flex-col bg-white text-slate-950">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-2">
        <div>
          <h1 className="text-base font-semibold leading-5">Caemble</h1>
          <p className="text-xs text-slate-500">{pageDescription}</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-4 text-sm">
          <nav aria-label="Main navigation" className="flex items-center gap-4">
            {(['structure', 'experiment', 'help'] as const).map((targetView) => (
              <a
                aria-current={view === targetView ? 'page' : undefined}
                className={navigationClass(view === targetView)}
                href={viewHashes[targetView]}
                key={targetView}
              >
                {targetView === 'structure' ? 'Structure' : targetView === 'experiment' ? 'Experiment' : 'Help'}
              </a>
            ))}
          </nav>

          {view === 'structure' ? (
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span>Example</span>
              <select
                aria-label="Select example"
                className="max-w-64 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-400 focus:border-slate-500 focus:outline-none"
                title={selectedExample?.description}
                value={selectedExampleId}
                onChange={(event) => {
                  const example = caembleExamples.find(({ id }) => id === event.target.value)
                  if (example) structureDocument.setCode(example.code)
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

          {activeDocument ? (
            <>
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
            </>
          ) : null}
        </div>
      </header>

      {view === 'structure' ? (
        <CadWorkspace document={structureDocument} />
      ) : view === 'experiment' ? (
        <CadWorkspace document={experimentDocument} />
      ) : (
        <SyntaxHelp />
      )}

      <footer className="min-h-24 shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3">
        {activeDocument?.error ? (
          <div className="max-h-36 overflow-auto">
            <div className="text-sm font-semibold text-rose-700">{activeDocument.error.title}</div>
            <pre className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-700">
              {activeDocument.error.message}
              {activeDocument.error.stack ? `\n\n${activeDocument.error.stack}` : ''}
            </pre>
          </div>
        ) : (
          <div className="text-sm text-slate-600">
            {view === 'structure'
              ? 'Edit the Structure and Sample on the left. Successful geometry remains visible while new errors are shown here.'
              : view === 'experiment'
                ? 'Edit the Experiment and Setup on the left. Structure targets remain name-based until simulation time.'
                : 'Structure and Experiment syntax share the same CAD geometry and vars conventions.'}
          </div>
        )}
      </footer>
    </main>
  )
}

export default App
