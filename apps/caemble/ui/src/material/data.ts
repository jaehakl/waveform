import { acousticMaterialParameters } from './data/acoustic'
import { chemicalMaterialParameters } from './data/chemical'
import { combustionMaterialParameters } from './data/combustion'
import { coupledMaterialParameters } from './data/coupled'
import { electricalMaterialParameters } from './data/electrical'
import { electrochemicalMaterialParameters } from './data/electrochemical'
import { fluidMaterialParameters } from './data/fluid'
import { generalMaterialParameters } from './data/general'
import { interfaceMaterialParameters } from './data/interface'
import { magneticMaterialParameters } from './data/magnetic'
import { mechanicalMaterialParameters } from './data/mechanical'
import { microstructureMaterialParameters } from './data/microstructure'
import { opticalMaterialParameters } from './data/optical'
import { radiationMaterialParameters } from './data/radiation'
import { radiativeMaterialParameters } from './data/radiative'
import { semiconductorMaterialParameters } from './data/semiconductor'
import { thermalMaterialParameters } from './data/thermal'
import { thermodynamicMaterialParameters } from './data/thermodynamic'
import { transportMaterialParameters } from './data/transport'
import {
  materialParameterDomains,
  type MaterialParameterCatalog,
  type MaterialParameterDefinition,
  type MaterialParameterDomain,
} from './types'

export { materialParameterDomains }
export type {
  MaterialParameterCatalog,
  MaterialParameterDefinition,
  MaterialParameterDomain,
}

const materialParametersByDomain = Object.freeze({
  general: generalMaterialParameters,
  mechanical: mechanicalMaterialParameters,
  thermal: thermalMaterialParameters,
  thermodynamic: thermodynamicMaterialParameters,
  fluid: fluidMaterialParameters,
  transport: transportMaterialParameters,
  electrical: electricalMaterialParameters,
  magnetic: magneticMaterialParameters,
  optical: opticalMaterialParameters,
  radiative: radiativeMaterialParameters,
  acoustic: acousticMaterialParameters,
  chemical: chemicalMaterialParameters,
  combustion: combustionMaterialParameters,
  electrochemical: electrochemicalMaterialParameters,
  semiconductor: semiconductorMaterialParameters,
  radiation: radiationMaterialParameters,
  microstructure: microstructureMaterialParameters,
  coupled: coupledMaterialParameters,
  interface: interfaceMaterialParameters,
}) satisfies Readonly<{
  [Domain in MaterialParameterDomain]: readonly MaterialParameterDefinition<Domain>[]
}>

const expectedDomainCounts = Object.freeze({
  general: 14,
  mechanical: 35,
  thermal: 20,
  thermodynamic: 16,
  fluid: 8,
  transport: 19,
  electrical: 15,
  magnetic: 17,
  optical: 13,
  radiative: 2,
  acoustic: 6,
  chemical: 13,
  combustion: 3,
  electrochemical: 14,
  semiconductor: 15,
  radiation: 16,
  microstructure: 11,
  coupled: 8,
  interface: 15,
}) satisfies Readonly<Record<MaterialParameterDomain, number>>

const keys = new Set<string>()
for (const domain of materialParameterDomains) {
  const definitions = materialParametersByDomain[domain]
  const expectedCount = expectedDomainCounts[domain]
  if (definitions.length !== expectedCount) {
    throw new TypeError(
      `Material parameter domain ${domain} has ${definitions.length} definitions; expected ${expectedCount}`,
    )
  }

  for (const definition of definitions) {
    if (keys.has(definition.key)) {
      throw new TypeError(`Duplicate material parameter key ${definition.key}`)
    }
    keys.add(definition.key)

    if (/^(?:mdb|qudt):/.test(definition.quantity_kind)) {
      throw new TypeError(
        `Material parameter ${definition.key} uses a source-prefixed QuantityKind`,
      )
    }
  }
}

export const materialParameterData = Object.freeze([
  ...generalMaterialParameters,
  ...mechanicalMaterialParameters,
  ...thermalMaterialParameters,
  ...thermodynamicMaterialParameters,
  ...fluidMaterialParameters,
  ...transportMaterialParameters,
  ...electricalMaterialParameters,
  ...magneticMaterialParameters,
  ...opticalMaterialParameters,
  ...radiativeMaterialParameters,
  ...acousticMaterialParameters,
  ...chemicalMaterialParameters,
  ...combustionMaterialParameters,
  ...electrochemicalMaterialParameters,
  ...semiconductorMaterialParameters,
  ...radiationMaterialParameters,
  ...microstructureMaterialParameters,
  ...coupledMaterialParameters,
  ...interfaceMaterialParameters,
] as const)

if (materialParameterData.length !== 260 || keys.size !== 260) {
  throw new TypeError(
    `Material parameter catalog has ${materialParameterData.length} definitions and ${keys.size} unique keys; expected 260`,
  )
}

const designRules = Object.freeze({
  canonical_key: 'domain.property; do not encode direction, component, temperature, pressure, frequency, wavelength, species, phase, or model branch in the key',
  value_representation: 'A property may be scalar, vector, tensor, complex, curve, table, or function.',
  model_parameters: 'Constitutive-model coefficients belong under model.<model>.<parameter>, not in this flat physical-property catalog.',
  interface_properties: 'interface.* records belong to a material/phase pair, not to one bulk material.',
  quantity_kind: "reference the single canonical QuantityKind name; domain prefixes identify physical meaning, not the catalog property's usage domain.",
})

const globalQualifiers = Object.freeze([
  'temperature',
  'pressure',
  'frequency',
  'wavelength',
  'phase',
  'composition',
  'material_state',
  'source',
  'measurement_or_derivation_method',
] as const)

const modelNamespaceExamples = Object.freeze([
  'model.johnson_cook.initial_yield_stress',
  'model.johnson_cook.hardening_coefficient',
  'model.johnson_cook.hardening_exponent',
  'model.johnson_cook.strain_rate_coefficient',
  'model.johnson_cook.thermal_softening_exponent',
  'model.mooney_rivlin.c10',
  'model.mooney_rivlin.c01',
  'model.ogden.mu',
  'model.ogden.alpha',
  'model.prony.shear_fraction',
  'model.prony.bulk_fraction',
  'model.prony.relaxation_time',
  'model.norton.creep_coefficient',
  'model.norton.stress_exponent',
  'model.power_law.consistency_index',
  'model.power_law.flow_behavior_index',
  'model.bingham.yield_stress',
  'model.bingham.plastic_viscosity',
  'model.herschel_bulkley.yield_stress',
  'model.herschel_bulkley.consistency_index',
  'model.herschel_bulkley.flow_behavior_index',
  'model.mohr_coulomb.cohesion',
  'model.mohr_coulomb.friction_angle',
  'model.mohr_coulomb.dilation_angle',
  'model.modified_cam_clay.preconsolidation_pressure',
  'model.modified_cam_clay.compression_index',
  'model.modified_cam_clay.swelling_index',
  'model.van_genuchten.alpha',
  'model.van_genuchten.n',
  'model.butler_volmer.exchange_current_density',
  'model.jiles_atherton.a',
  'model.sellmeier.b',
  'model.sellmeier.c',
] as const)

export const materialParameterCatalog = Object.freeze({
  catalog_id: 'material-parameter-catalog',
  catalog_version: '0.1-draft',
  quantity_kind_data_version: '1.0.0',
  design_rules: designRules,
  global_qualifiers: globalQualifiers,
  properties: materialParameterData,
  model_namespace_examples: modelNamespaceExamples,
}) satisfies MaterialParameterCatalog
