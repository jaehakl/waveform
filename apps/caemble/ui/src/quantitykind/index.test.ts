import { createUcumService } from '@fhir-toolkit/ucum'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { CadModelError } from '../cad/model/errors'
import {
  QuantityKind,
  type ApplicableUnit,
  type QuantityKindDefinition,
} from './index'

function assertCompileTimeUnitTypes() {
  // @ts-expect-error seconds are not an applicable Length unit
  QuantityKind.Length.transform(1, 's', 'm')
}
void assertCompileTimeUnitTypes

describe('QuantityKind', () => {
  it('exposes every source name, including deprecated and non-identifier names', () => {
    const entries = Object.values(QuantityKind)

    expect(entries).toHaveLength(1_219)
    expect(new Set(entries.map(({ name }) => name))).toHaveLength(1_219)
    for (const [name, entry] of Object.entries(QuantityKind)) expect(entry.name).toBe(name)
    expect(QuantityKind['CENTER-OF-MASS'].name).toBe('CENTER-OF-MASS')
    expect(entries.filter(({ name }) => !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name))).toHaveLength(39)
    expect(Object.isFrozen(QuantityKind)).toBe(true)
    expect(Object.isFrozen(QuantityKind.Length)).toBe(true)

    expectTypeOf(QuantityKind.Length).toMatchTypeOf<QuantityKindDefinition<'Length'>>()
    expectTypeOf<ApplicableUnit<'APIGravity'>>().toEqualTypeOf<never>()
  })

  it('returns canonical descriptions with normalized whitespace and preserves missing values', () => {
    const entries = Object.values(QuantityKind)
    const descriptions = entries.map((entry) => entry.description())

    expect(descriptions.filter((description) => description !== undefined)).toHaveLength(1_007)
    expect(descriptions.filter((description) => description === undefined)).toHaveLength(212)
    expect(QuantityKind.AbsoluteTypographicMeasurement.description()).toBeUndefined()
    expect(QuantityKind.AcousticImpedance.description()).toContain('$\\textit{Acoustic Impedance}$')
    for (const description of descriptions) {
      if (description !== undefined) {
        expect(description).toBe(description.trim())
        expect(description).not.toMatch(/\s{2,}/)
      }
    }
  })

  it('returns frozen, unique, validator-supported UCUM lists', () => {
    const ucum = createUcumService()
    const entries = Object.values(QuantityKind)
    const withUnits = entries.filter((entry) => entry.applicableUnits().length > 0)
    const unitEntryCount = entries.reduce((sum, entry) => sum + entry.applicableUnits().length, 0)

    expect(withUnits).toHaveLength(820)
    expect(entries.length - withUnits.length).toBe(399)
    expect(unitEntryCount).toBe(10_405)
    expect(QuantityKind.APIGravity.applicableUnits()).toEqual([])

    for (const entry of entries) {
      const units = entry.applicableUnits()
      expect(Object.isFrozen(units)).toBe(true)
      expect(new Set(units).size).toBe(units.length)
      for (const unit of units) {
        expect(() => ucum.validate(unit)).not.toThrow()
        expect(() => ucum.canonical(1, unit)).not.toThrow()
      }
    }
  })

  it('transforms linear and affine applicable units', () => {
    expect(QuantityKind.Length.transform(1_000, 'mm', 'm')).toBeCloseTo(1)
    expect(QuantityKind.Temperature.transform(0, 'Cel', 'K')).toBeCloseTo(273.15)
  })

  it('rejects non-finite values, foreign units, and incompatible applicable units', () => {
    expect(() => QuantityKind.Length.transform(Number.NaN, 'mm', 'm')).toThrow(CadModelError)
    expect(() => QuantityKind.Length.transform(
      1,
      's' as unknown as ApplicableUnit<'Length'>,
      'm',
    )).toThrow('does not include source UCUM unit s')
    expect(() => QuantityKind.Length.transform(
      1,
      'm',
      's' as unknown as ApplicableUnit<'Length'>,
    )).toThrow('does not include target UCUM unit s')
    expect(() => QuantityKind.AngularAcceleration.transform(
      1,
      '{#}.s-2',
      'rad.s-2',
    )).toThrow(CadModelError)
  })
})
