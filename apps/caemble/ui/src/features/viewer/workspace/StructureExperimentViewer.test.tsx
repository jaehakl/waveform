import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createCadSourceDocumentV2, type CadDocumentType } from '@/lib/cad'
import type { SolverValidationIssue } from '@/lib/solver'
import { StructureExperimentViewer } from './StructureExperimentViewer'
import { attachPreflightMetadata, useCadWorkspace } from './useCadWorkspace'

function tabLabels(markup: string) {
  const tabList = markup.match(/<div[^>]*aria-label="Structure and Experiment panels"[^>]*>.*?<\/div>/)?.[0] ?? ''
  return [...tabList.matchAll(/<button[^>]*role="tab"[^>]*>([^<]+)<\/button>/g)].map((match) => match[1])
}

function ViewerHarness({
  activeDocumentType,
  experiment,
  preflightIssues = [],
  structure,
  structureLineage,
}: {
  activeDocumentType: CadDocumentType | null
  experiment?: string | null
  preflightIssues?: readonly SolverValidationIssue[]
  structure?: string | null
  structureLineage?: React.ReactNode
}) {
  const structureSourceDocument = structure == null
    ? structure
    : createCadSourceDocumentV2('structure', structure, 1)
  const experimentSourceDocument = experiment == null
    ? experiment
    : createCadSourceDocumentV2('experiment', experiment, 2)
  const { experimentDocument, simulation, structureDocument } = useCadWorkspace(
    structureSourceDocument,
    experimentSourceDocument,
    () => undefined,
    () => undefined,
  )
  const visibleStructureDocument = preflightIssues.length === 0
    ? structureDocument
    : attachPreflightMetadata(
        structureDocument,
        preflightIssues,
        null,
        structureDocument.evaluationTimeoutMs,
        structureDocument.setEvaluationTimeoutMs,
      )

  return (
    <StructureExperimentViewer
      activeDocumentType={activeDocumentType}
      experiment={experimentSourceDocument}
      experimentDocument={experimentDocument}
      solverCompatibility={preflightIssues.length === 0
        ? simulation.compatibility
        : { status: 'incompatible', issues: preflightIssues }}
      structure={structureSourceDocument}
      structureDocument={visibleStructureDocument}
      structureLineage={structureLineage}
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
    expect(markup).toContain('min-h-[360px] min-w-0 flex-col')
    expect(markup).toContain('lg:min-h-0 lg:overflow-hidden')
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

  it('adds the optional Structure lineage tab without changing the default workspace', () => {
    const markup = renderToStaticMarkup(
      <ViewerHarness
        activeDocumentType="structure"
        structure="structure source"
        structureLineage={<div>Lineage content</div>}
      />,
    )

    expect(tabLabels(markup)).toEqual(['Structure Source', 'Structure Tree', '족보 보기'])
    expect(markup).toContain('id="structure-lineage-panel" role="tabpanel"')
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

  it('keeps a successful preview Ready and reports Solver incompatibility as an amber footer status', () => {
    const markup = renderToStaticMarkup(
      <ViewerHarness
        activeDocumentType="structure"
        experiment="experiment source"
        preflightIssues={[{
          documentType: 'structure',
          path: 'rules.initializations[0].target[0]',
          message: 'references missing structure.geometry.conductor.',
        }]}
        structure="structure source"
      />,
    )

    expect(markup).toContain('>Ready</span>')
    expect(markup).toContain('role="status"')
    expect(markup).toContain('Preview ready · Simulation incompatible')
    expect(markup).toContain('See Solver Spec for all compatibility issues.')
    expect(markup).not.toContain('Solver Spec Error')
  })
})
