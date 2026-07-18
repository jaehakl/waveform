import {
  CadModelError,
  evaluateExperimentRules,
  evaluateExperimentSolver,
  evaluateWithVars,
  Mat,
  Material,
} from '../model/core'
import {
  experiment,
  ExperimentDefinitionV2,
  structure,
  StructureDefinitionV2,
  type CadDefinitionV2,
  type ExternalVars,
} from '../model/v2'
import { evaluateCadScene } from '../evaluation/evaluator'
import { Fragment, h } from '../evaluation/jsx'
import type { CadDocumentType } from '../worker/protocol'
import type { EvaluatedRuntimeDocumentSnapshotV2 } from './snapshot'
import {
  assertCompiledCadProjectV2,
  type CompiledCadProjectV2,
} from '../compiler/types'

const coreModuleV2 = Object.freeze({
  experiment,
  Mat,
  Material,
  structure,
})

export type CadExecutionResult = EvaluatedRuntimeDocumentSnapshotV2
export type CadDocumentEntry = CadDefinitionV2

export function requireCaembleModule(specifier: string) {
  if (specifier !== '@caemble/core/v2') {
    throw new CadModelError(`Only @caemble/core/v2 can be imported. Received: ${specifier}`)
  }
  return coreModuleV2
}

export function loadCompiledCode(
  jsCode: string,
  documentType: CadDocumentType,
): CadDocumentEntry {
  const exports: Record<string, unknown> = {}
  const module = { exports }
  const runner = new Function(
    'h',
    'Fragment',
    'require',
    'exports',
    'module',
    `"use strict";\n${jsCode}\nreturn module.exports;`,
  )
  const moduleExports = runner(h, Fragment, requireCaembleModule, exports, module) as Record<string, unknown>
  return assertDocumentEntry(moduleExports.default ?? exports.default, documentType)
}

function assertDocumentEntry(entry: unknown, documentType: CadDocumentType): CadDocumentEntry {
  if (documentType === 'experiment') {
    if (!(entry instanceof ExperimentDefinitionV2)) {
      throw new CadModelError('Experiment Source must export default experiment({...}).')
    }
    return entry
  }
  if (!(entry instanceof StructureDefinitionV2) || entry instanceof ExperimentDefinitionV2) {
    throw new CadModelError('Structure Source must export default structure({...}).')
  }
  return entry
}

function resolveCompiledImport(
  importer: string,
  specifier: string,
  modules: CompiledCadProjectV2['modules'],
) {
  const segments = importer.split('/').slice(0, -1)
  specifier.split('/').forEach((segment) => {
    if (!segment || segment === '.') return
    if (segment === '..') {
      if (segments.length === 0) throw new CadModelError(`Import escapes the compiled project: ${specifier}`)
      segments.pop()
    } else {
      segments.push(segment)
    }
  })
  const resolved = segments.join('/')
  const candidates = /\.(?:ts|tsx)$/.test(resolved)
    ? [resolved]
    : [`${resolved}.ts`, `${resolved}.tsx`, `${resolved}/index.ts`, `${resolved}/index.tsx`]
  const match = candidates.find((candidate) => Object.prototype.hasOwnProperty.call(modules, candidate))
  if (!match) throw new CadModelError(`Compiled project import was not found: ${importer} -> ${specifier}`)
  return match
}

export function loadCompiledProject(
  project: CompiledCadProjectV2,
  documentType: CadDocumentType,
): CadDocumentEntry {
  assertCompiledCadProjectV2(project)
  const cache = new Map<string, unknown>()

  const executeModule = (path: string): unknown => {
    if (cache.has(path)) return cache.get(path)
    const compiledModule = project.modules[path]
    if (!compiledModule) throw new CadModelError(`Compiled CAD module was not found: ${path}`)
    const exports: Record<string, unknown> = {}
    const module: { exports: unknown } = { exports }
    cache.set(path, exports)
    const localRequire = (specifier: string) => {
      if (specifier === '@caemble/core/v2') return coreModuleV2
      if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
        throw new CadModelError(`Compiled CAD import is not allowed: ${specifier}`)
      }
      return executeModule(resolveCompiledImport(path, specifier, project.modules))
    }
    const runner = new Function(
      'h',
      'Fragment',
      'require',
      'exports',
      'module',
      `${compiledModule.code}\nreturn module.exports;`,
    )
    const result = runner(h, Fragment, localRequire, exports, module) as unknown
    const moduleExports = result ?? module.exports
    cache.set(path, moduleExports)
    return moduleExports
  }

  const entryModule = executeModule(project.entryFile)
  const entry = typeof entryModule === 'object' && entryModule !== null
    ? (entryModule as Record<string, unknown>).default
    : undefined
  return assertDocumentEntry(entry, documentType)
}

export function evaluateDocumentEntry(
  entry: CadDocumentEntry,
  documentType: CadDocumentType,
  sourceHash: string,
  seed: number,
  partialVars: ExternalVars = {},
): CadExecutionResult {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new CadModelError('Evaluation seed must be a non-negative safe integer.')
  }

  if (documentType === 'experiment') {
    if (!(entry instanceof ExperimentDefinitionV2)) {
      throw new CadModelError('Experiment Source must export default experiment({...}).')
    }
    const variables = entry.resolveExternal(partialVars, seed)
    const experimentModel = entry.createRuntimeFromResolved(variables)
    return evaluateWithVars(variables, () => {
      const solver = evaluateExperimentSolver(experimentModel)
      const scene = evaluateCadScene(experimentModel.geometry(), {
        geometryGroup: experimentModel.geometryGroup,
        surfaceGroup: experimentModel.surfaceGroup,
      }, 'Experiment', experimentModel.lengthUnit)
      const experimentRules = evaluateExperimentRules(experimentModel)
      return Object.freeze({
        kind: 'experiment' as const,
        sourceHash,
        apiVersion: 2 as const,
        seed,
        scene,
        variables,
        experimentRules,
        solver,
      })
    }, seed)
  }

  if (!(entry instanceof StructureDefinitionV2) || entry instanceof ExperimentDefinitionV2) {
    throw new CadModelError('Structure Source must export default structure({...}).')
  }
  const variables = entry.resolveExternal(partialVars, seed)
  return evaluateWithVars(variables, () => Object.freeze({
    kind: 'structure' as const,
    sourceHash,
    apiVersion: 2 as const,
    seed,
    scene: evaluateCadScene(entry.evaluateResolvedGeometry(variables), {
      geometryGroup: entry.geometryGroup,
      surfaceGroup: entry.surfaceGroup,
    }, 'Structure', entry.lengthUnit),
    variables,
  }), seed)
}

export function executeCompiledCode(
  jsCode: string,
  documentType: CadDocumentType = 'structure',
  sourceHash = 'test-source',
  seed = 0,
  partialVars: ExternalVars = {},
) {
  return evaluateDocumentEntry(
    loadCompiledCode(jsCode, documentType),
    documentType,
    sourceHash,
    seed,
    partialVars,
  )
}

export function executeCompiledProject(
  project: CompiledCadProjectV2,
  documentType: CadDocumentType,
  seed: number,
  partialVars: ExternalVars = {},
) {
  return evaluateDocumentEntry(
    loadCompiledProject(project, documentType),
    documentType,
    project.sourceHash,
    seed,
    partialVars,
  )
}
