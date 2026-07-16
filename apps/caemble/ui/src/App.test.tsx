import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'
import { defaultExperimentCode } from './defaultExperimentCode'
import { appViewFromHash } from './navigation'

describe('App workspace', () => {
  it('builds the example page around the integrated Viewer', () => {
    const markup = renderToStaticMarkup(<App />)
    const button = markup.match(/<button[^>]*aria-label="Reroll structure"[^>]*>/)?.[0]

    expect(button).toBeDefined()
    expect(button).toContain('title="Re-run the current structure code"')
    expect(button).not.toMatch(/\sdisabled(?:=|\s|>)/)
    expect(markup).toContain('aria-label="Main navigation"')
    expect(markup).toMatch(/<a[^>]*aria-current="page"[^>]*href="#viewer"[^>]*>Viewer<\/a>/)
    expect(markup).toMatch(/<a[^>]*href="#help"[^>]*>Help<\/a>/)
    expect(markup).toContain('aria-label="Structure and Experiment viewer"')
    expect(markup).toContain('aria-label="Structure and Experiment workspace"')
    expect(markup).toContain('aria-label="3D CAD Viewer"')
    expect(markup).toContain('aria-label="Structure and Experiment panels"')
    expect(markup).toContain('>Structure Source</button>')
    expect(markup).toContain('>Structure Tree</button>')
    expect(markup).toContain('>Experiment Source</button>')
    expect(markup).toContain('>Experiment Tree</button>')
    expect(markup).toContain('>Experimental Parameters</button>')
    expect(markup).not.toContain('>Results</button>')
    expect(markup).toMatch(/<button[^>]*aria-selected="true"[^>]*id="structure-source-tab"/)
    expect(markup).toMatch(/aria-label="Resize modeling panels and Viewer"[^>]*aria-orientation="vertical"/)
    expect(markup).toContain('aria-valuenow="44"')
    expect(markup).toMatch(/<button[^>]*aria-label="Toggle structure"[^>]*aria-pressed="true"/)
    expect(markup).toMatch(/<button[^>]*aria-label="Toggle experiment"[^>]*aria-pressed="true"/)
    expect(markup).toContain('data-viewer-canvas="true"')
    expect(markup).toContain('Waiting for model...')
    expect(markup).toContain('aria-label="Simulation controls"')
    expect(markup).toContain('Solver unavailable')
    expect(markup).toMatch(/<button[^>]*aria-label="Run simulation"[^>]*disabled/)
  })

  it('normalizes old and unknown hashes to Viewer and keeps the independent Experiment example', () => {
    expect(appViewFromHash('#viewer')).toBe('viewer')
    expect(appViewFromHash('#structure')).toBe('viewer')
    expect(appViewFromHash('#experiment')).toBe('viewer')
    expect(appViewFromHash('#help')).toBe('help')
    expect(appViewFromHash('#unknown')).toBe('viewer')
    expect(defaultExperimentCode).toContain("name: 'dc-current-density'")
    expect(defaultExperimentCode).toContain('parameters: () => ({')
    expect(defaultExperimentCode).toContain('lengthScaleToMeters: 0.001')
    expect(defaultExperimentCode).toContain("methodId: 'dc.source-potential'")
    expect(defaultExperimentCode).toContain("methodId: 'dc.reference-potential'")
    expect(defaultExperimentCode).toContain('recordedData: () => [')
    expect(defaultExperimentCode).toContain("label: 'Current density'")
    expect(defaultExperimentCode).toContain('shape: [3]')
    expect(defaultExperimentCode).toContain("label: 'Total current'")
    expect(defaultExperimentCode).toContain("'structure.geometry.conductor'")
    expect(defaultExperimentCode).toContain('new Setup(experiment)')
  })

  it('shows the available Structure examples', () => {
    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('aria-label="Select structure example"')
    expect(markup).toContain('>DC Conductor</option>')
    expect(markup).toContain('>Fiber Bundle</option>')
    expect(markup).toContain('>Shell Cutaways</option>')
    expect(markup).toContain('>Random Curved Cylinder Array</option>')
    expect(markup).toContain('>Random Curved Sphere HCP Array</option>')
  })
})
