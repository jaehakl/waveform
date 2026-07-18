import { createUcumService } from '@fhir-toolkit/ucum'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { CadModelError } from '../cad/model/errors'
import { quantityKindData } from './data'
import {
  QuantityKind,
  type ApplicableUnit,
  type QuantityKindDefinition,
} from './index'
import {
  componentShapeForTensorOrder,
  transformQuantityComponents,
} from './runtime'

function assertCompileTimeUnitTypes() {
  // @ts-expect-error seconds are not an applicable Length unit
  QuantityKind.Length.transform(1, 's', 'm')
}
void assertCompileTimeUnitTypes

describe('QuantityKind', () => {
  it('has one explicit, frozen tensor order for every QUDT 3.4 name', () => {
    const entries = Object.values(quantityKindData)

    expect(entries).toHaveLength(1_219)
    expect(Object.isFrozen(quantityKindData)).toBe(true)
    for (const entry of entries) {
      expect(Object.isFrozen(entry)).toBe(true)
      expect(Object.prototype.hasOwnProperty.call(entry, 'tensorOrder')).toBe(true)
      expect(Number.isSafeInteger(entry.tensorOrder)).toBe(true)
      expect(entry.tensorOrder).toBeGreaterThanOrEqual(0)
      expect(entry.tensorOrder).toBeLessThanOrEqual(2)
    }
  })

  it('fixes representative and text-ambiguous scalar, vector, and matrix orders', () => {
    expect(QuantityKind.Length.tensorOrder()).toBe(0)
    expect(QuantityKind.Length.componentShape()).toEqual([])
    expect(QuantityKind.Force.tensorOrder()).toBe(1)
    expect(QuantityKind.Force.componentShape()).toEqual([3])
    expect(QuantityKind.ElectricConductivity.tensorOrder()).toBe(2)
    expect(QuantityKind.ElectricConductivity.componentShape()).toEqual([3, 3])
    expect(QuantityKind.Stress.tensorOrder()).toBe(2)
    expect(QuantityKind.Strain.tensorOrder()).toBe(2)
    expect(QuantityKind.ElectricQuadrupoleMoment.tensorOrder()).toBe(2)

    expect(QuantityKind.AngularFrequency.tensorOrder()).toBe(0)
    expect(QuantityKind.BendingMomentOfForce.tensorOrder()).toBe(0)
    expect(QuantityKind.HorizontalVelocity.tensorOrder()).toBe(0)
    expect(QuantityKind.MaxOperatingThrust.tensorOrder()).toBe(0)
    expect(QuantityKind.ParticleCurrent.tensorOrder()).toBe(0)
    expect(QuantityKind.Pressure.tensorOrder()).toBe(0)
    expect(QuantityKind.RotationalVelocity.tensorOrder()).toBe(0)
    expect(QuantityKind.Tilt.tensorOrder()).toBe(0)
    expect(QuantityKind.VolumeStrain.tensorOrder()).toBe(0)

    expectTypeOf(QuantityKind.Length.tensorOrder()).toEqualTypeOf<0>()
    expectTypeOf(QuantityKind.Force.tensorOrder()).toEqualTypeOf<1>()
    expectTypeOf(QuantityKind.ElectricConductivity.tensorOrder()).toEqualTypeOf<2>()
    expectTypeOf(QuantityKind.Force.componentShape()).toEqualTypeOf<readonly [3]>()
    expectTypeOf(QuantityKind.ElectricConductivity.componentShape())
      .toEqualTypeOf<readonly [3, 3]>()
    expect(Object.isFrozen(QuantityKind.Force.componentShape())).toBe(true)
  })

  it('builds arbitrary non-negative component orders without a scalar fallback', () => {
    expect(componentShapeForTensorOrder(3)).toEqual([3, 3, 3])
    expect(componentShapeForTensorOrder(4)).toEqual([3, 3, 3, 3])
    expect(Object.isFrozen(componentShapeForTensorOrder(4))).toBe(true)
    expect(() => componentShapeForTensorOrder(-1)).toThrow('non-negative safe integer')
    expect(() => componentShapeForTensorOrder(1.5)).toThrow('non-negative safe integer')
  })

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

  it('recursively converts every vector and matrix component and rejects affine tensor conversions', () => {
    const vector = QuantityKind.ElectricCurrentDensity.transform(
      [1, 2, 3],
      'A.cm-2',
      'A.m-2',
    )
    const matrix = QuantityKind.ElectricConductivity.transform(
      [[1, 0, 0], [0, 2, 0], [0, 0, 3]],
      'S.cm-1',
      'S.m-1',
    )

    expect(vector).toEqual([10_000, 20_000, 30_000])
    matrix.flat().forEach((component, index) => {
      expect(component).toBeCloseTo([100, 0, 0, 0, 200, 0, 0, 0, 300][index], 12)
    })
    expect(Object.isFrozen(vector)).toBe(true)
    expect(Object.isFrozen(matrix[0])).toBe(true)
    expect(() => transformQuantityComponents(
      [0, 0, 0],
      [3],
      'Cel',
      'K',
      'Synthetic vector conversion',
    )).toThrow('zero-preserving unit transform')
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
      [1, 1, 1],
      '{#}.s-2',
      'rad.s-2',
    )).toThrow(CadModelError)
  })
})
