import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App, { WorkspaceTabBar } from './App'
import { defaultExperimentCode } from './defaultExperimentCode'
import { appViewFromHash } from './navigation'

describe('App workspace', () => {
  it('shows hash navigation, an enabled Structure Reroll, and the Code Space tab', () => {
    const markup = renderToStaticMarkup(<App />)
    const button = markup.match(/<button[^>]*aria-label="Reroll structure"[^>]*>/)?.[0]

    expect(button).toBeDefined()
    expect(button).toContain('title="Re-run the current structure code"')
    expect(button).not.toMatch(/\sdisabled(?:=|\s|>)/)
    expect(markup).toContain('>Reroll</button>')
    expect(markup).toContain('aria-label="Main navigation"')
    expect(markup).toMatch(/<a[^>]*aria-current="page"[^>]*href="#structure"[^>]*>Structure<\/a>/)
    expect(markup).toMatch(/<a[^>]*href="#experiment"[^>]*>Experiment<\/a>/)
    expect(markup).toMatch(/<a[^>]*href="#help"[^>]*>Help<\/a>/)
    expect(markup).toContain('aria-label="Structure editor"')
    expect(markup).toContain('role="tablist"')
    expect(markup).toMatch(/<button[^>]*aria-selected="true"[^>]*id="workspace-code-tab"[^>]*role="tab"[^>]*tabindex="0"/)
    expect(markup).toMatch(/<button[^>]*aria-selected="false"[^>]*id="workspace-tree-tab"[^>]*role="tab"[^>]*tabindex="-1"/)
    expect(markup).toContain('id="workspace-code-panel" role="tabpanel"')
    expect(markup).toMatch(/<div[^>]*class="hidden"[^>]*hidden=""[^>]*id="workspace-tree-panel"[^>]*role="tabpanel"/)
    expect(markup).toMatch(/aria-label="Resize Code Space and Viewer"[^>]*aria-orientation="vertical"/)
    expect(markup).toContain('aria-valuenow="44"')
    expect(markup).toContain('role="separator"')
    expect(markup).toContain('Waiting for model...')
  })

  it('maps direct hashes and provides a generic independent Experiment source', () => {
    expect(appViewFromHash('#structure')).toBe('structure')
    expect(appViewFromHash('#experiment')).toBe('experiment')
    expect(appViewFromHash('#help')).toBe('help')
    expect(appViewFromHash('#unknown')).toBe('structure')
    expect(defaultExperimentCode).toContain('initialConditions: () => [')
    expect(defaultExperimentCode).toContain("'experiment.geometry.domain'")
    expect(defaultExperimentCode).toContain("'structure.geometry.sample'")
    expect(defaultExperimentCode).toContain('new Setup(experiment, experiment.randomVars())')
  })

  it('shows the geometry count only while the Geometry Tree tab is active', () => {
    const codeMarkup = renderToStaticMarkup(
      <WorkspaceTabBar activeTab="code" geometryCount={3} onSelect={() => undefined} />,
    )
    const treeMarkup = renderToStaticMarkup(
      <WorkspaceTabBar activeTab="tree" geometryCount={3} onSelect={() => undefined} />,
    )

    expect(codeMarkup).not.toContain('3 geometries')
    expect(treeMarkup).toContain('3 geometries')
    expect(treeMarkup).toMatch(/<button[^>]*aria-selected="true"[^>]*id="workspace-tree-tab"/)
  })

  it('shows the available modeling examples', () => {
    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('aria-label="Select example"')
    expect(markup).toContain('>Fiber Bundle</option>')
    expect(markup).toContain('>Shell Cutaways</option>')
    expect(markup).toContain('>Random Curved Cylinder Array</option>')
    expect(markup).toContain('>Random Curved Sphere HCP Array</option>')
  })
})
