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
import type { CadDocumentType } from '../worker/protocol'

const coreModule = Object.freeze({ Experiment, Material, Sample, Setup, Structure, VariableObject })

export function requireCaembleModule(specifier: string) {
  if (specifier !== '@caemble/core') {
    throw new CadModelError(`Only @caemble/core can be imported. Received: ${specifier}`)
  }

  return coreModule
}

export function executeCompiledCode(jsCode: string, documentType: CadDocumentType = 'structure') {
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

    return evaluateWithVars(entry.vars, () => {
      const experiment = entry.experiment
      evaluateExperimentSolver(experiment)
      const scene = evaluateCadScene(experiment.geometry(), {
        geometryGroup: experiment.geometryGroup,
        surfaceGroup: experiment.surfaceGroup,
      }, 'Experiment')
      evaluateExperimentRules(experiment)
      return scene
    })
  }

  if (!(entry instanceof Sample)) {
    throw new CadModelError('The default export must be a Sample instance in the Structure editor.')
  }

  return evaluateWithVars(entry.vars, () => evaluateCadScene(entry.structure.geometry(), {
    geometryGroup: entry.structure.geometryGroup,
    surfaceGroup: entry.structure.surfaceGroup,
  }))
}


