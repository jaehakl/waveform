import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CadDocumentType } from '../cad'
import { StructureExperimentViewer } from './StructureExperimentViewer'
import { useCadWorkspace } from './useCadWorkspace'

function tabLabels(markup: string) {
  const tabList = markup.match(/<div[^>]*aria-label="Structure and Experiment panels"[^>]*>.*?<\/div>/)?.[0] ?? ''
  return [...tabList.matchAll(/<button[^>]*role="tab"[^>]*>([^<]+)<\/button>/g)].map((match) => match[1])
}

function ViewerHarness({
  activeDocumentType,
  experiment,
  structure,
}: {
  activeDocumentType: CadDocumentType | null
  experiment?: string | null
  structure?: string | null
}) {
  const { experimentDocument, structureDocument } = useCadWorkspace(
    structure,
    experiment,
    () => undefined,
    () => undefined,
  )

  return (
    <StructureExperimentViewer
      activeDocumentType={activeDocumentType}
      experiment={experiment}
      experimentDocument={experimentDocument}
      structure={structure}
      structureDocument={structureDocument}
      onActiveDocumentTypeChange={() => undefined}
    />
  )
}

describe('StructureExperimentViewer', () => {
  it('renders all six tabs from externally owned document controllers', () => {
    const markup = renderToStaticMarkup(
      <ViewerHarness
        activeDocumentType="structure"
        experiment="experiment source"
        structure="structure source"
      />,
    )

    expect(tabLabels(markup)).toEqual([
      'Structure Source',
      'Structure Tree',
      'Experiment Source',
      'Experiment Tree',
      'Experimental Parameters',
      'Solver Spec',
    ])
    expect(markup).toContain('id="structure-source-panel" role="tabpanel"')
    expect(markup).toContain('id="experiment-tree-panel" role="tabpanel"')
    expect(markup).not.toContain('data-viewer-canvas="true"')
  })

  it('hides the missing document tabs and selects the first available source', () => {
    const structureMarkup = renderToStaticMarkup(
      <ViewerHarness activeDocumentType="structure" structure="structure source" />,
    )
    const experimentMarkup = renderToStaticMarkup(
      <ViewerHarness activeDocumentType="experiment" experiment="experiment source" />,
    )

    expect(tabLabels(structureMarkup)).toEqual(['Structure Source', 'Structure Tree'])
    expect(structureMarkup).toMatch(/<button[^>]*aria-selected="true"[^>]*id="structure-source-tab"/)
    expect(tabLabels(experimentMarkup)).toEqual([
      'Experiment Source',
      'Experiment Tree',
      'Experimental Parameters',
      'Solver Spec',
    ])
    expect(experimentMarkup).toMatch(/<button[^>]*aria-selected="true"[^>]*id="experiment-source-tab"/)
  })

  it('renders an empty state only for nullish sources', () => {
    const missingMarkup = renderToStaticMarkup(<ViewerHarness activeDocumentType={null} />)
    const emptySourceMarkup = renderToStaticMarkup(
      <ViewerHarness activeDocumentType="structure" structure="" />,
    )

    expect(missingMarkup).toContain('No modeling source')
    expect(missingMarkup).not.toContain('role="tablist"')
    expect(tabLabels(emptySourceMarkup)).toEqual(['Structure Source', 'Structure Tree'])
    expect(emptySourceMarkup).not.toContain('No modeling source')
  })

  it('keeps the right-side Results mode out of the left workspace tabs', () => {
    const markup = renderToStaticMarkup(
      <ViewerHarness activeDocumentType="experiment" experiment="experiment source" />,
    )

    expect(tabLabels(markup)).not.toContain('Result')
    expect(markup).not.toContain('result-tab')
  })
})
