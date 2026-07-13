import { Material, Sample, Structure, CadModelError, evaluateWithVars, vars } from '../model/core'
import { evaluateCad } from '../evaluation/evaluator'
import { Fragment, h } from '../evaluation/jsx'

const coreModule = Object.freeze({ Material, Sample, Structure })

export function requireCaembleModule(specifier: string) {
  if (specifier !== '@caemble/core') {
    throw new CadModelError(`Only @caemble/core can be imported. Received: ${specifier}`)
  }

  return coreModule
}

export function executeCompiledCode(jsCode: string) {
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

  if (!(entry instanceof Sample)) {
    throw new CadModelError('The default export must be a Sample instance.')
  }

  return evaluateWithVars(entry.vars, () => evaluateCad(entry.structure.geometry()))
}


