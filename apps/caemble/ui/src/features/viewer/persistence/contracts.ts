import type { SampleRecord, SetupRecord } from '@/api'

export function createSampleRecord(structureId: number, variables: Readonly<Record<string, unknown>>): SampleRecord {
  return { structure_id: structureId, vars: { ...variables }, material_parameters: {} }
}

export function createSetupRecord(experimentId: number, variables: Readonly<Record<string, unknown>>): SetupRecord {
  return { experiment_id: experimentId, vars: { ...variables } }
}
