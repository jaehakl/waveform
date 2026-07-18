import {
  CadModelError,
  evaluateExperimentRules,
  evaluateExperimentSolver,
  evaluateWithVars,
  Experiment,
  Material,
  Sample,
  Setup,
  Structure,
  VariableObject,
  vars,
} from '../model/core'
import { evaluateCadScene } from '../evaluation/evaluator'
import { Fragment, h } from '../evaluation/jsx'
import type { CadScene } from '../evaluation/types'
import type { EvaluatedExperimentRules, ResolvedExperimentSolver } from '../model/core'
import type { Vars } from '../model/types'
import type { CadDocumentType } from '../worker/protocol'
import { IDENTITY_CARTESIAN_BASIS } from '../../quantitykind'

const coreModule = Object.freeze({
  Experiment,
  IDENTITY_CARTESIAN_BASIS,
  Material,
  Sample,
  Setup,
  Structure,
  VariableObject,
})

export type CadExecutionResult = Readonly<{
  scene: CadScene
  variables: Readonly<Vars>
  experimentRules?: EvaluatedExperimentRules
  solver?: ResolvedExperimentSolver
}>

export type CadDocumentEntry = Sample | Setup

export function requireCaembleModule(specifier: string) {
  if (specifier !== '@caemble/core') {
    throw new CadModelError(`Only @caemble/core can be imported. Received: ${specifier}`)
  }

  return coreModule
}

export function loadCompiledCode(
  jsCode: string,
  documentType: CadDocumentType = 'structure',
): CadDocumentEntry {
  const exports: Record<string, unknown> = {}
  const module = { exports }
  const runner = new Function(
    'h',
    'Fragment',
    'require',
    'vars',
    'exports',
    'module',
    `"use strict";\n${jsCode}\nreturn module.exports;`,
  )
  const moduleExports = runner(h, Fragment, requireCaembleModule, vars, exports, module) as Record<string, unknown>
  const entry = moduleExports.default ?? exports.default

  if (documentType === 'experiment') {
    if (!(entry instanceof Setup)) {
      throw new CadModelError('The default export must be a Setup instance in the Experiment editor.')
    }
    return entry
  }

  if (!(entry instanceof Sample)) {
    throw new CadModelError('The default export must be a Sample instance in the Structure editor.')
  }

  return entry
}

export function evaluateDocumentEntry(
  entry: CadDocumentEntry,
  documentType: CadDocumentType = 'structure',
): CadExecutionResult {
  if (documentType === 'experiment') {
    if (!(entry instanceof Setup)) {
      throw new CadModelError('The default export must be a Setup instance in the Experiment editor.')
    }

    return evaluateWithVars(entry.vars, () => {
      const experiment = entry.experiment
      const solver = evaluateExperimentSolver(experiment)
      const scene = evaluateCadScene(experiment.geometry(), {
        geometryGroup: experiment.geometryGroup,
        surfaceGroup: experiment.surfaceGroup,
      }, 'Experiment', experiment.lengthUnit)
      const experimentRules = evaluateExperimentRules(experiment)
      return Object.freeze({ scene, variables: entry.vars, experimentRules, solver })
    })
  }

  if (!(entry instanceof Sample)) {
    throw new CadModelError('The default export must be a Sample instance in the Structure editor.')
  }

  return evaluateWithVars(entry.vars, () => Object.freeze({
    scene: evaluateCadScene(entry.structure.geometry(), {
      geometryGroup: entry.structure.geometryGroup,
      surfaceGroup: entry.structure.surfaceGroup,
    }, 'Structure', entry.structure.lengthUnit),
    variables: entry.vars,
  }))
}

export function executeCompiledCode(
  jsCode: string,
  documentType: CadDocumentType = 'structure',
): CadExecutionResult {
  return evaluateDocumentEntry(loadCompiledCode(jsCode, documentType), documentType)
}


