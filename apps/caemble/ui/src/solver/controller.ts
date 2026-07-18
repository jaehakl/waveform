import { assertEvaluatedDocumentSnapshotV2, type EvaluatedDocumentSnapshotV2 } from '../cad/execution/snapshot'
import { deserializeCadScene } from '../cad/execution/mesh'
import { CadModelError, type RecordedData } from '../cad/model/core'
import { normalizeRecordedData } from '../cad/model/recordedData'
import { SolverRegistry } from './registry'
import type {
  SolverModule,
  SolverModuleInput,
  SolverPreflightInput,
  SolverProcess,
  SolverProcessListener,
  SolverProcessStatus,
} from './types'
import { assertValidSolverContract } from './validation'

const idleProcess: SolverProcess = Object.freeze({
  runId: null,
  status: 'idle',
  solver: null,
  error: null,
  startedAt: null,
  finishedAt: null,
})

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function abortError() {
  const error = new Error('Solver run was cancelled.')
  error.name = 'AbortError'
  return error
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw abortError()
}

function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError())

  return new Promise<T>((resolve, reject) => {
    const handleAbort = () => reject(abortError())
    signal.addEventListener('abort', handleAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', handleAbort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener('abort', handleAbort)
        reject(error)
      },
    )
  })
}

function prepareSolverInput(
  structureSnapshot: EvaluatedDocumentSnapshotV2,
  experimentSnapshot: EvaluatedDocumentSnapshotV2,
): SolverModuleInput {
  assertEvaluatedDocumentSnapshotV2(structureSnapshot)
  assertEvaluatedDocumentSnapshotV2(experimentSnapshot)
  if (structureSnapshot.kind !== 'structure') {
    throw new CadModelError('SolverController requires a Structure snapshot.')
  }
  if (
    experimentSnapshot.kind !== 'experiment'
    || !experimentSnapshot.experimentRules
    || !experimentSnapshot.solver
  ) {
    throw new CadModelError('SolverController requires a complete Experiment snapshot.')
  }
  return Object.freeze({
    structure: Object.freeze({
      vars: structureSnapshot.variables,
      scene: deserializeCadScene(structureSnapshot.scene),
      provenance: Object.freeze({
        apiVersion: structureSnapshot.apiVersion,
        seed: structureSnapshot.seed,
        sourceHash: structureSnapshot.sourceHash,
      }),
    }),
    experiment: Object.freeze({
      vars: experimentSnapshot.variables,
      scene: deserializeCadScene(experimentSnapshot.scene),
      rules: experimentSnapshot.experimentRules,
      solver: experimentSnapshot.solver,
      provenance: Object.freeze({
        apiVersion: experimentSnapshot.apiVersion,
        seed: experimentSnapshot.seed,
        sourceHash: experimentSnapshot.sourceHash,
      }),
    }),
  })
}

export class SolverController {
  private readonly registry: SolverRegistry
  private readonly listeners = new Set<SolverProcessListener>()
  private process: SolverProcess = idleProcess
  private active: Readonly<{ runId: string; abortController: AbortController }> | null = null
  private sequence = 0

  constructor(modules: readonly SolverModule[]) {
    this.registry = new SolverRegistry(modules)
  }

  preflight(input: SolverPreflightInput) {
    return this.registry.preflight(input)
  }

  getProcess() {
    return this.process
  }

  subscribe(listener: SolverProcessListener) {
    this.listeners.add(listener)
    listener(this.process)
    return () => this.listeners.delete(listener)
  }

  cancel() {
    this.active?.abortController.abort()
  }

  async run(
    structureSnapshot: EvaluatedDocumentSnapshotV2,
    experimentSnapshot: EvaluatedDocumentSnapshotV2,
  ): Promise<RecordedData> {
    if (this.active) throw new CadModelError('A solver run is already active.')

    const runId = `solver-${Date.now()}-${this.sequence + 1}`
    this.sequence += 1
    const abortController = new AbortController()
    const solver = experimentSnapshot.kind === 'experiment' && experimentSnapshot.solver
      ? Object.freeze({ name: experimentSnapshot.solver.name, version: experimentSnapshot.solver.version })
      : null
    const startedAt = Date.now()
    this.active = Object.freeze({ runId, abortController })
    this.updateProcess('preparing', { runId, solver, startedAt })

    try {
      const input = prepareSolverInput(structureSnapshot, experimentSnapshot)
      throwIfAborted(abortController.signal)
      const module = this.registry.get(input.experiment.solver.name, input.experiment.solver.version)
      if (!module) {
        throw new CadModelError(
          `No solver module is registered for ${input.experiment.solver.name}@${input.experiment.solver.version}.`,
        )
      }
      assertValidSolverContract(module.spec, input)

      this.updateProcess('running', { runId, solver, startedAt })
      const rawResult = await withAbort(
        Promise.resolve().then(() => module.solve(input, abortController.signal)),
        abortController.signal,
      )
      throwIfAborted(abortController.signal)
      const result = normalizeRecordedData(input.experiment.rules.recordedData, rawResult)
      this.active = null
      this.updateProcess('succeeded', {
        runId,
        solver,
        startedAt,
        finishedAt: Date.now(),
      })
      return result
    } catch (error) {
      const cancelled = abortController.signal.aborted || (error instanceof Error && error.name === 'AbortError')
      if (this.active?.runId === runId) this.active = null
      this.updateProcess(cancelled ? 'cancelled' : 'failed', {
        runId,
        solver,
        startedAt,
        finishedAt: Date.now(),
        error: cancelled ? 'Solver run was cancelled.' : errorMessage(error),
      })
      throw error
    }
  }

  private updateProcess(
    status: SolverProcessStatus,
    values: Partial<Omit<SolverProcess, 'status'>>,
  ) {
    this.process = Object.freeze({
      runId: values.runId ?? null,
      status,
      solver: values.solver ?? null,
      error: values.error ?? null,
      startedAt: values.startedAt ?? null,
      finishedAt: values.finishedAt ?? null,
    })
    this.listeners.forEach((listener) => {
      try {
        listener(this.process)
      } catch {
        // Process observers must not alter solver execution.
      }
    })
  }
}
