import type { Rotation, Tensor, Vars, Vec3 } from './types'

export type { Rotation, Tensor, Vars, Vec3 } from './types'
export type GeometryAttributes<P extends object = object> = Readonly<
  P & {
    id: string
    materials?: readonly Material[]
    pos?: Vec3
    rotate?: Rotation
    scale?: Vec3
    children?: unknown
  }
>
export type Geometry<P extends object = object> = (props: GeometryAttributes<P>) => unknown

type VarsSchemaEntry = {
  shape: readonly number[]
  default: Tensor
  min?: Tensor
  max?: Tensor
}

export type StructureGroupMap = Readonly<Record<string, readonly string[]>>

type StructureOptions = {
  geometry: () => unknown
  varsSchema: Record<string, VarsSchemaEntry>
  geometryGroup?: StructureGroupMap
  surfaceGroup?: StructureGroupMap
}

const defaultMaterialColor = '#3b82f6'

export class CadModelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CadModelError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneTensor(value: Tensor): Tensor {
  return Array.isArray(value) ? value.map(cloneTensor) : value
}

function freezeTensor(value: Tensor): Tensor {
  if (!Array.isArray(value)) return value

  value.forEach(freezeTensor)
  return Object.freeze(value)
}

function validateShape(shape: unknown, key: string): readonly number[] {
  if (!Array.isArray(shape)) {
    throw new CadModelError(`varsSchema.${key}.shape must be an array of positive integers.`)
  }

  const normalized = shape.map((size) => {
    if (!Number.isInteger(size) || size <= 0) {
      throw new CadModelError(`varsSchema.${key}.shape must contain only positive integers.`)
    }

    return size
  })

  return Object.freeze(normalized)
}

function validateTensor(value: unknown, shape: readonly number[], path: string): asserts value is Tensor {
  if (shape.length === 0) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new CadModelError(`${path} must be a finite number.`)
    }

    return
  }

  if (!Array.isArray(value) || value.length !== shape[0]) {
    throw new CadModelError(`${path} must have shape [${shape.join(', ')}].`)
  }

  value.forEach((item, index) => {
    validateTensor(item, shape.slice(1), `${path}[${index}]`)
  })
}

function validateBound(value: unknown, shape: readonly number[], path: string): asserts value is Tensor {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new CadModelError(`${path} must be a finite number.`)
    }

    return
  }

  validateTensor(value, shape, path)
}

function boundAt(bound: Tensor, index: number): Tensor {
  return Array.isArray(bound) ? bound[index] : bound
}

function validateRange(
  value: Tensor,
  min: Tensor | undefined,
  max: Tensor | undefined,
  shape: readonly number[],
  path: string,
) {
  if (shape.length === 0) {
    const scalar = value as number
    const minimum = min as number | undefined
    const maximum = max as number | undefined

    if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
      throw new CadModelError(`${path} has min greater than max.`)
    }

    if (minimum !== undefined && scalar < minimum) {
      throw new CadModelError(`${path} must be greater than or equal to ${minimum}.`)
    }

    if (maximum !== undefined && scalar > maximum) {
      throw new CadModelError(`${path} must be less than or equal to ${maximum}.`)
    }

    return
  }

  ;(value as readonly Tensor[]).forEach((item, index) => {
    validateRange(
      item,
      min === undefined ? undefined : boundAt(min, index),
      max === undefined ? undefined : boundAt(max, index),
      shape.slice(1),
      `${path}[${index}]`,
    )
  })
}

function normalizeVarsSchema(rawSchema: unknown) {
  if (!isRecord(rawSchema)) {
    throw new CadModelError('Structure varsSchema must be an object.')
  }

  const normalized: Record<string, VarsSchemaEntry> = {}

  Object.entries(rawSchema).forEach(([key, rawEntry]) => {
    if (!key.trim()) {
      throw new CadModelError('varsSchema keys must not be empty.')
    }

    if (!isRecord(rawEntry)) {
      throw new CadModelError(`varsSchema.${key} must be an object.`)
    }

    const shape = validateShape(rawEntry.shape, key)
    validateTensor(rawEntry.default, shape, `varsSchema.${key}.default`)

    const hasMin = rawEntry.min !== undefined
    const hasMax = rawEntry.max !== undefined

    if (hasMin !== hasMax) {
      throw new CadModelError(`varsSchema.${key} must define both min and max or neither.`)
    }

    if (hasMin) {
      validateBound(rawEntry.min, shape, `varsSchema.${key}.min`)
      validateBound(rawEntry.max, shape, `varsSchema.${key}.max`)
    }

    const defaultValue = freezeTensor(cloneTensor(rawEntry.default))
    const min = hasMin ? freezeTensor(cloneTensor(rawEntry.min as Tensor)) : undefined
    const max = hasMax ? freezeTensor(cloneTensor(rawEntry.max as Tensor)) : undefined

    validateRange(defaultValue, min, max, shape, `varsSchema.${key}.default`)

    normalized[key] = Object.freeze({
      shape,
      default: defaultValue,
      ...(min === undefined ? {} : { min }),
      ...(max === undefined ? {} : { max }),
    })
  })

  return Object.freeze(normalized)
}

function normalizeStructureGroup(rawGroup: unknown, propertyName: 'geometryGroup' | 'surfaceGroup') {
  if (rawGroup === undefined) return Object.freeze({}) as StructureGroupMap
  if (!isRecord(rawGroup)) {
    throw new CadModelError(`Structure ${propertyName} must be an object.`)
  }

  const names = new Set<string>()
  const entries = Object.entries(rawGroup).map(([rawName, rawMembers]) => {
    const name = rawName.trim()
    if (!name) {
      throw new CadModelError(`Structure ${propertyName} group names must not be empty.`)
    }
    if (names.has(name)) {
      throw new CadModelError(`Structure ${propertyName} group name "${name}" is duplicated after trimming.`)
    }
    names.add(name)

    if (!Array.isArray(rawMembers)) {
      throw new CadModelError(`Structure ${propertyName}.${name} must be an array of global IDs.`)
    }

    const memberIds: string[] = []
    const seenMemberIds = new Set<string>()
    rawMembers.forEach((rawMember, index) => {
      if (typeof rawMember !== 'string' || !rawMember.trim()) {
        throw new CadModelError(
          `Structure ${propertyName}.${name}[${index}] must be a non-empty string global ID.`,
        )
      }
      const memberId = rawMember.trim()
      if (seenMemberIds.has(memberId)) return
      seenMemberIds.add(memberId)
      memberIds.push(memberId)
    })

    return [name, Object.freeze(memberIds)] as const
  })

  return Object.freeze(Object.fromEntries(entries)) as StructureGroupMap
}

function normalizeVars(schema: Readonly<Record<string, VarsSchemaEntry>>, rawVars: unknown) {
  if (!isRecord(rawVars)) {
    throw new CadModelError('Sample vars must be an object.')
  }

  const schemaKeys = Object.keys(schema)
  const extraKey = Object.keys(rawVars).find((key) => !(key in schema))

  if (extraKey) {
    throw new CadModelError(`Unknown Sample var: ${extraKey}.`)
  }

  const normalized: Vars = {}

  schemaKeys.forEach((key) => {
    const entry = schema[key]
    const rawValue = rawVars[key] === undefined ? entry.default : rawVars[key]

    validateTensor(rawValue, entry.shape, `vars.${key}`)

    const value = freezeTensor(cloneTensor(rawValue))
    validateRange(value, entry.min, entry.max, entry.shape, `vars.${key}`)
    normalized[key] = value
  })

  return Object.freeze(normalized)
}

function createRandom(seed?: number) {
  if (seed === undefined) return Math.random

  if (!Number.isInteger(seed) || !Number.isSafeInteger(seed)) {
    throw new CadModelError('randomVars seed must be a safe integer.')
  }

  let state = seed >>> 0

  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function randomTensor(
  shape: readonly number[],
  min: Tensor,
  max: Tensor,
  random: () => number,
): Tensor {
  if (shape.length === 0) {
    const minimum = min as number
    const maximum = max as number
    return minimum + random() * (maximum - minimum)
  }

  return Array.from({ length: shape[0] }, (_, index) =>
    randomTensor(shape.slice(1), boundAt(min, index), boundAt(max, index), random),
  )
}

export class Material {
  readonly name: string
  readonly vars: Readonly<Vars>
  readonly displayColor: string

  constructor(name: string, vars: Vars, displayColor = defaultMaterialColor) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new CadModelError('Material name must be a non-empty string.')
    }

    if (!isRecord(vars)) {
      throw new CadModelError(`Material ${name} vars must be an object.`)
    }

    if (!/^#[0-9a-f]{6}$/i.test(displayColor)) {
      throw new CadModelError(`Material ${name} displayColor must use #RRGGBB format.`)
    }

    const normalizedVars: Vars = {}

    Object.entries(vars).forEach(([key, value]) => {
      if (!key.trim()) {
        throw new CadModelError(`Material ${name} var names must not be empty.`)
      }

      const shape: number[] = []
      let cursor: unknown = value

      while (Array.isArray(cursor)) {
        if (cursor.length === 0) {
          throw new CadModelError(`Material ${name} var ${key} must not contain empty arrays.`)
        }

        shape.push(cursor.length)
        cursor = cursor[0]
      }

      validateTensor(value, shape, `Material ${name} vars.${key}`)
      normalizedVars[key] = freezeTensor(cloneTensor(value))
    })

    this.name = name.trim()
    this.vars = Object.freeze(normalizedVars)
    this.displayColor = displayColor.toLowerCase()
  }
}

export class Structure {
  readonly geometry: () => unknown
  readonly varsSchema: Readonly<Record<string, VarsSchemaEntry>>
  readonly geometryGroup: StructureGroupMap
  readonly surfaceGroup: StructureGroupMap

  constructor(options: StructureOptions) {
    if (!isRecord(options) || typeof options.geometry !== 'function') {
      throw new CadModelError('Structure geometry must be a function.')
    }

    this.geometry = options.geometry
    this.varsSchema = normalizeVarsSchema(options.varsSchema)
    this.geometryGroup = normalizeStructureGroup(options.geometryGroup, 'geometryGroup')
    this.surfaceGroup = normalizeStructureGroup(options.surfaceGroup, 'surfaceGroup')
    Object.freeze(this)
  }

  randomVars(seed?: number) {
    const random = createRandom(seed)
    const generated: Vars = {}

    Object.entries(this.varsSchema).forEach(([key, entry]) => {
      generated[key] =
        entry.min === undefined || entry.max === undefined
          ? cloneTensor(entry.default)
          : randomTensor(entry.shape, entry.min, entry.max, random)
    })

    return normalizeVars(this.varsSchema, generated)
  }
}

export class Sample {
  readonly structure: Structure
  readonly vars: Readonly<Vars>

  constructor(structure: Structure, partialVars: Partial<Vars> = {}) {
    if (!(structure instanceof Structure)) {
      throw new CadModelError('Sample requires a Structure instance.')
    }

    this.structure = structure
    this.vars = normalizeVars(structure.varsSchema, partialVars)
    Object.freeze(this)
  }
}

let activeVars: Readonly<Vars> | null = null

export const vars = new Proxy<Record<string, Tensor>>(
  {},
  {
    deleteProperty() {
      throw new CadModelError('Global vars is read-only.')
    },
    get(_target, key) {
      if (activeVars === null) {
        throw new CadModelError('Global vars is only available while a Sample is being evaluated.')
      }

      if (typeof key === 'symbol') return undefined
      return activeVars[key]
    },
    getOwnPropertyDescriptor(_target, key) {
      if (activeVars === null || typeof key === 'symbol' || !(key in activeVars)) return undefined

      return {
        configurable: true,
        enumerable: true,
        value: activeVars[key],
        writable: false,
      }
    },
    has(_target, key) {
      return activeVars !== null && typeof key === 'string' && key in activeVars
    },
    ownKeys() {
      return activeVars === null ? [] : Reflect.ownKeys(activeVars)
    },
    set() {
      throw new CadModelError('Global vars is read-only.')
    },
  },
)

export function evaluateWithVars<T>(sampleVars: Readonly<Vars>, evaluate: () => T) {
  const previousVars = activeVars
  activeVars = sampleVars

  try {
    return evaluate()
  } finally {
    activeVars = previousVars
  }
}


