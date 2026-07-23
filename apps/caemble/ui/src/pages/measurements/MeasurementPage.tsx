import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Box, FlaskConical, LoaderCircle, LogIn, Pencil, Play, Plus, Rows3, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { dbTables, getListRequest } from '@/api'
import type {
  ExperimentRecord,
  GetListResponse,
  MeasurementRecord,
  MeasurementSaveRequest,
  RecordedDataRecord,
  SampleRecord,
  SetupRecord,
  StructureRecord,
} from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/features/auth/use-auth'
import { useCurrentCadSelection } from '@/features/viewer/current-cad-selection'
import { createSampleRecord, createSetupRecord } from '@/features/viewer/persistence/contracts'
import { resolveDocumentMaterials } from '@/features/viewer/persistence/resolveMaterials'
import CadViewer from '@/features/viewer/viewer/CadViewer'
import { useCadWorkspace } from '@/features/viewer/workspace/useCadWorkspace'
import {
  createCadSourceDocumentV2,
  normalizeRecordedDataTensor,
  type CadDocumentType,
  type CadSourceDocumentV2,
  type EvaluatedDocumentSnapshotV2,
  type RecordedData,
  type Vars,
} from '@/lib/cad'
import type { MaterialResolution } from '@/lib/material'

function positiveId(value: string | null) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function formatTimestamp(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('ko-KR') : '방금 전'
}

export function MeasurementPage() {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentExperimentId, currentStructureId, setCurrentExperimentId, setCurrentStructureId } =
    useCurrentCadSelection()
  const [structure, setStructure] = useState<CadSourceDocumentV2 | null>(null)
  const [experiment, setExperiment] = useState<CadSourceDocumentV2 | null>(null)
  const [structureRecord, setStructureRecord] = useState<StructureRecord | null>(null)
  const [experimentRecord, setExperimentRecord] = useState<ExperimentRecord | null>(null)
  const [structureVars, setStructureVars] = useState<Readonly<Vars> | undefined>()
  const [experimentVars, setExperimentVars] = useState<Readonly<Vars> | undefined>()
  const [structureMaterialSnapshot, setStructureMaterialSnapshot] = useState<unknown | null>(null)
  const [experimentMaterialSnapshot, setExperimentMaterialSnapshot] = useState<unknown | null>(null)
  const [selectedSampleId, setSelectedSampleId] = useState<number | null>(null)
  const [selectedSetupId, setSelectedSetupId] = useState<number | null>(null)
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<'measurement' | 'sample' | 'setup' | null>(null)
  const [hideLiveRecordedData, setHideLiveRecordedData] = useState(false)
  const [pendingRealization, setPendingRealization] = useState<{
    kind: 'sample' | 'setup'
    minimumRevision: number
  } | null>(null)
  const [waitingForMeasurement, setWaitingForMeasurement] = useState(false)
  const initializedFromUrl = useRef(false)
  const runPreviousRecordedData = useRef<RecordedData | null>(null)
  const runSelection = useRef<{ sampleId: number; setupId: number } | null>(null)

  const updateDeepLink = useCallback(
    (updates: Partial<Record<'experiment' | 'measurement' | 'sample' | 'setup' | 'structure', number | null>>) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          Object.entries(updates).forEach(([key, value]) => {
            if (value) next.set(key, String(value))
            else next.delete(key)
          })
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const samplesQuery = useQuery({
    queryKey: ['measurements', 'samples', currentStructureId],
    queryFn: () =>
      dbTables.Sample.listRows({
        ...getListRequest('mine'),
        limit: null,
        filter: { structure_id: [currentStructureId, currentStructureId] },
      }),
    enabled: auth.isAuthenticated && currentStructureId !== null,
  })
  const setupsQuery = useQuery({
    queryKey: ['measurements', 'setups', currentExperimentId],
    queryFn: () =>
      dbTables.Setup.listRows({
        ...getListRequest('mine'),
        limit: null,
        filter: { experiment_id: [currentExperimentId, currentExperimentId] },
      }),
    enabled: auth.isAuthenticated && currentExperimentId !== null,
  })
  const measurementsQuery = useQuery({
    queryKey: ['measurements', 'context', currentStructureId, currentExperimentId],
    queryFn: () => dbTables.Measurement.listContext(currentStructureId!, currentExperimentId!),
    enabled: auth.isAuthenticated && currentStructureId !== null && currentExperimentId !== null,
  })
  const recordedDataQuery = useQuery({
    queryKey: ['measurements', 'recorded-data', selectedMeasurementId],
    queryFn: () =>
      dbTables.RecordedData.listRows({
        ...getListRequest('mine'),
        limit: null,
        filter: { measurement_id: [selectedMeasurementId, selectedMeasurementId] },
      }),
    enabled: auth.isAuthenticated && selectedMeasurementId !== null,
  })

  const samples = useMemo(
    () => (samplesQuery.data?.items ?? []).filter((row): row is SampleRecord & { id: number } => row.id !== undefined),
    [samplesQuery.data?.items],
  )
  const setups = useMemo(
    () => (setupsQuery.data?.items ?? []).filter((row): row is SetupRecord & { id: number } => row.id !== undefined),
    [setupsQuery.data?.items],
  )
  const measurements = useMemo(
    () =>
      (measurementsQuery.data?.items ?? []).filter(
        (row): row is MeasurementRecord & { id: number } => row.id !== undefined,
      ),
    [measurementsQuery.data?.items],
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
    setStructure,
    setExperiment,
    structureVars,
    experimentVars,
    resolveMaterials,
  )

  const fetchStructure = useCallback(async (id: number) => {
    return (await dbTables.Structure.listRows(getListRequest('visible', [id]))).items[0] ?? null
  }, [])
  const fetchExperiment = useCallback(async (id: number) => {
    return (await dbTables.Experiment.listRows(getListRequest('visible', [id]))).items[0] ?? null
  }, [])
  const fetchSample = useCallback(async (id: number) => {
    return (await dbTables.Sample.listRows(getListRequest('mine', [id]))).items[0] ?? null
  }, [])
  const fetchSetup = useCallback(async (id: number) => {
    return (await dbTables.Setup.listRows(getListRequest('mine', [id]))).items[0] ?? null
  }, [])
  const fetchMeasurement = useCallback(async (id: number) => {
    return (await dbTables.Measurement.listRows(getListRequest('mine', [id]))).items[0] ?? null
  }, [])

  const applyStructure = useCallback(
    (record: StructureRecord, resetRealization: boolean) => {
      if (!record.id) throw new Error('Structure ID가 없습니다.')
      setStructure(createCadSourceDocumentV2('structure', record.code))
      setStructureRecord(record)
      setCurrentStructureId(record.id)
      if (resetRealization) {
        setStructureVars(undefined)
        setStructureMaterialSnapshot(null)
        setSelectedSampleId(null)
      }
    },
    [setCurrentStructureId],
  )
  const applyExperiment = useCallback(
    (record: ExperimentRecord, resetRealization: boolean) => {
      if (!record.id) throw new Error('Experiment ID가 없습니다.')
      setExperiment(createCadSourceDocumentV2('experiment', record.code))
      setExperimentRecord(record)
      setCurrentExperimentId(record.id)
      if (resetRealization) {
        setExperimentVars(undefined)
        setExperimentMaterialSnapshot(null)
        setSelectedSetupId(null)
      }
    },
    [setCurrentExperimentId],
  )

  const loadStructure = useCallback(
    async (id: number, updateUrl = true) => {
      const record = await fetchStructure(id)
      if (!record) throw new Error('Structure를 찾을 수 없습니다.')
      applyStructure(record, true)
      setSelectedMeasurementId(null)
      setHideLiveRecordedData(true)
      if (updateUrl) updateDeepLink({ structure: id, sample: null, measurement: null })
      return record
    },
    [applyStructure, fetchStructure, updateDeepLink],
  )
  const loadExperiment = useCallback(
    async (id: number, updateUrl = true) => {
      const record = await fetchExperiment(id)
      if (!record) throw new Error('Experiment를 찾을 수 없습니다.')
      applyExperiment(record, true)
      setSelectedMeasurementId(null)
      setHideLiveRecordedData(true)
      if (updateUrl) updateDeepLink({ experiment: id, setup: null, measurement: null })
      return record
    },
    [applyExperiment, fetchExperiment, updateDeepLink],
  )
  const loadSample = useCallback(
    async (id: number, updateUrl = true) => {
      const sample = await fetchSample(id)
      if (!sample) throw new Error('Sample을 찾을 수 없습니다.')
      const parent = await fetchStructure(sample.structure_id)
      if (!parent) throw new Error('Sample의 Structure를 찾을 수 없습니다.')
      applyStructure(parent, false)
      setStructureVars(sample.vars as Readonly<Vars>)
      setStructureMaterialSnapshot(sample.material_parameters)
      setSelectedSampleId(id)
      setSelectedMeasurementId(null)
      setHideLiveRecordedData(true)
      if (updateUrl) updateDeepLink({ structure: sample.structure_id, sample: id, measurement: null })
      return sample
    },
    [applyStructure, fetchSample, fetchStructure, updateDeepLink],
  )
  const loadSetup = useCallback(
    async (id: number, updateUrl = true) => {
      const setup = await fetchSetup(id)
      if (!setup) throw new Error('Setup을 찾을 수 없습니다.')
      const parent = await fetchExperiment(setup.experiment_id)
      if (!parent) throw new Error('Setup의 Experiment를 찾을 수 없습니다.')
      applyExperiment(parent, false)
      setExperimentVars(setup.vars as Readonly<Vars>)
      setExperimentMaterialSnapshot(setup.material_parameters)
      setSelectedSetupId(id)
      setSelectedMeasurementId(null)
      setHideLiveRecordedData(true)
      if (updateUrl) updateDeepLink({ experiment: setup.experiment_id, setup: id, measurement: null })
      return setup
    },
    [applyExperiment, fetchExperiment, fetchSetup, updateDeepLink],
  )
  const loadMeasurement = useCallback(
    async (id: number, updateUrl = true) => {
      const measurement = measurements.find((row) => row.id === id) ?? (await fetchMeasurement(id))
      if (!measurement) throw new Error('Measurement를 찾을 수 없습니다.')
      const [sample, setup] = await Promise.all([
        loadSample(measurement.sample_id, false),
        loadSetup(measurement.setup_id, false),
      ])
      setSelectedMeasurementId(id)
      if (updateUrl) {
        updateDeepLink({
          structure: sample.structure_id,
          experiment: setup.experiment_id,
          sample: measurement.sample_id,
          setup: measurement.setup_id,
          measurement: id,
        })
      }
      return measurement
    },
    [fetchMeasurement, loadSample, loadSetup, measurements, updateDeepLink],
  )

  useEffect(() => {
    if (initializedFromUrl.current || auth.isLoading) return
    initializedFromUrl.current = true

    const initialize = async () => {
      const measurementId = positiveId(searchParams.get('measurement'))
      const sampleId = positiveId(searchParams.get('sample'))
      const setupId = positiveId(searchParams.get('setup'))
      const structureId = positiveId(searchParams.get('structure')) ?? currentStructureId
      const experimentId = positiveId(searchParams.get('experiment')) ?? currentExperimentId

      if (measurementId && auth.isAuthenticated) {
        await loadMeasurement(measurementId)
        return
      }
      const [sample, setup] = await Promise.all([
        sampleId && auth.isAuthenticated
          ? loadSample(sampleId, false)
          : structureId
            ? loadStructure(structureId, false).then(() => null)
            : Promise.resolve(null),
        setupId && auth.isAuthenticated
          ? loadSetup(setupId, false)
          : experimentId
            ? loadExperiment(experimentId, false).then(() => null)
            : Promise.resolve(null),
      ])
      updateDeepLink({
        structure: sample?.structure_id ?? structureId ?? null,
        experiment: setup?.experiment_id ?? experimentId ?? null,
        sample: sample?.id ?? null,
        setup: setup?.id ?? null,
        measurement: null,
      })
    }

    void initialize().catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Measurement 작업을 불러오지 못했습니다.')
      updateDeepLink({ measurement: null })
    })
  }, [
    auth.isAuthenticated,
    auth.isLoading,
    currentExperimentId,
    currentStructureId,
    loadExperiment,
    loadMeasurement,
    loadSample,
    loadSetup,
    loadStructure,
    searchParams,
    updateDeepLink,
  ])

  useEffect(() => {
    if (auth.isLoading || auth.isAuthenticated) return
    setStructureVars(undefined)
    setExperimentVars(undefined)
    setStructureMaterialSnapshot(null)
    setExperimentMaterialSnapshot(null)
    setSelectedSampleId(null)
    setSelectedSetupId(null)
    setSelectedMeasurementId(null)
    setDeleteTarget(null)
    setHideLiveRecordedData(true)
    setPendingRealization(null)
    setWaitingForMeasurement(false)
    runSelection.current = null
    updateDeepLink({ sample: null, setup: null, measurement: null })
  }, [auth.isAuthenticated, auth.isLoading, updateDeepLink])

  useEffect(() => {
    if (
      !auth.isAuthenticated ||
      selectedSampleId === null ||
      selectedSetupId === null ||
      !measurementsQuery.data
    )
      return

    const matchingMeasurement =
      measurements.find(
        (measurement) =>
          measurement.sample_id === selectedSampleId &&
          measurement.setup_id === selectedSetupId,
      ) ?? null
    const matchingMeasurementId = matchingMeasurement?.id ?? null
    if (selectedMeasurementId === matchingMeasurementId) return

    setSelectedMeasurementId(matchingMeasurementId)
    setHideLiveRecordedData(true)
    updateDeepLink({ measurement: matchingMeasurementId })
  }, [
    auth.isAuthenticated,
    measurements,
    measurementsQuery.data,
    selectedMeasurementId,
    selectedSampleId,
    selectedSetupId,
    updateDeepLink,
  ])

  const realizationMutation = useMutation({
    mutationFn: async (kind: 'sample' | 'setup') => {
      if (kind === 'sample') {
        if (!currentStructureId || !structureDocument.variables || !structureDocument.materialParameters) {
          throw new Error('Ready 상태의 Structure 실현값이 필요합니다.')
        }
        const record = createSampleRecord(
          currentStructureId,
          structureDocument.variables,
          structureDocument.materialParameters,
        )
        const [result] = await dbTables.Sample.upsertRow([record])
        return { id: result.id, kind, record: { ...record, id: result.id, updated_at: new Date().toISOString() } }
      }
      if (!currentExperimentId || !experimentDocument.variables || !experimentDocument.materialParameters) {
        throw new Error('Ready 상태의 Experiment 실현값이 필요합니다.')
      }
      const record = createSetupRecord(
        currentExperimentId,
        experimentDocument.variables,
        experimentDocument.materialParameters,
      )
      const [result] = await dbTables.Setup.upsertRow([record])
      return { id: result.id, kind, record: { ...record, id: result.id, updated_at: new Date().toISOString() } }
    },
    onSuccess: async ({ id, kind, record }) => {
      if (kind === 'sample') {
        queryClient.setQueryData<GetListResponse<SampleRecord>>(
          ['measurements', 'samples', record.structure_id],
          (current) => ({
            total: current ? current.total + (current.items.some((item) => item.id === id) ? 0 : 1) : 1,
            items: [record, ...(current?.items ?? []).filter((item) => item.id !== id)],
          }),
        )
        setSelectedSampleId(id)
        updateDeepLink({ structure: record.structure_id, sample: id, measurement: null })
        await queryClient.invalidateQueries({ queryKey: ['measurements', 'samples', record.structure_id] })
      } else {
        queryClient.setQueryData<GetListResponse<SetupRecord>>(
          ['measurements', 'setups', record.experiment_id],
          (current) => ({
            total: current ? current.total + (current.items.some((item) => item.id === id) ? 0 : 1) : 1,
            items: [record, ...(current?.items ?? []).filter((item) => item.id !== id)],
          }),
        )
        setSelectedSetupId(id)
        updateDeepLink({ experiment: record.experiment_id, setup: id, measurement: null })
        await queryClient.invalidateQueries({ queryKey: ['measurements', 'setups', record.experiment_id] })
      }
      toast.success(`${kind === 'sample' ? 'Sample' : 'Setup'}을 생성했습니다.`)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : '실현값을 저장하지 못했습니다.'),
  })

  useEffect(() => {
    if (!pendingRealization || realizationMutation.isPending) return
    const document = pendingRealization.kind === 'sample' ? structureDocument : experimentDocument
    if (document.status === 'Error') {
      setPendingRealization(null)
      toast.error(`${pendingRealization.kind === 'sample' ? 'Sample' : 'Setup'} 생성 평가에 실패했습니다.`)
      return
    }
    if (
      document.revision < pendingRealization.minimumRevision ||
      document.successfulRevision !== document.revision ||
      document.status !== 'Ready'
    )
      return
    const kind = pendingRealization.kind
    setPendingRealization(null)
    realizationMutation.mutate(kind)
  }, [experimentDocument, pendingRealization, realizationMutation, structureDocument])

  const measurementMutation = useMutation({
    mutationFn: (request: MeasurementSaveRequest) => dbTables.Measurement.save(request),
    onSuccess: async ({ id }, request) => {
      const updatedAt = new Date().toISOString()
      queryClient.setQueryData<GetListResponse<MeasurementRecord>>(
        ['measurements', 'context', currentStructureId, currentExperimentId],
        (current) => ({
          total: current ? current.total + (current.items.some((item) => item.id === id) ? 0 : 1) : 1,
          items: [
            { id, sample_id: request.sample_id, setup_id: request.setup_id, updated_at: updatedAt },
            ...(current?.items ?? []).filter((item) => item.id !== id),
          ],
        }),
      )
      queryClient.setQueryData<GetListResponse<RecordedDataRecord>>(['measurements', 'recorded-data', id], {
        total: request.recorded_data.length,
        items: request.recorded_data.map((item) => ({ ...item, measurement_id: id, updated_at: updatedAt })),
      })
      setSelectedMeasurementId(id)
      updateDeepLink({ measurement: id })
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['measurements', 'context', currentStructureId, currentExperimentId],
        }),
        queryClient.invalidateQueries({ queryKey: ['measurements', 'recorded-data', id] }),
      ])
      toast.success('Measurement와 Recorded Data를 저장했습니다.')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Measurement를 저장하지 못했습니다.'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (kind: 'measurement' | 'sample' | 'setup') => {
      const id = kind === 'sample' ? selectedSampleId : kind === 'setup' ? selectedSetupId : selectedMeasurementId
      if (!id) throw new Error('삭제할 항목이 선택되지 않았습니다.')
      if (kind === 'sample') await dbTables.Sample.deleteRows([id])
      else if (kind === 'setup') await dbTables.Setup.deleteRows([id])
      else await dbTables.Measurement.deleteRows([id])
      return { id, kind }
    },
    onSuccess: async ({ id, kind }) => {
      setDeleteTarget(null)
      setSelectedMeasurementId(null)
      setHideLiveRecordedData(true)
      queryClient.removeQueries({ queryKey: ['measurements', 'recorded-data'] })
      queryClient.setQueriesData<GetListResponse<MeasurementRecord>>(
        { queryKey: ['measurements', 'context'] },
        (current) => {
          if (!current) return current
          const items = current.items.filter((item) =>
            kind === 'sample' ? item.sample_id !== id : kind === 'setup' ? item.setup_id !== id : item.id !== id,
          )
          return { total: items.length, items }
        },
      )

      if (kind === 'sample') {
        queryClient.setQueriesData<GetListResponse<SampleRecord>>(
          { queryKey: ['measurements', 'samples'] },
          (current) => {
            if (!current) return current
            const items = current.items.filter((item) => item.id !== id)
            return { total: items.length, items }
          },
        )
        setSelectedSampleId(null)
        setStructureVars(undefined)
        setStructureMaterialSnapshot(null)
        updateDeepLink({ sample: null, measurement: null })
      } else if (kind === 'setup') {
        queryClient.setQueriesData<GetListResponse<SetupRecord>>(
          { queryKey: ['measurements', 'setups'] },
          (current) => {
            if (!current) return current
            const items = current.items.filter((item) => item.id !== id)
            return { total: items.length, items }
          },
        )
        setSelectedSetupId(null)
        setExperimentVars(undefined)
        setExperimentMaterialSnapshot(null)
        updateDeepLink({ setup: null, measurement: null })
      } else {
        updateDeepLink({ measurement: null })
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['measurements', 'context'] }),
        ...(kind === 'sample'
          ? [queryClient.invalidateQueries({ queryKey: ['measurements', 'samples'] })]
          : kind === 'setup'
            ? [queryClient.invalidateQueries({ queryKey: ['measurements', 'setups'] })]
            : []),
      ])
      toast.success(
        kind === 'sample'
          ? 'Sample과 연결된 Measurement를 삭제했습니다.'
          : kind === 'setup'
            ? 'Setup과 연결된 Measurement를 삭제했습니다.'
            : 'Measurement와 Recorded Data를 삭제했습니다.',
      )
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : '선택 항목을 삭제하지 못했습니다.'),
  })

  useEffect(() => {
    if (!waitingForMeasurement) return
    if (simulation.process.status === 'failed' || simulation.process.status === 'cancelled') {
      setWaitingForMeasurement(false)
      runSelection.current = null
      return
    }
    const selection = runSelection.current
    if (
      simulation.process.status !== 'succeeded' ||
      !simulation.recordedData ||
      simulation.recordedData === runPreviousRecordedData.current ||
      !selection
    )
      return

    const rules = experimentDocument.experimentRules?.recordedData ?? []
    const recordedData = simulation.recordedData
    const request: MeasurementSaveRequest = {
      sample_id: selection.sampleId,
      setup_id: selection.setupId,
      recorded_data: rules.map((rule) => {
        const data = recordedData[rule.label]
        const normalized = normalizeRecordedDataTensor(rule, data)
        return {
          name: rule.label,
          quantity_kind: normalized.quantityKind ?? 'Dimensionless',
          tensor_order: normalized.tensorOrder,
          dtype: normalized.dtype,
          data,
        }
      }),
    }
    setWaitingForMeasurement(false)
    runSelection.current = null
    setHideLiveRecordedData(false)
    measurementMutation.mutate(request)
  }, [
    experimentDocument.experimentRules,
    measurementMutation,
    simulation.process.status,
    simulation.recordedData,
    waitingForMeasurement,
  ])

  const persistedRecordedData = useMemo<RecordedData | null>(() => {
    if (!selectedMeasurementId || !recordedDataQuery.data) return null
    return Object.freeze(
      Object.fromEntries(
        recordedDataQuery.data.items
          .filter((row) => row.data !== null && row.data !== undefined)
          .map((row) => [row.name, row.data]),
      ),
    ) as RecordedData
  }, [recordedDataQuery.data, selectedMeasurementId])
  const displayedRecordedData = selectedMeasurementId
    ? persistedRecordedData
    : hideLiveRecordedData
      ? null
      : simulation.recordedData

  const startRealization = (kind: 'sample' | 'setup') => {
    if (!auth.isAuthenticated) {
      navigate('/login', { state: { from: `${location.pathname}${location.search}` } })
      return
    }
    setSelectedMeasurementId(null)
    updateDeepLink({ measurement: null, [kind]: null })
    const document = kind === 'sample' ? structureDocument : experimentDocument
    if (kind === 'sample') {
      setStructureVars(undefined)
      setStructureMaterialSnapshot(null)
      setSelectedSampleId(null)
    } else {
      setExperimentVars(undefined)
      setExperimentMaterialSnapshot(null)
      setSelectedSetupId(null)
    }
    setPendingRealization({ kind, minimumRevision: document.revision + 1 })
    document.handleReroll()
  }
  const startMeasurement = () => {
    if (!auth.isAuthenticated) {
      navigate('/login', { state: { from: `${location.pathname}${location.search}` } })
      return
    }
    if (!simulation.canRun || !selectedSampleId || !selectedSetupId) return
    setSelectedMeasurementId(null)
    updateDeepLink({ measurement: null })
    runPreviousRecordedData.current = simulation.recordedData
    runSelection.current = { sampleId: selectedSampleId, setupId: selectedSetupId }
    setWaitingForMeasurement(true)
    simulation.run()
  }
  const openManager = (kind: 'experiment' | 'structure', mode: 'code' | 'list') => {
    const id = kind === 'structure' ? currentStructureId : currentExperimentId
    const next = new URLSearchParams()
    if (id) next.set(kind, String(id))
    next.set('mode', mode)
    navigate(`/${kind === 'structure' ? 'structures' : 'experiments'}?${next.toString()}`, {
      state: { measurementReturnTo: `${location.pathname}${location.search}` },
    })
  }

  const structureViewerDocument = useMemo(
    () =>
      structure
        ? {
            scene: structureDocument.scene,
            sceneHash: structureDocument.sceneHash,
            variables: structureDocument.variables,
          }
        : null,
    [structure, structureDocument.scene, structureDocument.sceneHash, structureDocument.variables],
  )
  const experimentViewerDocument = useMemo(
    () =>
      experiment
        ? {
            experimentRules: experimentDocument.experimentRules,
            scene: experimentDocument.scene,
            sceneHash: experimentDocument.sceneHash,
            variables: experimentDocument.variables,
          }
        : null,
    [
      experiment,
      experimentDocument.experimentRules,
      experimentDocument.scene,
      experimentDocument.sceneHash,
      experimentDocument.variables,
    ],
  )
  const handleRenderStart = useCallback(
    (sources: readonly CadDocumentType[]) => {
      if (sources.includes('structure')) structureDocument.handleRenderStart()
      if (sources.includes('experiment')) experimentDocument.handleRenderStart()
    },
    [experimentDocument, structureDocument],
  )
  const handleRenderEnd = useCallback(
    (sources: readonly CadDocumentType[]) => {
      if (sources.includes('structure')) structureDocument.handleRenderEnd()
      if (sources.includes('experiment')) experimentDocument.handleRenderEnd()
    },
    [experimentDocument, structureDocument],
  )
  const handleRenderError = useCallback(
    (message: string, sources: readonly CadDocumentType[]) => {
      if (sources.includes('structure')) structureDocument.handleRenderError(message)
      if (sources.includes('experiment')) experimentDocument.handleRenderError(message)
    },
    [experimentDocument, structureDocument],
  )

  const savingRealizationKind = realizationMutation.isPending ? realizationMutation.variables : null
  const creatingSample = pendingRealization?.kind === 'sample' || savingRealizationKind === 'sample'
  const creatingSetup = pendingRealization?.kind === 'setup' || savingRealizationKind === 'setup'
  const measurementBusy =
    waitingForMeasurement ||
    measurementMutation.isPending ||
    simulation.process.status === 'preparing' ||
    simulation.process.status === 'running'
  const workflowBusy = creatingSample || creatingSetup || measurementBusy
  const deleting = deleteMutation.isPending
  const interactionBusy = workflowBusy || deleting
  const deleteTargetId =
    deleteTarget === 'sample'
      ? selectedSampleId
      : deleteTarget === 'setup'
        ? selectedSetupId
        : deleteTarget === 'measurement'
          ? selectedMeasurementId
          : null

  if (auth.isLoading) {
    return (
      <section
        aria-label="Measurement 워크스페이스"
        className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"
      >
        <LoaderCircle className="animate-spin" />
        로그인 상태를 확인하는 중입니다.
      </section>
    )
  }

  return (
    <section
      aria-label="Measurement 워크스페이스"
      className="grid h-full min-h-0 grid-cols-1 overflow-auto lg:grid-cols-[420px_minmax(0,1fr)] lg:overflow-hidden"
    >
      <aside className="min-h-[520px] space-y-3 overflow-auto border-b bg-muted/20 p-3 lg:min-h-0 lg:border-r lg:border-b-0">
        <Card>
          <CardHeader className="space-y-3 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardDescription className="flex items-center gap-1.5">
                  <Box className="size-3.5" />
                  현재 Structure
                </CardDescription>
                <CardTitle className="mt-1 truncate text-base">{structureRecord?.name ?? '선택되지 않음'}</CardTitle>
              </div>
              <div className="flex gap-1">
                <Button
                  disabled={interactionBusy}
                  size="sm"
                  variant="outline"
                  onClick={() => openManager('structure', 'list')}
                >
                  선택
                </Button>
                <Button
                  aria-label="현재 Structure 편집"
                  disabled={!currentStructureId || interactionBusy}
                  size="icon"
                  variant="outline"
                  onClick={() => openManager('structure', 'code')}
                >
                  <Pencil />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                disabled={!currentStructureId || structureDocument.status !== 'Ready' || interactionBusy}
                size="sm"
                variant="secondary"
                onClick={() => startRealization('sample')}
              >
                {creatingSample ? <LoaderCircle className="animate-spin" /> : <Plus />}Sample 생성
              </Button>
              <Button
                disabled={!auth.isAuthenticated || !selectedSampleId || interactionBusy}
                size="sm"
                variant="destructive"
                onClick={() => setDeleteTarget('sample')}
              >
                <Trash2 />
                선택 Sample 삭제
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 border-t pt-3">
            {!auth.isAuthenticated ? (
              <p className="py-3 text-center text-xs text-muted-foreground">로그인하면 Sample을 저장할 수 있습니다.</p>
            ) : samplesQuery.isLoading ? (
              <p className="py-3 text-center text-xs text-muted-foreground">Sample을 불러오는 중입니다.</p>
            ) : samplesQuery.isError ? (
              <p className="py-3 text-center text-xs text-destructive">Sample 목록을 불러오지 못했습니다.</p>
            ) : samples.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">현재 Structure의 Sample이 없습니다.</p>
            ) : (
              samples.map((sample) => (
                <button
                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                    selectedSampleId === sample.id ? 'border-primary bg-primary/5' : 'bg-background hover:bg-muted'
                  }`}
                  disabled={interactionBusy}
                  key={sample.id}
                  type="button"
                  onClick={() =>
                    void loadSample(sample.id).catch((error: unknown) =>
                      toast.error(error instanceof Error ? error.message : 'Sample을 열지 못했습니다.'),
                    )
                  }
                >
                  <span className="font-medium">Sample #{sample.id}</span>
                  <span className="text-[11px] text-muted-foreground">{formatTimestamp(sample.updated_at)}</span>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardDescription className="flex items-center gap-1.5">
                  <FlaskConical className="size-3.5" />
                  현재 Experiment
                </CardDescription>
                <CardTitle className="mt-1 truncate text-base">{experimentRecord?.name ?? '선택되지 않음'}</CardTitle>
              </div>
              <div className="flex gap-1">
                <Button
                  disabled={interactionBusy}
                  size="sm"
                  variant="outline"
                  onClick={() => openManager('experiment', 'list')}
                >
                  선택
                </Button>
                <Button
                  aria-label="현재 Experiment 편집"
                  disabled={!currentExperimentId || interactionBusy}
                  size="icon"
                  variant="outline"
                  onClick={() => openManager('experiment', 'code')}
                >
                  <Pencil />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                disabled={!currentExperimentId || experimentDocument.status !== 'Ready' || interactionBusy}
                size="sm"
                variant="secondary"
                onClick={() => startRealization('setup')}
              >
                {creatingSetup ? <LoaderCircle className="animate-spin" /> : <Plus />}Setup 생성
              </Button>
              <Button
                disabled={!auth.isAuthenticated || !selectedSetupId || interactionBusy}
                size="sm"
                variant="destructive"
                onClick={() => setDeleteTarget('setup')}
              >
                <Trash2 />
                선택 Setup 삭제
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 border-t pt-3">
            {!auth.isAuthenticated ? (
              <p className="py-3 text-center text-xs text-muted-foreground">로그인하면 Setup을 저장할 수 있습니다.</p>
            ) : setupsQuery.isLoading ? (
              <p className="py-3 text-center text-xs text-muted-foreground">Setup을 불러오는 중입니다.</p>
            ) : setupsQuery.isError ? (
              <p className="py-3 text-center text-xs text-destructive">Setup 목록을 불러오지 못했습니다.</p>
            ) : setups.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">현재 Experiment의 Setup이 없습니다.</p>
            ) : (
              setups.map((setup) => (
                <button
                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                    selectedSetupId === setup.id ? 'border-primary bg-primary/5' : 'bg-background hover:bg-muted'
                  }`}
                  disabled={interactionBusy}
                  key={setup.id}
                  type="button"
                  onClick={() =>
                    void loadSetup(setup.id).catch((error: unknown) =>
                      toast.error(error instanceof Error ? error.message : 'Setup을 열지 못했습니다.'),
                    )
                  }
                >
                  <span className="font-medium">Setup #{setup.id}</span>
                  <span className="text-[11px] text-muted-foreground">{formatTimestamp(setup.updated_at)}</span>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3 pb-3">
            <div>
              <CardDescription className="flex items-center gap-1.5">
                <Activity className="size-3.5" />
                현재 조합
              </CardDescription>
              <CardTitle className="mt-1 text-base">Measurements</CardTitle>
            </div>
            {!auth.isAuthenticated ? (
              <Button
                className="w-full"
                size="sm"
                onClick={() => navigate('/login', { state: { from: `${location.pathname}${location.search}` } })}
              >
                <LogIn />
                로그인
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  disabled={!selectedSampleId || !selectedSetupId || !simulation.canRun || interactionBusy}
                  size="sm"
                  onClick={startMeasurement}
                >
                  {measurementBusy ? <LoaderCircle className="animate-spin" /> : <Play />}Run Measurement
                </Button>
                <Button
                  disabled={!selectedMeasurementId || interactionBusy}
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeleteTarget('measurement')}
                >
                  <Trash2 />
                  선택 Measurement 삭제
                </Button>
              </div>
            )}
            <p className="text-[11px] leading-4 text-muted-foreground">
              {!selectedSampleId || !selectedSetupId
                ? 'Sample과 Setup을 각각 선택하세요.'
                : simulation.compatibility.status === 'incompatible'
                  ? '현재 조합은 Solver 계약과 호환되지 않습니다.'
                  : measurementBusy
                    ? 'Solver 실행 또는 결과 저장 중입니다.'
                    : '선택된 실현값으로 Solver를 실행하고 결과를 저장합니다.'}
            </p>
          </CardHeader>
          <CardContent className="space-y-1 border-t pt-3">
            {!auth.isAuthenticated ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                로그인하면 Measurement 이력을 볼 수 있습니다.
              </p>
            ) : measurementsQuery.isLoading ? (
              <p className="py-3 text-center text-xs text-muted-foreground">Measurement를 불러오는 중입니다.</p>
            ) : measurementsQuery.isError ? (
              <p className="py-3 text-center text-xs text-destructive">Measurement 목록을 불러오지 못했습니다.</p>
            ) : measurements.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">현재 조합의 Measurement가 없습니다.</p>
            ) : (
              measurements.map((measurement) => (
                <button
                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                    selectedMeasurementId === measurement.id
                      ? 'border-primary bg-primary/5'
                      : 'bg-background hover:bg-muted'
                  }`}
                  disabled={interactionBusy}
                  key={measurement.id}
                  type="button"
                  onClick={() =>
                    void loadMeasurement(measurement.id).catch((error: unknown) =>
                      toast.error(error instanceof Error ? error.message : 'Measurement를 열지 못했습니다.'),
                    )
                  }
                >
                  <span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Rows3 className="size-3.5" />
                      Measurement #{measurement.id}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      Sample #{measurement.sample_id} · Setup #{measurement.setup_id}
                    </span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">{formatTimestamp(measurement.updated_at)}</span>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </aside>

      <div className="min-h-[420px] min-w-0 lg:h-full lg:min-h-0">
        <CadViewer
          experiment={experimentViewerDocument}
          recordedData={displayedRecordedData}
          selected={null}
          structure={structureViewerDocument}
          onRenderEnd={handleRenderEnd}
          onRenderError={handleRenderError}
          onRenderStart={handleRenderStart}
        />
      </div>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && !deleteMutation.isPending && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteTarget === 'sample'
                ? 'Sample을 삭제할까요?'
                : deleteTarget === 'setup'
                  ? 'Setup을 삭제할까요?'
                  : 'Measurement를 삭제할까요?'}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget === 'sample'
                ? '이 Sample과 연결된 모든 Measurement 및 Recorded Data도 함께 삭제됩니다.'
                : deleteTarget === 'setup'
                  ? '이 Setup과 연결된 모든 Measurement 및 Recorded Data도 함께 삭제됩니다.'
                  : '이 Measurement의 Recorded Data도 함께 삭제됩니다. Sample과 Setup은 유지됩니다.'}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            <span className="font-medium">
              {deleteTarget === 'sample' ? 'Sample' : deleteTarget === 'setup' ? 'Setup' : 'Measurement'}
            </span>
            <span className="ml-2 text-muted-foreground">#{deleteTargetId}</span>
          </div>
          <DialogFooter>
            <Button disabled={deleteMutation.isPending} variant="outline" onClick={() => setDeleteTarget(null)}>
              취소
            </Button>
            <Button
              disabled={deleteMutation.isPending || !deleteTarget || !deleteTargetId}
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              {deleteMutation.isPending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export const Component = MeasurementPage
