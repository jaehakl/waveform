import { assertEvaluatedDocumentSnapshotV2, type EvaluatedDocumentSnapshotV2 } from '../execution/snapshot'
import { SolverController } from '../../solver'
import { solverModules } from '../../solver/modules'
import type { CadDocumentType, CadWorkerRequest, CadWorkerResponse } from './protocol'
import { deserializeCadScene } from '../execution/mesh'

let activeSolverRequestId: string | null = null
const cachedEntries: Partial<Record<CadDocumentType, Readonly<{
  revision: number
  snapshot: EvaluatedDocumentSnapshotV2
}>>> = {}
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
  if (!experiment?.snapshot.experimentRules || !experiment.snapshot.solver) return
  const structure = cachedEntries.structure
  const result = solverController.preflight({
    ...(structure ? { structure: { scene: deserializeCadScene(structure.snapshot.scene) } } : {}),
    experiment: {
      scene: deserializeCadScene(experiment.snapshot.scene),
      rules: experiment.snapshot.experimentRules,
      solver: experiment.snapshot.solver,
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

function cacheSnapshot(request: Extract<CadWorkerRequest, { type: 'cache-snapshot' }>) {
  try {
    assertEvaluatedDocumentSnapshotV2(request.snapshot)
    if (!Number.isSafeInteger(request.revision) || request.revision < 0) {
      throw new Error('Snapshot revision is invalid.')
    }
    const current = cachedEntries[request.snapshot.kind]
    if (current && current.revision > request.revision) return
    cachedEntries[request.snapshot.kind] = Object.freeze({
      revision: request.revision,
      snapshot: request.snapshot,
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
    !structure
    || !experiment
    || structure.revision !== request.structureRevision
    || experiment.revision !== request.experimentRevision
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
    const recordedData = await solverController.run(structure.snapshot, experiment.snapshot)
    postResponse({
      type: 'solver-success',
      requestId: request.requestId,
      structureRevision: request.structureRevision,
      experimentRevision: request.experimentRevision,
      recordedData,
      provenance: Object.freeze({
        structure: Object.freeze({
          apiVersion: structure.snapshot.apiVersion,
          sourceHash: structure.snapshot.sourceHash,
          seed: structure.snapshot.seed,
          vars: structure.snapshot.variables,
        }),
        experiment: Object.freeze({
          apiVersion: experiment.snapshot.apiVersion,
          sourceHash: experiment.snapshot.sourceHash,
          seed: experiment.snapshot.seed,
          vars: experiment.snapshot.variables,
        }),
        solver: Object.freeze({
          name: experiment.snapshot.solver!.name,
          version: experiment.snapshot.solver!.version,
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
  if (message.type === 'cache-snapshot') {
    cacheSnapshot(message)
  } else if (message.type === 'run-solver') {
    void runSolver(message)
  } else if (message.type === 'cancel-solver' && activeSolverRequestId === message.requestId) {
    solverController.cancel()
  }
}

export {}
