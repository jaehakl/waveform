import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App, { WorkspaceTabBar } from './App'

describe('App workspace', () => {
  it('shows an enabled Reroll button and defaults to the Code Space tab', () => {
    const markup = renderToStaticMarkup(<App />)
    const button = markup.match(/<button[^>]*aria-label="Reroll random structure"[^>]*>/)?.[0]

    expect(button).toBeDefined()
    expect(button).toContain('title="Re-run the current code to generate a new random structure"')
    expect(button).not.toMatch(/\sdisabled(?:=|\s|>)/)
    expect(markup).toContain('>Reroll</button>')
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
