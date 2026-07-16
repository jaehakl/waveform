import { useEffect, useState } from 'react'
import { defaultCode } from './defaultCode'
import { defaultExperimentCode } from './defaultExperimentCode'
import { caembleExamples } from './examples'
import SyntaxHelp from './help/SyntaxHelp'
import { appViewFromHash, viewHashes, type AppView } from './navigation'
import { StructureExperimentViewer } from './workspace/StructureExperimentViewer'

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

  useEffect(() => {
    const knownHash = Object.values(viewHashes).includes(window.location.hash)
    if (!knownHash) window.history.replaceState(null, '', viewHashes.viewer)

    const handleHashChange = () => setView(appViewFromHash(window.location.hash))
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const selectedExample = caembleExamples.find((example) => example.code === structure)
  const selectedExampleId = selectedExample?.id ?? ''

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
        <StructureExperimentViewer
          experiment={experiment}
          structure={structure}
          onExperimentChange={setExperiment}
          onStructureChange={setStructure}
        />
      ) : (
        <SyntaxHelp />
      )}
    </main>
  )
}

export default App
