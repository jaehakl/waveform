import type { MaterialVariable, MaterialVariables } from './descriptor'
import { CadModelError } from './errors'
import {
  isPlainObject,
  normalizeMaterialDataValueDescriptor,
  normalizeRawScalar,
} from './core'

export class Material {
  readonly symbol: string
  readonly version?: string
  readonly variables: MaterialVariables

  constructor(symbol: string)
  constructor(symbol: string, variables: MaterialVariables)
  constructor(symbol: string, version: string)
  constructor(symbol: string, version: string, variables: MaterialVariables)
  constructor(
    symbol: string,
    versionOrVariables?: string | MaterialVariables,
    versionVariables?: MaterialVariables,
  ) {
    if (typeof symbol !== 'string' || !symbol.trim()) {
      throw new CadModelError('Material symbol must be a non-empty string.')
    }
    if (typeof versionOrVariables !== 'string' && arguments.length === 3) {
      throw new CadModelError('Material variables must follow a string version when a third argument is supplied.')
    }
    const version = typeof versionOrVariables === 'string' ? versionOrVariables.trim() : undefined
    if (typeof versionOrVariables === 'string' && !version) {
      throw new CadModelError(`Material ${symbol} version must be a non-empty string.`)
    }
    const rawVariables = typeof versionOrVariables === 'string'
      ? versionVariables === undefined ? {} : versionVariables
      : versionOrVariables === undefined ? {} : versionOrVariables
    if (!isPlainObject(rawVariables)) {
      throw new CadModelError(`Material ${symbol} variables must be a plain object.`)
    }
    const normalizedVariables: Record<string, MaterialVariable> = {}
    Object.entries(rawVariables).forEach(([key, value]) => {
      if (!key.trim()) throw new CadModelError(`Material ${symbol} variable names must not be empty.`)
      const path = `Material ${symbol} variables.${key}`
      normalizedVariables[key] = isPlainObject(value)
        ? normalizeMaterialDataValueDescriptor(value, path)
        : normalizeRawScalar(value, path)
    })
    if (normalizedVariables.color !== undefined) {
      if (typeof normalizedVariables.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(normalizedVariables.color)) {
        throw new CadModelError(`Material ${symbol} variables.color must use #RRGGBB format.`)
      }
      normalizedVariables.color = normalizedVariables.color.toLowerCase()
    }
    this.symbol = symbol.trim()
    if (version !== undefined) this.version = version
    this.variables = Object.freeze(normalizedVariables)
  }
}
