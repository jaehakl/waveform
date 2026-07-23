import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/use-auth'
import { useCurrentCadSelection } from '@/features/viewer/current-cad-selection'
import { SaveDefinitionDialog, type DefinitionFormValues } from '@/features/viewer/persistence/SaveDefinitionDialog'
import { ViewerPersistenceBar } from '@/features/viewer/persistence/ViewerPersistenceBar'
import { createSampleRecord, createSetupRecord } from '@/features/viewer/persistence/contracts'
import { resolveDocumentMaterials } from '@/features/viewer/persistence/resolveMaterials'
import { saveCadDefinition } from '@/features/viewer/persistence/saveDefinition'
import CadViewer from '@/features/viewer/viewer/CadViewer'
import { StructureExperimentViewer } from '@/features/viewer/workspace/StructureExperimentViewer'
import { useCadWorkspace } from '@/features/viewer/workspace/useCadWorkspace'
import { dbTables, getListRequest } from '@/api'
import {
  cadEntrySource,
  createCadSourceDocumentV2,
  updateCadEntrySource,
  type CadDocumentType,
  type EvaluatedDocumentSnapshotV2,
  type Vars,
} from '@/lib/cad'
import { defaultCode } from '@/lib/defaultCode'
import { defaultExperimentCode } from '@/lib/defaultExperimentCode'
import { caembleExamples } from '@/lib/examples'
import type { MaterialResolution } from '@/lib/material'

const defaultWorkspaceLeftPercent = 44

function clampWorkspaceLeftPercent(percent: number, workspaceWidth: number) {
  const minimum = Math.max(25, (360 / workspaceWidth) * 100)
  const maximum = Math.min(75, ((workspaceWidth - 320) / workspaceWidth) * 100)
  return Math.min(maximum, Math.max(minimum, percent))
}

function positiveId(value: string | null) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

export function ViewerPage() {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const {
    currentExperimentId: selectedExperimentId,
    currentStructureId: selectedStructureId,
    setCurrentExperimentId: setSelectedExperimentId,
    setCurrentStructureId: setSelectedStructureId,
  } = useCurrentCadSelection()
  const [searchParams, setSearchParams] = useSearchParams()
  const [structure, setStructure] = useState(() => createCadSourceDocumentV2('structure', defaultCode))
  const [experiment, setExperiment] = useState(() => createCadSourceDocumentV2('experiment', defaultExperimentCode))
  const [structureVars, setStructureVars] = useState<Readonly<Vars> | undefined>()
  const [experimentVars, setExperimentVars] = useState<Readonly<Vars> | undefined>()
  const [structureMaterialSnapshot, setStructureMaterialSnapshot] = useState<unknown | null>(null)
  const [experimentMaterialSnapshot, setExperimentMaterialSnapshot] = useState<unknown | null>(null)
  const [activeDocumentType, setActiveDocumentType] = useState<CadDocumentType>('structure')
  const [workspaceLeftPercent, setWorkspaceLeftPercent] = useState(defaultWorkspaceLeftPercent)
  const [selectedStructureMetadata, setSelectedStructureMetadata] = useState<DefinitionFormValues | null>(null)
  const [selectedExperimentMetadata, setSelectedExperimentMetadata] = useState<DefinitionFormValues | null>(null)
  const [selectedSampleId, setSelectedSampleId] = useState<number | null>(null)
  const [selectedSetupId, setSelectedSetupId] = useState<number | null>(null)
  const [savedStructureCode, setSavedStructureCode] = useState<string | null>(null)
  const [savedExperimentCode, setSavedExperimentCode] = useState<string | null>(null)
  const [definitionDialog, setDefinitionDialog] = useState<'experiment' | 'structure' | null>(null)
  const initializedFromUrl = useRef(false)
  const workspaceRef = useRef<HTMLDivElement | null>(null)

  const mineRequest = getListRequest('mine')
  const samplesQuery = useQuery({
    queryKey: ['work', 'samples'],
    queryFn: () => dbTables.Sample.listRows(mineRequest),
    enabled: auth.isAuthenticated,
  })
  const setupsQuery = useQuery({
    queryKey: ['work', 'setups'],
    queryFn: () => dbTables.Setup.listRows(mineRequest),
    enabled: auth.isAuthenticated,
  })
  const samples = useMemo(() => samplesQuery.data?.items ?? [], [samplesQuery.data?.items])
  const setups = useMemo(() => setupsQuery.data?.items ?? [], [setupsQuery.data?.items])

  const updateDeepLink = useCallback(
    (updates: Partial<Record<'experiment' | 'sample' | 'setup' | 'structure', number | null>>) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          Object.entries(updates).forEach(([key, value]) => (value ? next.set(key, String(value)) : next.delete(key)))
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const clearSampleSelection = useCallback(() => {
    setSelectedSampleId(null)
    setStructureVars(undefined)
    setStructureMaterialSnapshot(null)
    updateDeepLink({ sample: null })
  }, [updateDeepLink])
  const clearSetupSelection = useCallback(() => {
    setSelectedSetupId(null)
    setExperimentVars(undefined)
    setExperimentMaterialSnapshot(null)
    updateDeepLink({ setup: null })
  }, [updateDeepLink])
  const handleStructureChange = useCallback(
    (document: typeof structure) => {
      setStructure(document)
      clearSampleSelection()
    },
    [clearSampleSelection],
  )
  const handleExperimentChange = useCallback(
    (document: typeof experiment) => {
      setExperiment(document)
      clearSetupSelection()
    },
    [clearSetupSelection],
  )

  const resolveMaterials = useCallback(
    (snapshot: EvaluatedDocumentSnapshotV2): Promise<MaterialResolution> =>
      resolveDocumentMaterials(
        snapshot,
        snapshot.kind === 'structure' ? structureMaterialSnapshot : experimentMaterialSnapshot,
      ),
    [experimentMaterialSnapshot, structureMaterialSnapshot],
  )

  const { experimentDocument, simulation, structureDocument } = useCadWorkspace(
    structure,
    experiment,
    handleStructureChange,
    handleExperimentChange,
    structureVars,
    experimentVars,
    resolveMaterials,
  )

  const fetchStructure = useCallback(
    async (id: number) => (await dbTables.Structure.listRows(getListRequest('visible', [id]))).items[0],
    [],
  )
  const fetchExperiment = useCallback(
    async (id: number) => (await dbTables.Experiment.listRows(getListRequest('visible', [id]))).items[0],
    [],
  )
  const fetchSample = useCallback(
    async (id: number) => {
      const local = samples.find((row) => row.id === id)
      return local ?? (await dbTables.Sample.listRows(getListRequest('visible', [id]))).items[0]
    },
    [samples],
  )
  const fetchSetup = useCallback(
    async (id: number) => {
      const local = setups.find((row) => row.id === id)
      return local ?? (await dbTables.Setup.listRows(getListRequest('visible', [id]))).items[0]
    },
    [setups],
  )

  const loadStructure = useCallback(
    async (id: number, updateUrl = true) => {
      const record = await fetchStructure(id)
      if (!record) throw new Error('Structure를 찾을 수 없습니다.')
      setStructure(createCadSourceDocumentV2('structure', record.code))
      setStructureVars(undefined)
      setStructureMaterialSnapshot(null)
      setSelectedStructureId(id)
      setSelectedStructureMetadata({ description: record.description ?? '', name: record.name })
      setSelectedSampleId(null)
      setSavedStructureCode(record.code)
      const selection = { structure: id, sample: null }
      if (updateUrl) updateDeepLink(selection)
      return selection
    },
    [fetchStructure, setSelectedStructureId, updateDeepLink],
  )
  const loadExperiment = useCallback(
    async (id: number, updateUrl = true) => {
      const record = await fetchExperiment(id)
      if (!record) throw new Error('Experiment를 찾을 수 없습니다.')
      setExperiment(createCadSourceDocumentV2('experiment', record.code))
      setExperimentVars(undefined)
      setExperimentMaterialSnapshot(null)
      setSelectedExperimentId(id)
      setSelectedExperimentMetadata({ description: record.description ?? '', name: record.name })
      setSelectedSetupId(null)
      setSavedExperimentCode(record.code)
      const selection = { experiment: id, setup: null }
      if (updateUrl) updateDeepLink(selection)
      return selection
    },
    [fetchExperiment, setSelectedExperimentId, updateDeepLink],
  )
  const loadSample = useCallback(
    async (id: number, updateUrl = true) => {
      const sample = await fetchSample(id)
      if (!sample) throw new Error('Sample을 찾을 수 없습니다.')
      const parent = await fetchStructure(sample.structure_id)
      if (!parent) throw new Error('Sample의 부모 Structure를 찾을 수 없습니다.')
      setStructure(createCadSourceDocumentV2('structure', parent.code))
      setStructureVars(sample.vars as Readonly<Vars>)
      setStructureMaterialSnapshot(sample.material_parameters)
      setSelectedStructureId(sample.structure_id)
      setSelectedStructureMetadata({ description: parent.description ?? '', name: parent.name })
      setSelectedSampleId(id)
      setSavedStructureCode(parent.code)
      const selection = { structure: sample.structure_id, sample: id }
      if (updateUrl) updateDeepLink(selection)
      return selection
    },
    [fetchSample, fetchStructure, setSelectedStructureId, updateDeepLink],
  )
  const loadSetup = useCallback(
    async (id: number, updateUrl = true) => {
      const setup = await fetchSetup(id)
      if (!setup) throw new Error('Setup을 찾을 수 없습니다.')
      const parent = await fetchExperiment(setup.experiment_id)
      if (!parent) throw new Error('Setup의 부모 Experiment를 찾을 수 없습니다.')
      setExperiment(createCadSourceDocumentV2('experiment', parent.code))
      setExperimentVars(setup.vars as Readonly<Vars>)
      setExperimentMaterialSnapshot(setup.material_parameters)
      setSelectedExperimentId(setup.experiment_id)
      setSelectedExperimentMetadata({ description: parent.description ?? '', name: parent.name })
      setSelectedSetupId(id)
      setSavedExperimentCode(parent.code)
      const selection = { experiment: setup.experiment_id, setup: id }
      if (updateUrl) updateDeepLink(selection)
      return selection
    },
    [fetchExperiment, fetchSetup, setSelectedExperimentId, updateDeepLink],
  )

  useEffect(() => {
    if (initializedFromUrl.current) return
    initializedFromUrl.current = true
    const sampleId = positiveId(searchParams.get('sample'))
    const setupId = positiveId(searchParams.get('setup'))
    const structureParam = searchParams.get('structure')
    const experimentParam = searchParams.get('experiment')
    const structureId = structureParam === null ? selectedStructureId : positiveId(structureParam)
    const experimentId = experimentParam === null ? selectedExperimentId : positiveId(experimentParam)

    const structureTask =
      structureParam !== null && structureId === null && sampleId === null
        ? (() => {
            setSelectedStructureId(null)
            setSelectedStructureMetadata(null)
            toast.error('Structure를 찾을 수 없습니다.')
            return Promise.resolve({ sample: null, structure: null })
          })()
        : (sampleId
            ? loadSample(sampleId, false)
            : structureId
              ? loadStructure(structureId, false)
              : Promise.resolve({})
          ).catch((error: unknown) => {
            setSelectedStructureId(null)
            setSelectedStructureMetadata(null)
            toast.error(error instanceof Error ? error.message : 'Structure를 불러오지 못했습니다.')
            return { sample: null, structure: null }
          })

    const experimentTask =
      experimentParam !== null && experimentId === null && setupId === null
        ? (() => {
            setSelectedExperimentId(null)
            setSelectedExperimentMetadata(null)
            toast.error('Experiment를 찾을 수 없습니다.')
            return Promise.resolve({ experiment: null, setup: null })
          })()
        : (setupId
            ? loadSetup(setupId, false)
            : experimentId
              ? loadExperiment(experimentId, false)
              : Promise.resolve({})
          ).catch((error: unknown) => {
            setSelectedExperimentId(null)
            setSelectedExperimentMetadata(null)
            toast.error(error instanceof Error ? error.message : 'Experiment를 불러오지 못했습니다.')
            return { experiment: null, setup: null }
          })

    void Promise.all([structureTask, experimentTask]).then(([structureSelection, experimentSelection]) => {
      updateDeepLink({ ...structureSelection, ...experimentSelection })
    })
  }, [
    loadExperiment,
    loadSample,
    loadSetup,
    loadStructure,
    searchParams,
    selectedExperimentId,
    selectedStructureId,
    setSelectedExperimentId,
    setSelectedStructureId,
    updateDeepLink,
  ])

  const definitionMutation = useMutation({
    mutationFn: ({ kind, values }: { kind: 'experiment' | 'structure'; values: DefinitionFormValues }) =>
      saveCadDefinition({
        document: kind === 'structure' ? structure : experiment,
        kind,
        savedCode: kind === 'structure' ? savedStructureCode : savedExperimentCode,
        selectedId: kind === 'structure' ? selectedStructureId : selectedExperimentId,
        values,
      }),
    onSuccess: ({ action, code, id, kind }, { values }) => {
      if (kind === 'structure') {
        setSelectedStructureId(id)
        setSelectedStructureMetadata(values)
        setSavedStructureCode(code)
        updateDeepLink({ structure: id })
      } else {
        setSelectedExperimentId(id)
        setSelectedExperimentMetadata(values)
        setSavedExperimentCode(code)
        updateDeepLink({ experiment: id })
      }
      setDefinitionDialog(null)
      void queryClient.invalidateQueries({ queryKey: ['work', `${kind}s`] })
      toast.success(
        action === 'forked'
          ? `${kind === 'structure' ? 'Structure' : 'Experiment'} 구조 변경을 새 자식으로 저장했습니다.`
          : `${kind === 'structure' ? 'Structure' : 'Experiment'} 정의를 저장했습니다.`,
      )
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : '정의를 저장하지 못했습니다.'),
  })

  const realizationMutation = useMutation({
    mutationFn: async (kind: 'sample' | 'setup') => {
      if (kind === 'sample') {
        if (
          !selectedStructureId ||
          !structureDocument.variables ||
          savedStructureCode !== cadEntrySource(structure) ||
          structureDocument.status !== 'Ready'
        )
          throw new Error('저장된 Structure와 Ready 평가가 필요합니다.')
        if (!structureDocument.materialParameters) throw new Error('해석된 Material snapshot이 없습니다.')
        const [result] = await dbTables.Sample.upsertRow([
          createSampleRecord(selectedStructureId, structureDocument.variables, structureDocument.materialParameters),
        ])
        return { id: result.id, kind }
      }
      if (
        !selectedExperimentId ||
        !experimentDocument.variables ||
        savedExperimentCode !== cadEntrySource(experiment) ||
        experimentDocument.status !== 'Ready'
      )
        throw new Error('저장된 Experiment와 Ready 평가가 필요합니다.')
      if (!experimentDocument.materialParameters) throw new Error('해석된 Material snapshot이 없습니다.')
      const [result] = await dbTables.Setup.upsertRow([
        createSetupRecord(selectedExperimentId, experimentDocument.variables, experimentDocument.materialParameters),
      ])
      return { id: result.id, kind }
    },
    onSuccess: ({ id, kind }) => {
      if (kind === 'sample') {
        setSelectedSampleId(id)
        updateDeepLink({ sample: id })
        void queryClient.invalidateQueries({ queryKey: ['work', 'samples'] })
      } else {
        setSelectedSetupId(id)
        updateDeepLink({ setup: id })
        void queryClient.invalidateQueries({ queryKey: ['work', 'setups'] })
      }
      toast.success(`${kind === 'sample' ? 'Sample' : 'Setup'} 실현값을 저장했습니다.`)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : '실현값을 저장하지 못했습니다.'),
  })

  const requireLogin = () => {
    if (auth.isAuthenticated) return true
    navigate('/login', { state: { from: `${location.pathname}${location.search}` } })
    return false
  }
  const openDefinitionDialog = (kind: 'experiment' | 'structure') => {
    if (requireLogin()) setDefinitionDialog(kind)
  }
  const saveRealization = (kind: 'sample' | 'setup') => {
    if (requireLogin()) realizationMutation.mutate(kind)
  }

  const selectedExample = caembleExamples.find((example) => example.code === cadEntrySource(structure))
  const structureViewerDocument = useMemo(
    () => ({
      scene: structureDocument.scene,
      sceneHash: structureDocument.sceneHash,
      variables: structureDocument.variables,
    }),
    [structureDocument.scene, structureDocument.sceneHash, structureDocument.variables],
  )
  const experimentViewerDocument = useMemo(
    () => ({
      experimentRules: experimentDocument.experimentRules,
      scene: experimentDocument.scene,
      sceneHash: experimentDocument.sceneHash,
      variables: experimentDocument.variables,
    }),
    [
      experimentDocument.experimentRules,
      experimentDocument.scene,
      experimentDocument.sceneHash,
      experimentDocument.variables,
    ],
  )
  const activeDocument = activeDocumentType === 'structure' ? structureDocument : experimentDocument
  const viewerSelection = useMemo(
    () => (activeDocument.selection ? { documentType: activeDocumentType, selection: activeDocument.selection } : null),
    [activeDocument.selection, activeDocumentType],
  )
  const structureRenderStart = structureDocument.handleRenderStart
  const structureRenderEnd = structureDocument.handleRenderEnd
  const structureRenderError = structureDocument.handleRenderError
  const experimentRenderStart = experimentDocument.handleRenderStart
  const experimentRenderEnd = experimentDocument.handleRenderEnd
  const experimentRenderError = experimentDocument.handleRenderError
  const handleRenderStart = useCallback(
    (sources: readonly CadDocumentType[]) => {
      if (sources.includes('structure')) structureRenderStart()
      if (sources.includes('experiment')) experimentRenderStart()
    },
    [experimentRenderStart, structureRenderStart],
  )
  const handleRenderEnd = useCallback(
    (sources: readonly CadDocumentType[]) => {
      if (sources.includes('structure')) structureRenderEnd()
      if (sources.includes('experiment')) experimentRenderEnd()
    },
    [experimentRenderEnd, structureRenderEnd],
  )
  const handleRenderError = useCallback(
    (message: string, sources: readonly CadDocumentType[]) => {
      if (sources.includes('structure')) structureRenderError(message)
      if (sources.includes('experiment')) experimentRenderError(message)
    },
    [experimentRenderError, structureRenderError],
  )
  const sampleUnavailableReason = !selectedStructureId
    ? 'Structure 정의를 먼저 저장하세요.'
    : savedStructureCode !== cadEntrySource(structure)
      ? '변경된 Structure 정의를 먼저 저장하세요.'
      : structureDocument.status !== 'Ready'
        ? `Structure 평가 상태가 ${structureDocument.status}입니다.`
        : !structureDocument.variables
          ? '평가된 Structure vars가 없습니다.'
          : null
  const setupUnavailableReason = !selectedExperimentId
    ? 'Experiment 정의를 먼저 저장하세요.'
    : savedExperimentCode !== cadEntrySource(experiment)
      ? '변경된 Experiment 정의를 먼저 저장하세요.'
      : experimentDocument.status !== 'Ready'
        ? `Experiment 평가 상태가 ${experimentDocument.status}입니다.`
        : !experimentDocument.variables
          ? '평가된 Experiment vars가 없습니다.'
          : null
  const sampleReady = !auth.isAuthenticated || sampleUnavailableReason === null
  const setupReady = !auth.isAuthenticated || setupUnavailableReason === null

  return (
    <section
      aria-label="Code-to-CAD Viewer 페이지"
      className="flex h-full min-h-0 flex-col overflow-auto lg:overflow-hidden"
    >
      <ViewerPersistenceBar
        currentExampleId={selectedExample?.id ?? ''}
        currentExperimentName={selectedExperimentMetadata?.name ?? null}
        currentStructureName={selectedStructureMetadata?.name ?? null}
        onExampleChange={(id) => {
          const example = caembleExamples.find((item) => item.id === id)
          if (!example) return
          setStructure((current) => updateCadEntrySource(current, example.code))
          setSelectedStructureId(null)
          setSelectedStructureMetadata(null)
          setSavedStructureCode(null)
          clearSampleSelection()
          updateDeepLink({ structure: null })
        }}
        onLoadSample={(id) =>
          void loadSample(id).catch((error: unknown) =>
            toast.error(error instanceof Error ? error.message : 'Sample을 열지 못했습니다.'),
          )
        }
        onLoadSetup={(id) =>
          void loadSetup(id).catch((error: unknown) =>
            toast.error(error instanceof Error ? error.message : 'Setup을 열지 못했습니다.'),
          )
        }
        onSaveExperiment={() => openDefinitionDialog('experiment')}
        onSaveSample={() => saveRealization('sample')}
        onSaveSetup={() => saveRealization('setup')}
        onSaveStructure={() => openDefinitionDialog('structure')}
        realizationPending={realizationMutation.isPending}
        sampleReady={sampleReady}
        sampleUnavailableReason={sampleUnavailableReason}
        samples={samples}
        selectedSampleId={selectedSampleId}
        selectedSetupId={selectedSetupId}
        setupReady={setupReady}
        setupUnavailableReason={setupUnavailableReason}
        setups={setups}
      />
      <div
        className="grid min-h-0 flex-1 grid-cols-1 lg:h-full lg:grid-cols-[minmax(360px,var(--workspace-left-width))_5px_minmax(0,1fr)] lg:overflow-hidden"
        ref={workspaceRef}
        style={{ '--workspace-left-width': `${workspaceLeftPercent}%` } as CSSProperties}
      >
        <div className="min-h-[360px] min-w-0 border-b lg:h-full lg:min-h-0 lg:overflow-hidden lg:border-b-0">
          <StructureExperimentViewer
            activeDocumentType={activeDocumentType}
            experiment={experiment}
            experimentDocument={experimentDocument}
            solverCompatibility={simulation.compatibility}
            structure={structure}
            structureDocument={structureDocument}
            onActiveDocumentTypeChange={setActiveDocumentType}
          />
        </div>
        <div
          aria-label="모델링 패널과 Viewer 크기 조절"
          aria-orientation="vertical"
          aria-valuemax={75}
          aria-valuemin={25}
          aria-valuenow={Math.round(workspaceLeftPercent)}
          className="group hidden cursor-col-resize touch-none items-stretch justify-center bg-muted outline-none hover:bg-neutral-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset lg:flex"
          role="separator"
          tabIndex={0}
          onDoubleClick={() => setWorkspaceLeftPercent(defaultWorkspaceLeftPercent)}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            const width = workspaceRef.current?.getBoundingClientRect().width
            if (!width) return
            event.preventDefault()
            setWorkspaceLeftPercent((current) =>
              clampWorkspaceLeftPercent(current + (event.key === 'ArrowLeft' ? -2 : 2), width),
            )
          }}
          onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
            const bounds = workspaceRef.current?.getBoundingClientRect()
            if (bounds)
              setWorkspaceLeftPercent(
                clampWorkspaceLeftPercent(((event.clientX - bounds.left) / bounds.width) * 100, bounds.width),
              )
          }}
          onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
        >
          <span className="w-px bg-border group-hover:bg-neutral-400" />
        </div>
        <CadViewer
          experiment={experimentViewerDocument}
          recordedData={simulation.recordedData}
          selected={viewerSelection}
          simulation={{
            canRun: simulation.canRun,
            cancel: simulation.cancel,
            compatibility: simulation.compatibility,
            process: simulation.process,
            run: simulation.run,
            solver: experimentDocument.solver,
            stale: simulation.stale,
          }}
          structure={structureViewerDocument}
          onRenderEnd={handleRenderEnd}
          onRenderError={handleRenderError}
          onRenderStart={handleRenderStart}
        />
      </div>
      <SaveDefinitionDialog
        defaults={selectedStructureMetadata ?? { name: '새 Structure', description: '' }}
        kind="Structure"
        onOpenChange={(open) => setDefinitionDialog(open ? 'structure' : null)}
        onSubmit={async (values) => {
          await definitionMutation.mutateAsync({ kind: 'structure', values })
        }}
        open={definitionDialog === 'structure'}
        pending={definitionMutation.isPending}
      />
      <SaveDefinitionDialog
        defaults={selectedExperimentMetadata ?? { name: '새 Experiment', description: '' }}
        kind="Experiment"
        onOpenChange={(open) => setDefinitionDialog(open ? 'experiment' : null)}
        onSubmit={async (values) => {
          await definitionMutation.mutateAsync({ kind: 'experiment', values })
        }}
        open={definitionDialog === 'experiment'}
        pending={definitionMutation.isPending}
      />
    </section>
  )
}

export const Component = ViewerPage
