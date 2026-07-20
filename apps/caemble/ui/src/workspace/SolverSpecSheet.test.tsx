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
    const markup = renderToStaticMarkup(
      <SolverSpecSheet
        compatibility={{ status: 'compatible', issues: [] }}
        solver={solver}
        spec={dcCurrentDensitySpec}
      />,
    )

    expect(markup).toContain('Simulation compatible')
    expect(markup).toContain('dc-current-density@2.0.0')
    expect(markup).toContain('relativeTolerance')
    expect(markup).toContain('electricalConductivity')
    expect(markup).toContain('dc.voxel-grid')
    expect(markup).toContain('dc.current-density')
    expect(markup).toContain('electromagnetism.ElectricCurrentDensity')
    expect(markup).toContain('applicable units')
    expect(markup).toContain('Undeclared parameter keys are accepted and preserved.')
  })

  it('renders an unavailable state for an unregistered identity', () => {
    const markup = renderToStaticMarkup(
      <SolverSpecSheet
        compatibility={{
          status: 'incompatible',
          issues: [{
            documentType: 'experiment',
            path: 'solver',
            message: 'No solver module is registered for dc-current-density@1.0.0.',
          }],
        }}
        solver={{ ...solver, version: '1.0.0' }}
        spec={null}
      />,
    )
    expect(markup).toContain('Solver specification unavailable')
    expect(markup).toContain('dc-current-density@1.0.0')
  })

  it('groups every compatibility issue by document without presenting warnings as alerts', () => {
    const markup = renderToStaticMarkup(
      <SolverSpecSheet
        compatibility={{
          status: 'incompatible',
          issues: [
            {
              documentType: 'structure',
              path: 'rules.initializations[0].target[0]',
              message: 'references missing structure.geometry.conductor.',
            },
            {
              documentType: 'experiment',
              path: 'rules.recordedData[0].methodId',
              message: 'is not registered for this Solver.',
            },
          ],
        }}
        solver={solver}
        spec={dcCurrentDensitySpec}
      />,
    )

    expect(markup).toContain('Simulation incompatible · 2 issues')
    expect(markup).toContain('>Structure</h4>')
    expect(markup).toContain('>Experiment</h4>')
    expect(markup).toContain('rules.initializations[0].target[0]')
    expect(markup).toContain('rules.recordedData[0].methodId')
    expect(markup).not.toContain('role="alert"')
  })
})
