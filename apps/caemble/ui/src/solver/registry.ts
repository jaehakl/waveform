import { CadModelError } from '../cad/model/core'
import type { SolverValidationResult } from './spec'
import type { SolverModule, SolverPreflightInput } from './types'
import { assertSolverSpec, validateSolverContract } from './validation'

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  Reflect.ownKeys(value).forEach((key) => deepFreeze((value as Record<PropertyKey, unknown>)[key]))
  return Object.freeze(value)
}

export class SolverRegistry {
  private readonly modules = new Map<string, Map<string, SolverModule>>()

  constructor(modules: readonly SolverModule[]) {
    modules.forEach((module) => {
      assertSolverSpec(module.spec)
      deepFreeze(module.spec)
      const { name, version } = module.spec
      const versions = this.modules.get(name) ?? new Map<string, SolverModule>()
      if (versions.has(version)) {
        throw new CadModelError(`Solver module ${name}@${version} is registered more than once.`)
      }
      versions.set(version, Object.freeze(module))
      this.modules.set(name, versions)
    })
  }

  get(name: string, version: string) {
    return this.modules.get(name)?.get(version)
  }

  preflight(input: SolverPreflightInput): SolverValidationResult {
    const { name, version } = input.experiment.solver
    const module = this.get(name, version)
    if (module) return validateSolverContract(module.spec, input)
    return Object.freeze({
      complete: input.structure !== undefined,
      issues: Object.freeze([Object.freeze({
        documentType: 'experiment' as const,
        path: 'solver',
        message: `No solver module is registered for ${name}@${version}.`,
      })]),
    })
  }
}
