import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App reroll control', () => {
  it('shows an enabled Reroll button in the initial Workspace view', () => {
    const markup = renderToStaticMarkup(<App />)
    const button = markup.match(/<button[^>]*aria-label="Reroll random structure"[^>]*>/)?.[0]

    expect(button).toBeDefined()
    expect(button).toContain('title="Re-run the current code to generate a new random structure"')
    expect(button).not.toMatch(/\sdisabled(?:=|\s|>)/)
    expect(markup).toContain('>Reroll</button>')
  })
})
