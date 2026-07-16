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
    expect(markup).toContain('aria-label="Structure and Experiment panels"')
    expect(markup).toContain('>Structure Source</button>')
    expect(markup).toContain('>Structure Tree</button>')
    expect(markup).toContain('>Experiment Source</button>')
    expect(markup).toContain('>Experiment Tree</button>')
    expect(markup).toContain('>Experimental Parameters</button>')
    expect(markup).not.toContain('>Result</button>')
    expect(markup).toMatch(/<button[^>]*aria-selected="true"[^>]*id="structure-source-tab"/)
    expect(markup).toMatch(/aria-label="Resize modeling panels and Viewer"[^>]*aria-orientation="vertical"/)
    expect(markup).toContain('aria-valuenow="44"')
    expect(markup).toContain('Waiting for model...')
  })

  it('normalizes old and unknown hashes to Viewer and keeps the independent Experiment example', () => {
    expect(appViewFromHash('#viewer')).toBe('viewer')
    expect(appViewFromHash('#structure')).toBe('viewer')
    expect(appViewFromHash('#experiment')).toBe('viewer')
    expect(appViewFromHash('#help')).toBe('help')
    expect(appViewFromHash('#unknown')).toBe('viewer')
    expect(defaultExperimentCode).toContain("name: 'generic-field-solver'")
    expect(defaultExperimentCode).toContain('parameters: () => ({')
    expect(defaultExperimentCode).toContain('initialConditions: () => [')
    expect(defaultExperimentCode).toContain('recordedData: () => [')
    expect(defaultExperimentCode).toContain("result: { type: 'tensor', dimension: 0")
    expect(defaultExperimentCode).toContain("'experiment.geometry.domain'")
    expect(defaultExperimentCode).toContain("'structure.geometry.sample'")
    expect(defaultExperimentCode).toContain('new Setup(experiment, experiment.randomVars())')
  })

  it('shows the available Structure examples', () => {
    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('aria-label="Select structure example"')
    expect(markup).toContain('>Fiber Bundle</option>')
    expect(markup).toContain('>Shell Cutaways</option>')
    expect(markup).toContain('>Random Curved Cylinder Array</option>')
    expect(markup).toContain('>Random Curved Sphere HCP Array</option>')
  })
})
