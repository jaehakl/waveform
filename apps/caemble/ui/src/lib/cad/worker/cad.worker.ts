import {
  applyFrozenMaterialParameters,
  assertBuiltRealizationV2,
  type BuiltRealizationV2,
  type BuiltSampleV2,
  type BuiltSetupV2,
} from '../execution/realization'
import { SolverController } from '../../solver'
import { solverModules } from '../../solver/modules'
import type { CadDocumentType, CadWorkerRequest, CadWorkerResponse } from './protocol'
import { deserializeCadScene } from '../execution/mesh'

let activeSolverRequestId: string | null = null
const cachedEntries: Partial<
  Record<
    CadDocumentType,
    Readonly<{
      revision: number
      realization: BuiltRealizationV2
    }>
  >
> = {}
const solverController = new SolverController(solverModules)

function postResponse(response: CadWorkerResponse) {
  self.postMessage(response)
}

solverController.subscribe((process) => {
  if (!activeSolverRequestId) return
  postResponse({ type: 'solver-process', requestId: activeSolverRequestId, process })
})

function postSolverPreflight() {
  const experiment = cachedEntries.experiment
  if (experiment?.realization.kind !== 'setup') return
  const experimentSnapshot = experiment.realization.experiment
  if (!experimentSnapshot.experimentRules || !experimentSnapshot.solver) return
  const structure = cachedEntries.structure
  const result = solverController.preflight({
    ...(structure?.realization.kind === 'sample'
      ? {
          structure: {
            scene: applyFrozenMaterialParameters(
              deserializeCadScene(structure.realization.structure.scene),
              structure.realization.materialParameters,
            ),
          },
        }
      : {}),
    experiment: {
      scene: applyFrozenMaterialParameters(
        deserializeCadScene(experimentSnapshot.scene),
        experiment.realization.materialParameters,
      ),
      rules: experimentSnapshot.experimentRules,
      solver: experimentSnapshot.solver,
    },
  })
  postResponse({
    type: 'solver-preflight',
    requestId: `preflight-${structure?.revision ?? 'none'}-${experiment.revision}`,
    ...(structure ? { structureRevision: structure.revision } : {}),
    experimentRevision: experiment.revision,
    result,
  })
}

function cacheRealization(request: Extract<CadWorkerRequest, { type: 'cache-realization' }>) {
  try {
    assertBuiltRealizationV2(request.realization)
    if (!Number.isSafeInteger(request.revision) || request.revision < 0) {
      throw new Error('Snapshot revision is invalid.')
    }
    const documentType = request.realization.kind === 'sample' ? 'structure' : 'experiment'
    const current = cachedEntries[documentType]
    if (current && current.revision > request.revision) return
    cachedEntries[documentType] = Object.freeze({
      revision: request.revision,
      realization: request.realization,
    })
    postSolverPreflight()
  } catch (error) {
    postResponse({
      type: 'solver-error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

async function runSolver(request: Extract<CadWorkerRequest, { type: 'run-solver' }>) {
  const structure = cachedEntries.structure
  const experiment = cachedEntries.experiment
  if (
    !structure ||
    !experiment ||
    structure.revision !== request.structureRevision ||
    experiment.revision !== request.experimentRevision
  ) {
    postResponse({
      type: 'solver-error',
      requestId: request.requestId,
      message: 'Both current Structure and Experiment snapshots must be ready before running the solver.',
    })
    return
  }
  if (activeSolverRequestId) {
    postResponse({ type: 'solver-error', requestId: request.requestId, message: 'A solver run is already active.' })
    return
  }

  activeSolverRequestId = request.requestId
  try {
    const recordedData = await solverController.run(
      structure.realization as BuiltSampleV2,
      experiment.realization as BuiltSetupV2,
    )
    const structureSnapshot = (structure.realization as BuiltSampleV2).structure
    const experimentSnapshot = (experiment.realization as BuiltSetupV2).experiment
    postResponse({
      type: 'solver-success',
      requestId: request.requestId,
      structureRevision: request.structureRevision,
      experimentRevision: request.experimentRevision,
      recordedData,
      provenance: Object.freeze({
        structure: Object.freeze({
          apiVersion: structureSnapshot.apiVersion,
          sourceHash: structureSnapshot.sourceHash,
          seed: structureSnapshot.seed,
          vars: structureSnapshot.variables,
        }),
        experiment: Object.freeze({
          apiVersion: experimentSnapshot.apiVersion,
          sourceHash: experimentSnapshot.sourceHash,
          seed: experimentSnapshot.seed,
          vars: experimentSnapshot.variables,
        }),
        solver: Object.freeze({
          name: experimentSnapshot.solver!.name,
          version: experimentSnapshot.solver!.version,
        }),
      }),
    })
  } catch {
    // SolverController publishes the failed or cancelled process state.
  } finally {
    activeSolverRequestId = null
  }
}

self.onmessage = (event: MessageEvent<CadWorkerRequest>) => {
  const message = event.data
  if (message.type === 'cache-realization') {
    cacheRealization(message)
  } else if (message.type === 'run-solver') {
    void runSolver(message)
  } else if (message.type === 'cancel-solver' && activeSolverRequestId === message.requestId) {
    solverController.cancel()
  }
}

export {}
