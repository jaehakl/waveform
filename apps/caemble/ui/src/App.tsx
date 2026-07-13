import { useCallback, useEffect, useRef, useState } from 'react'
import CadEditor from './editor/CadEditor'
import { defaultCode } from './defaultCode'
import { caembleExamples } from './examples'
import SyntaxHelp from './help/SyntaxHelp'
import type { CadScenePart, CadWorkerRequest, CadWorkerResponse } from './cad'
import JscadViewer from './viewer/JscadViewer'

type AppStatus = 'Ready' | 'Compiling' | 'Rendering' | 'Error'
type AppView = 'workspace' | 'help'

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

function createRequestId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function App() {
  const [code, setCode] = useState(defaultCode)
  const [error, setError] = useState<RunError | null>(null)
  const [parts, setParts] = useState<CadScenePart[]>([])
  const [status, setStatus] = useState<AppStatus>('Ready')
  const [view, setView] = useState<AppView>('workspace')
  const activeTimeoutRef = useRef<number | null>(null)
  const activeWorkerRef = useRef<Worker | null>(null)
  const latestRequestIdRef = useRef('')
  const pendingRunRef = useRef<number | null>(null)

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
          setParts(response.parts)
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
  const selectedExample = caembleExamples.find((example) => example.code === code)
  const selectedExampleId = selectedExample?.id ?? ''

  const handleReroll = useCallback(() => {
    if (runIsBusy) return
    requestModelRun(code)
  }, [code, requestModelRun, runIsBusy])

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
        <section className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(360px,44%)_minmax(0,1fr)]">
          <div className="min-h-[360px] border-b border-slate-200 lg:min-h-0 lg:border-b-0 lg:border-r">
            <CadEditor value={code} onChange={setCode} />
          </div>

          <div className="min-h-[360px] min-w-0">
            <JscadViewer
              onRenderEnd={handleRenderEnd}
              onRenderError={handleRenderError}
              onRenderStart={handleRenderStart}
              parts={parts}
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
