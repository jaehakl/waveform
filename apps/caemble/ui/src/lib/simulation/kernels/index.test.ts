import { describe, expect, it } from 'vitest'
import { dcCurrentDensity, dcCurrentDensityKernel, kernelAuthoring, kernelModules } from '.'

describe('production kernel catalog', () => {
  it('contains only the DC current-density kernel', () => {
    expect(kernelModules).toEqual([dcCurrentDensityKernel])
    expect(kernelAuthoring).toEqual({ dcCurrentDensity })
  })
})
