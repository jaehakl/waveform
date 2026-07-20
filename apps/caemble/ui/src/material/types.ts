export const materialParameterDomains = Object.freeze([
  'general',
  'mechanical',
  'thermal',
  'thermodynamic',
  'fluid',
  'transport',
  'electrical',
  'magnetic',
  'optical',
  'radiative',
  'acoustic',
  'chemical',
  'combustion',
  'electrochemical',
  'semiconductor',
  'radiation',
  'microstructure',
  'coupled',
  'interface',
] as const)

export type MaterialParameterDomain = (typeof materialParameterDomains)[number]

export interface MaterialParameterDefinition<
  Domain extends MaterialParameterDomain = MaterialParameterDomain,
> {
  readonly key: `${Domain}.${string}`
  readonly label_ko: string
  readonly quantity_kind: string
  readonly special_qualifiers?: readonly string[]
}

export interface MaterialParameterCatalog {
  readonly catalog_id: 'material-parameter-catalog'
  readonly catalog_version: '0.1-draft'
  readonly quantity_kind_data_version: '1.0.0'
  readonly design_rules: Readonly<{
    canonical_key: string
    value_representation: string
    model_parameters: string
    interface_properties: string
    quantity_kind: string
  }>
  readonly global_qualifiers: readonly string[]
  readonly properties: readonly MaterialParameterDefinition[]
  readonly model_namespace_examples: readonly string[]
}

const definitionFields = new Set([
  'key',
  'label_ko',
  'quantity_kind',
  'special_qualifiers',
])

export function defineMaterialParameterDomain<
  const Domain extends MaterialParameterDomain,
  const Definitions extends readonly MaterialParameterDefinition<Domain>[],
>(domain: Domain, definitions: Definitions): Definitions {
  const keyPattern = new RegExp(`^${domain}\\.[^.]+$`)

  for (const definition of definitions) {
    if (!keyPattern.test(definition.key)) {
      throw new TypeError(
        `Material parameter key ${JSON.stringify(definition.key)} must match ${domain}.<property>`,
      )
    }

    for (const field of Object.keys(definition)) {
      if (!definitionFields.has(field)) {
        throw new TypeError(
          `Material parameter ${definition.key} has unsupported field ${JSON.stringify(field)}`,
        )
      }
    }

    if (definition.special_qualifiers !== undefined) {
      Object.freeze(definition.special_qualifiers)
    }
    Object.freeze(definition)
  }

  return Object.freeze(definitions) as Definitions
}
