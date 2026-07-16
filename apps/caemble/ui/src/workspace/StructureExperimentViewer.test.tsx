import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StructureExperimentViewer } from './StructureExperimentViewer'

function tabLabels(markup: string) {
  const tabList = markup.match(/<div[^>]*aria-label="Structure and Experiment panels"[^>]*>.*?<\/div>/)?.[0] ?? ''
  return [...tabList.matchAll(/<button[^>]*role="tab"[^>]*>([^<]+)<\/button>/g)].map((match) => match[1])
}

describe('StructureExperimentViewer', () => {
  it('shows all four tabs when both controlled sources exist', () => {
    const markup = renderToStaticMarkup(
      <StructureExperimentViewer
        experiment="experiment source"
        structure="structure source"
        onExperimentChange={() => undefined}
        onStructureChange={() => undefined}
      />,
    )

    expect(tabLabels(markup)).toEqual([
      'Structure Source',
      'Structure Tree',
      'Experiment Source',
      'Experiment Tree',
    ])
    expect(markup).toContain('id="structure-source-panel" role="tabpanel"')
    expect(markup).toContain('id="experiment-tree-panel" role="tabpanel"')
  })

  it('hides the missing document tabs and selects the first available source', () => {
    const structureMarkup = renderToStaticMarkup(
      <StructureExperimentViewer structure="structure source" onStructureChange={() => undefined} />,
    )
    const experimentMarkup = renderToStaticMarkup(
      <StructureExperimentViewer experiment="experiment source" onExperimentChange={() => undefined} />,
    )

    expect(tabLabels(structureMarkup)).toEqual(['Structure Source', 'Structure Tree'])
    expect(structureMarkup).toMatch(/<button[^>]*aria-selected="true"[^>]*id="structure-source-tab"/)
    expect(tabLabels(experimentMarkup)).toEqual(['Experiment Source', 'Experiment Tree'])
    expect(experimentMarkup).toMatch(/<button[^>]*aria-selected="true"[^>]*id="experiment-source-tab"/)
  })

  it('renders an empty state only for nullish sources', () => {
    const missingMarkup = renderToStaticMarkup(<StructureExperimentViewer />)
    const emptySourceMarkup = renderToStaticMarkup(
      <StructureExperimentViewer structure="" onStructureChange={() => undefined} />,
    )

    expect(missingMarkup).toContain('No modeling source')
    expect(missingMarkup).not.toContain('role="tablist"')
    expect(tabLabels(emptySourceMarkup)).toEqual(['Structure Source', 'Structure Tree'])
    expect(emptySourceMarkup).not.toContain('No modeling source')
  })
})
