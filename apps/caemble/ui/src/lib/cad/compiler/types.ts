import { CadModelError } from '../model/errors'
import {
  CAEMBLE_CORE_V2_DECLARATION_VERSION,
  CAEMBLE_MONACO_VERSION,
} from '../api/generatedVersions'

export const CAD_COMPILER_VERSION = `monaco-${CAEMBLE_MONACO_VERSION}-core-v${CAEMBLE_CORE_V2_DECLARATION_VERSION}-simulation-v3-compiler-v2` as const

export type CompiledCadModuleV2 = Readonly<{
  code: string
  sourceMap?: string
}>

export type CompiledCadProjectV2 = Readonly<{
  apiVersion: 2
  compilerVersion: typeof CAD_COMPILER_VERSION
  entryFile: string
  modules: Readonly<Record<string, CompiledCadModuleV2>>
  sourceHash: string
}>

export function assertCompiledCadProjectV2(value: unknown): asserts value is CompiledCadProjectV2 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CadModelError('Compiled CAD project must be an object.')
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new CadModelError('Compiled CAD project must be a plain object.')
  }
  const unknownProjectKey = Object.keys(value).find((key) => (
    !['apiVersion', 'compilerVersion', 'entryFile', 'modules', 'sourceHash'].includes(key)
  ))
  if (unknownProjectKey) throw new CadModelError(`Compiled CAD project.${unknownProjectKey} is not allowed.`)
  const project = value as Partial<CompiledCadProjectV2>
  if (
    project.apiVersion !== 2
    || project.compilerVersion !== CAD_COMPILER_VERSION
    || typeof project.sourceHash !== 'string'
    || !/^[0-9a-f]{64}$/.test(project.sourceHash)
    || typeof project.entryFile !== 'string'
  ) {
    throw new CadModelError('Compiled CAD project provenance is invalid.')
  }
  if (typeof project.modules !== 'object' || project.modules === null || Array.isArray(project.modules)) {
    throw new CadModelError('Compiled CAD project modules must be an object.')
  }
  if (Object.getPrototypeOf(project.modules) !== Object.prototype) {
    throw new CadModelError('Compiled CAD project modules must be a plain object.')
  }
  const entries = Object.entries(project.modules)
  if (
    entries.length === 0
    || entries.length > 32
    || !Object.prototype.hasOwnProperty.call(project.modules, project.entryFile)
  ) {
    throw new CadModelError('Compiled CAD project module set is invalid.')
  }
  let bytes = 0
  entries.forEach(([path, module]) => {
    if (
      !path
      || path.includes('\\')
      || path.startsWith('/')
      || !/\.(?:ts|tsx)$/.test(path)
      || path.split('/').some((segment) => !segment || segment === '.' || segment === '..')
    ) {
      throw new CadModelError(`Compiled CAD module path is invalid: ${path}`)
    }
    if (typeof module !== 'object' || module === null || typeof module.code !== 'string') {
      throw new CadModelError(`Compiled CAD module is invalid: ${path}`)
    }
    if (
      Object.getPrototypeOf(module) !== Object.prototype
      || Object.keys(module).some((key) => key !== 'code' && key !== 'sourceMap')
    ) {
      throw new CadModelError(`Compiled CAD module must be a plain exact object: ${path}`)
    }
    if (module.sourceMap !== undefined && typeof module.sourceMap !== 'string') {
      throw new CadModelError(`Compiled CAD source map is invalid: ${path}`)
    }
    bytes += module.code.length + (module.sourceMap?.length ?? 0)
  })
  if (bytes > 4 * 1024 * 1024) throw new CadModelError('Compiled CAD project exceeds 4 MiB.')
}
