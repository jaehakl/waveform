import { evaluateCadScene } from '../cad/evaluation/evaluator'
import type { CadScene, CadSceneGroup } from '../cad/evaluation/types'
import {
  CadModelError,
  evaluateExperimentRules,
  evaluateExperimentSolver,
  evaluateWithVars,
  Sample,
  Setup,
  type EvaluatedExperimentRules,
  type RecordedData,
} from '../cad/model/core'
import { normalizeRecordedData } from '../cad/model/recordedData'
import type {
  SolverModule,
  SolverModuleInput,
  SolverProcess,
  SolverProcessListener,
  SolverProcessStatus,
} from './types'

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

function groupForTarget(scene: CadScene, kind: string, groupName: string): CadSceneGroup | undefined {
  const groups = kind === 'geometry' ? scene.geometryGroups : scene.surfaceGroups
  return groups.find((group) => group.name === groupName)
}

function validateTarget(
  target: string,
  structureScene: CadScene,
  experimentScene: CadScene,
) {
  const firstSeparator = target.indexOf('.')
  const secondSeparator = target.indexOf('.', firstSeparator + 1)
  const source = target.slice(0, firstSeparator)
  const kind = target.slice(firstSeparator + 1, secondSeparator)
  const groupName = target.slice(secondSeparator + 1)
  const scene = source === 'structure' ? structureScene : experimentScene
  const group = groupForTarget(scene, kind, groupName)
  if (!group) {
    throw new CadModelError(`Simulation target ${target} references a missing ${source} ${kind} group.`)
  }
  if (group.missingMemberIds.length > 0) {
    throw new CadModelError(
      `Simulation target ${target} contains missing members: ${group.missingMemberIds.join(', ')}.`,
    )
  }
  const resolvedIds = kind === 'geometry' ? group.geometryIds : group.surfaceIds
  if (resolvedIds.length === 0) {
    throw new CadModelError(`Simulation target ${target} does not resolve to any ${kind}.`)
  }
}

function validateTargets(
  rules: EvaluatedExperimentRules,
  structureScene: CadScene,
  experimentScene: CadScene,
) {
  ;[
    ...rules.initialConditions,
    ...rules.boundaryConditions,
    ...rules.recordedData,
  ].forEach((rule) => {
    rule.target.forEach((target) => validateTarget(target, structureScene, experimentScene))
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

  validateTargets(experimentEvaluation.rules, structureScene, experimentEvaluation.scene)
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
  private readonly modules = new Map<string, Map<string, SolverModule>>()
  private readonly listeners = new Set<SolverProcessListener>()
  private process: SolverProcess = idleProcess
  private active: Readonly<{ runId: string; abortController: AbortController }> | null = null
  private sequence = 0

  constructor(modules: readonly SolverModule[]) {
    modules.forEach((module) => {
      if (!module.name.trim() || !module.version.trim()) {
        throw new CadModelError('Solver module name and version must be non-empty strings.')
      }
      const versions = this.modules.get(module.name) ?? new Map<string, SolverModule>()
      if (versions.has(module.version)) {
        throw new CadModelError(`Solver module ${module.name}@${module.version} is registered more than once.`)
      }
      versions.set(module.version, module)
      this.modules.set(module.name, versions)
    })
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
      const module = this.modules.get(input.experiment.solver.name)?.get(input.experiment.solver.version)
      if (!module) {
        throw new CadModelError(
          `No solver module is registered for ${input.experiment.solver.name}@${input.experiment.solver.version}.`,
        )
      }

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
