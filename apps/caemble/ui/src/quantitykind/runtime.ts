import { CadModelError } from '../cad/model/errors'
import { convertUcumValue, normalizeUcumUnit, type UcumUnit } from '../cad/model/units'
import { quantityKindData } from './data'

type QuantityKindData = typeof quantityKindData

export type QuantityKindName = keyof QuantityKindData

export type QuantityMetadata = Readonly<{
  unit: UcumUnit
  quantityKind: QuantityKindName
}>

export type ApplicableUnit<Name extends QuantityKindName> =
  QuantityKindData[Name]['applicableUnits'][number]

export interface QuantityKindDefinition<Name extends QuantityKindName> {
  readonly name: Name
  description(): string | undefined
  applicableUnits(): QuantityKindData[Name]['applicableUnits']
  transform(value: number, fromUnit: ApplicableUnit<Name>, toUnit: ApplicableUnit<Name>): number
}

export function normalizeQuantityMetadata(
  value: Readonly<Record<string, unknown>>,
  path: string,
): QuantityMetadata {
  if (
    !Object.prototype.hasOwnProperty.call(value, 'unit')
    || !Object.prototype.hasOwnProperty.call(value, 'quantityKind')
  ) {
    throw new CadModelError(`${path} must specify both unit and quantityKind.`)
  }

  if (
    typeof value.quantityKind !== 'string'
    || !Object.prototype.hasOwnProperty.call(quantityKindData, value.quantityKind)
  ) {
    throw new CadModelError(`${path}.quantityKind must be a known Quantity Kind name.`)
  }

  const quantityKind = value.quantityKind as QuantityKindName
  const unit = normalizeUcumUnit(value.unit, `${path}.unit`)
  if (!(quantityKindData[quantityKind].applicableUnits as readonly string[]).includes(unit)) {
    throw new CadModelError(
      `${path}.unit ${unit} is not applicable to Quantity Kind ${quantityKind}.`,
    )
  }

  return Object.freeze({ unit, quantityKind })
}

export class QuantityKindEntry<Name extends QuantityKindName>
  implements QuantityKindDefinition<Name>
{
  readonly name: Name

  constructor(name: Name) {
    this.name = name
    Object.freeze(this)
  }

  description(): string | undefined {
    return quantityKindData[this.name].description
  }

  applicableUnits(): QuantityKindData[Name]['applicableUnits'] {
    return quantityKindData[this.name].applicableUnits as QuantityKindData[Name]['applicableUnits']
  }

  transform(
    value: number,
    fromUnit: ApplicableUnit<Name>,
    toUnit: ApplicableUnit<Name>,
  ): number {
    if (!Number.isFinite(value)) {
      throw new CadModelError(`QuantityKind ${this.name} transform value must be finite.`)
    }

    const applicableUnits = this.applicableUnits() as readonly string[]
    if (!applicableUnits.includes(fromUnit)) {
      throw new CadModelError(`QuantityKind ${this.name} does not include source UCUM unit ${fromUnit}.`)
    }
    if (!applicableUnits.includes(toUnit)) {
      throw new CadModelError(`QuantityKind ${this.name} does not include target UCUM unit ${toUnit}.`)
    }

    return convertUcumValue(value, fromUnit, toUnit, `QuantityKind ${this.name} transform`)
  }
}
