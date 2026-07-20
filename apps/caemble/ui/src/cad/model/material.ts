import {
  materialModelByKey,
  materialParameterByKey,
  type MaterialModelKey,
  type MaterialPropertyKey,
} from '../../material/data'
import type { MaterialVariables, NormalizedMaterialVariables } from './descriptor'
import { CadModelError } from './errors'
import {
  isPlainObject,
  normalizeMaterialDataValueDescriptor,
  normalizeMaterialSampledRelation,
} from './core'

export class Material {
  readonly symbol: string
  readonly version?: string
  readonly variables: NormalizedMaterialVariables

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
    const normalizedVariables: Record<string, unknown> = {}
    Object.entries(rawVariables).forEach(([key, value]) => {
      if (!key.trim()) throw new CadModelError(`Material ${symbol} variable names must not be empty.`)
      const path = `Material ${symbol} variables.${key}`
      if (key === 'color') {
        normalizedVariables.color = value
      } else if (Object.prototype.hasOwnProperty.call(materialParameterByKey, key)) {
        if (!isPlainObject(value)) throw new CadModelError(`${path} must be a Material property descriptor.`)
        normalizedVariables[key] = normalizeMaterialDataValueDescriptor(
          key as MaterialPropertyKey,
          value,
          path,
        )
      } else if (Object.prototype.hasOwnProperty.call(materialModelByKey, key)) {
        if (!isPlainObject(value)) throw new CadModelError(`${path} must be a sampled relation.`)
        normalizedVariables[key] = normalizeMaterialSampledRelation(key as MaterialModelKey, value, path)
      } else {
        throw new CadModelError(`${path} is not a registered Material catalog key.`)
      }
    })
    if (normalizedVariables.color !== undefined) {
      if (typeof normalizedVariables.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(normalizedVariables.color)) {
        throw new CadModelError(`Material ${symbol} variables.color must use #RRGGBB format.`)
      }
      normalizedVariables.color = normalizedVariables.color.toLowerCase()
    }
    this.symbol = symbol.trim()
    if (version !== undefined) this.version = version
    this.variables = Object.freeze(normalizedVariables) as NormalizedMaterialVariables
  }
}
