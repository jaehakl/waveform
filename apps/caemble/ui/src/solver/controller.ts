import { evaluateCadScene } from '../cad/evaluation/evaluator'
import {
  CadModelError,
  evaluateExperimentRules,
  evaluateExperimentSolver,
  evaluateWithVars,
  Sample,
  Setup,
  type RecordedData,
} from '../cad/model/core'
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

function prepareSolverInput(sample: Sample, setup: Setup): SolverModuleInput {
  if (!(sample instanceof Sample)) throw new CadModelError('SolverController requires a Sample instance.')
  if (!(setup instanceof Setup)) throw new CadModelError('SolverController requires a Setup instance.')

  const structureScene = evaluateWithVars(sample.vars, () => evaluateCadScene(sample.structure.geometry(), {
    geometryGroup: sample.structure.geometryGroup,
    surfaceGroup: sample.structure.surfaceGroup,
  }, 'Structure', sample.structure.lengthUnit))
  const experimentEvaluation = evaluateWithVars(setup.vars, () => {
    const experiment = setup.experiment
    const solver = evaluateExperimentSolver(experiment)
    const scene = evaluateCadScene(experiment.geometry(), {
      geometryGroup: experiment.geometryGroup,
      surfaceGroup: experiment.surfaceGroup,
    }, 'Experiment', experiment.lengthUnit)
    const rules = evaluateExperimentRules(experiment)
    return Object.freeze({ rules, scene, solver })
  })

  return Object.freeze({
    structure: Object.freeze({
      model: sample.structure,
      vars: sample.vars,
      scene: structureScene,
    }),
    experiment: Object.freeze({
      model: setup.experiment,
      vars: setup.vars,
      scene: experimentEvaluation.scene,
      rules: experimentEvaluation.rules,
      solver: experimentEvaluation.solver,
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

  async run(sample: Sample, setup: Setup): Promise<RecordedData> {
    if (this.active) throw new CadModelError('A solver run is already active.')

    const runId = `solver-${Date.now()}-${this.sequence + 1}`
    this.sequence += 1
    const abortController = new AbortController()
    const solver = setup instanceof Setup
      ? Object.freeze({ name: setup.experiment.solver.name, version: setup.experiment.solver.version })
      : null
    const startedAt = Date.now()
    this.active = Object.freeze({ runId, abortController })
    this.updateProcess('preparing', { runId, solver, startedAt })

    try {
      const input = prepareSolverInput(sample, setup)
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
