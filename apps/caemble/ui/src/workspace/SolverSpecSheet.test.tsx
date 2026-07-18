import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { dcCurrentDensitySpec } from '../solver/modules/dcCurrentDensity'
import SolverSpecSheet from './SolverSpecSheet'

const solver = {
  name: 'dc-current-density',
  version: '2.0.0',
  parameters: {},
}

describe('SolverSpecSheet', () => {
  it('renders the registered solver contract without solver-specific UI code', () => {
    const markup = renderToStaticMarkup(<SolverSpecSheet solver={solver} spec={dcCurrentDensitySpec} />)

    expect(markup).toContain('dc-current-density@2.0.0')
    expect(markup).toContain('relativeTolerance')
    expect(markup).toContain('electricalConductivity')
    expect(markup).toContain('dc.voxel-grid')
    expect(markup).toContain('dc.current-density')
    expect(markup).toContain('ElectricCurrentDensity')
    expect(markup).toContain('applicable units')
    expect(markup).toContain('Undeclared parameter keys are accepted and preserved.')
  })

  it('renders an unavailable state for an unregistered identity', () => {
    const markup = renderToStaticMarkup(<SolverSpecSheet solver={{ ...solver, version: '1.0.0' }} spec={null} />)
    expect(markup).toContain('Solver spec unavailable')
    expect(markup).toContain('dc-current-density@1.0.0')
  })
})
