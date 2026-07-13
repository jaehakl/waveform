import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import JscadViewer from './JscadViewer'

describe('JscadViewer Material legend', () => {
  it('shows each used Material once with its display color', () => {
    const markup = renderToStaticMarkup(
      <JscadViewer
        onRenderEnd={() => undefined}
        onRenderError={() => undefined}
        onRenderStart={() => undefined}
        parts={[
          { geometry: {}, materialName: 'Core', displayColor: '#2563eb' },
          { geometry: {}, materialName: 'Core', displayColor: '#2563eb' },
          { geometry: {}, materialName: 'Cladding', displayColor: '#f59e0b' },
        ]}
      />,
    )

    expect(markup.match(/Core/g)).toHaveLength(1)
    expect(markup.match(/Cladding/g)).toHaveLength(1)
    expect(markup).toContain('background-color:#2563eb')
    expect(markup).toContain('background-color:#f59e0b')
  })
})
