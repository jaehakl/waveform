import { describe, expect, it } from 'vitest'
import { createSampleRecord, createSetupRecord } from './contracts'

describe('Viewer realization persistence contracts', () => {
  it('stores evaluated Sample vars with an intentionally empty material parameter map', () => {
    expect(createSampleRecord(17, { width: 2, origin: [0, 1, 2] })).toEqual({
      structure_id: 17,
      vars: { width: 2, origin: [0, 1, 2] },
      material_parameters: {},
    })
  })

  it('stores evaluated Setup vars against its saved Experiment', () => {
    expect(createSetupRecord(23, { voltage: 5 })).toEqual({
      experiment_id: 23,
      vars: { voltage: 5 },
    })
  })
})
