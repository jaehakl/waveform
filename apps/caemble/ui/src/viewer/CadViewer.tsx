import { useCallback, useMemo, useState } from 'react'
import type { CadDocumentType, CadSceneSelection } from '../cad'
import { resolveCadViewerContent, type CadViewerDocument } from './cadViewerContent'
import JscadViewer from './JscadViewer'
import type { CadViewerRecordedData } from './recordedData'

export type { CadViewerDocument } from './cadViewerContent'
export type {
  CadViewerRecordedAxis,
  CadViewerRecordedData,
  CadViewerRecordedTensor,
} from './recordedData'

export type CadViewerActiveSelection = Readonly<{
  documentType: CadDocumentType
  selection: CadSceneSelection
}>

export type CadViewerProps = {
  structure: CadViewerDocument | null
  experiment: CadViewerDocument | null
  selected: CadViewerActiveSelection | null
  recordedData?: CadViewerRecordedData | null
  onRenderEnd: (sources: readonly CadDocumentType[]) => void
  onRenderError: (message: string, sources: readonly CadDocumentType[]) => void
  onRenderStart: (sources: readonly CadDocumentType[]) => void
}

export function CadViewer({
  experiment,
  onRenderEnd,
  onRenderError,
  onRenderStart,
  recordedData,
  selected,
  structure,
}: CadViewerProps) {
  const [structureVisible, setStructureVisible] = useState(true)
  const [experimentVisible, setExperimentVisible] = useState(true)
  const content = useMemo(() => resolveCadViewerContent(
    structure,
    experiment,
    structureVisible,
    experimentVisible,
  ), [experiment, experimentVisible, structure, structureVisible])
  const visibleSelection = selected && content.visibleSources.includes(selected.documentType)
    ? selected
    : null
  const handleRenderStart = useCallback(
    () => onRenderStart(content.visibleSources),
    [content.visibleSources, onRenderStart],
  )
  const handleRenderEnd = useCallback(
    () => onRenderEnd(content.visibleSources),
    [content.visibleSources, onRenderEnd],
  )
  const handleRenderError = useCallback(
    (message: string) => onRenderError(message, content.visibleSources),
    [content.visibleSources, onRenderError],
  )

  return (
    <section aria-label="3D CAD Viewer" className="h-full min-h-[360px] min-w-0">
      <JscadViewer
        availableSources={content.availableSources}
        emptyMessage={content.emptyMessage}
        layers={content.layers}
        recordedData={recordedData}
        recordedDataRules={experiment?.experimentRules?.recordedData}
        selected={visibleSelection}
        visibleSources={content.visibleSources}
        onRenderEnd={handleRenderEnd}
        onRenderError={handleRenderError}
        onRenderStart={handleRenderStart}
        onToggleSource={(documentType) => {
          if (documentType === 'structure') setStructureVisible((current) => !current)
          else setExperimentVisible((current) => !current)
        }}
      />
    </section>
  )
}

export default CadViewer
