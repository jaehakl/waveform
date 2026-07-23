// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CurrentCadSelectionProvider } from '@/features/viewer/current-cad-selection'
import { MeasurementPage } from './MeasurementPage'

const apiMocks = vi.hoisted(() => ({
  experimentList: vi.fn(),
  measurementContext: vi.fn(),
  measurementDelete: vi.fn(),
  measurementList: vi.fn(),
  measurementSave: vi.fn(),
  recordedDataList: vi.fn(),
  sampleDelete: vi.fn(),
  sampleList: vi.fn(),
  sampleUpsert: vi.fn(),
  setupDelete: vi.fn(),
  setupList: vi.fn(),
  setupUpsert: vi.fn(),
  structureList: vi.fn(),
}))
const cadViewerSpy = vi.hoisted(() => vi.fn())
const toastMocks = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
const workspaceSpy = vi.hoisted(() => vi.fn())

vi.mock('@/features/auth/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { id: 'user-1', roles: ['user'] },
  }),
}))

vi.mock('@/api', () => ({
  getListRequest: (scope = 'visible', selected_ids = []) => ({
    scope,
    offset: 0,
    limit: 24,
    selected_ids,
    search_text: null,
    text_filter: {},
    filter: {},
    sort: ['updated_at', 'desc'],
  }),
  dbTables: {
    Structure: { listRows: apiMocks.structureList },
    Experiment: { listRows: apiMocks.experimentList },
    Sample: { deleteRows: apiMocks.sampleDelete, listRows: apiMocks.sampleList, upsertRow: apiMocks.sampleUpsert },
    Setup: { deleteRows: apiMocks.setupDelete, listRows: apiMocks.setupList, upsertRow: apiMocks.setupUpsert },
    Measurement: {
      deleteRows: apiMocks.measurementDelete,
      listRows: apiMocks.measurementList,
      listContext: apiMocks.measurementContext,
      save: apiMocks.measurementSave,
    },
    RecordedData: { listRows: apiMocks.recordedDataList },
  },
}))

vi.mock('sonner', () => ({ toast: toastMocks }))

vi.mock('@/features/viewer/persistence/resolveMaterials', () => ({
  resolveDocumentMaterials: vi.fn(async () => ({
    materialParameters: { schemaVersion: 1, materials: {} },
    warnings: [],
  })),
}))

const documentController = {
  diagnostics: [],
  draftSelection: null,
  error: null,
  evaluationTimeoutMs: 3000,
  experimentRules: null,
  handleGroupsChange: vi.fn(),
  handleRenderEnd: vi.fn(),
  handleRenderError: vi.fn(),
  handleRenderStart: vi.fn(),
  handleReroll: vi.fn(),
  handleSourceChange: vi.fn(),
  handleSourcePatch: vi.fn(),
  materialParameters: { schemaVersion: 1, materials: {} },
  materialWarnings: [],
  preflightIssues: [],
  readOnly: false,
  revision: 1,
  runIsBusy: false,
  scene: null,
  sceneHash: null,
  selectedId: null,
  selection: null,
  setDraftSelection: vi.fn(),
  setEvaluationTimeoutMs: vi.fn(),
  setSelectedId: vi.fn(),
  solver: null,
  solverSpec: null,
  sourceReadOnly: false,
  status: 'Ready',
  structuredReadOnly: false,
  successfulRevision: 1,
  variables: {},
  varsSchema: null,
}

vi.mock('@/features/viewer/workspace/useCadWorkspace', () => ({
  useCadWorkspace: (...args: unknown[]) => {
    workspaceSpy(...args)
    return {
      structureDocument: { ...documentController, documentType: 'structure' },
      experimentDocument: {
        ...documentController,
        documentType: 'experiment',
        experimentRules: {
          initializations: [],
          boundaryConditions: [],
          recordedData: [
            {
              label: 'Current',
              methodId: 'dc.current',
              target: [],
              parameters: {},
              result: { dtype: 'float64', quantityKind: 'ElectricCurrent', unit: 'A' },
            },
          ],
        },
      },
      simulation: {
        canRun: true,
        cancel: vi.fn(),
        compatibility: { status: 'compatible', issues: [] },
        process: {
          runId: null,
          status: 'idle',
          solver: null,
          error: null,
          startedAt: null,
          finishedAt: null,
        },
        provenance: null,
        recordedData: null,
        run: vi.fn(),
        stale: false,
      },
    }
  },
}))

vi.mock('@/features/viewer/viewer/CadViewer', () => ({
  default: (props: unknown) => {
    cadViewerSpy(props)
    return <div data-testid="cad-viewer" />
  },
}))

function renderPage(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createMemoryRouter(
    [
      { path: '/measurements', Component: MeasurementPage },
      { path: '/structures', element: <div>Structure manager</div> },
      { path: '/experiments', element: <div>Experiment manager</div> },
    ],
    { initialEntries: [initialEntry] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <CurrentCadSelectionProvider>
        <RouterProvider router={router} />
      </CurrentCadSelectionProvider>
    </QueryClientProvider>,
  )
  return router
}

function mockSelectedMeasurement() {
  apiMocks.measurementList.mockResolvedValue({
    total: 1,
    items: [{ id: 30, sample_id: 10, setup_id: 20, updated_at: '2026-07-23T00:00:00Z' }],
  })
  apiMocks.sampleList.mockResolvedValue({
    total: 1,
    items: [{ id: 10, structure_id: 1, vars: { width: 3 }, material_parameters: {} }],
  })
  apiMocks.setupList.mockResolvedValue({
    total: 1,
    items: [{ id: 20, experiment_id: 2, vars: { voltage: 5 }, material_parameters: {} }],
  })
  apiMocks.structureList.mockResolvedValue({
    total: 1,
    items: [{ id: 1, name: 'Copper bar', code: 'export default structure({})' }],
  })
  apiMocks.experimentList.mockResolvedValue({
    total: 1,
    items: [{ id: 2, name: 'DC experiment', code: 'export default experiment({})' }],
  })
  apiMocks.measurementContext.mockResolvedValue({
    total: 1,
    items: [{ id: 30, sample_id: 10, setup_id: 20, updated_at: '2026-07-23T00:00:00Z' }],
  })
  apiMocks.recordedDataList.mockResolvedValue({
    total: 1,
    items: [
      {
        id: 40,
        measurement_id: 30,
        name: 'Current',
        quantity_kind: 'ElectricCurrent',
        tensor_order: 0,
        dtype: 'float64',
        data: { value: 2.5 },
      },
    ],
  })
  apiMocks.sampleDelete.mockResolvedValue(undefined)
  apiMocks.setupDelete.mockResolvedValue(undefined)
  apiMocks.measurementDelete.mockResolvedValue(undefined)
}

function mockMeasurementCombinations() {
  const samples = [
    { id: 10, structure_id: 1, vars: { width: 3 }, material_parameters: {} },
    { id: 11, structure_id: 1, vars: { width: 4 }, material_parameters: {} },
  ]
  const setups = [
    { id: 20, experiment_id: 2, vars: { voltage: 5 }, material_parameters: {} },
    { id: 21, experiment_id: 2, vars: { voltage: 6 }, material_parameters: {} },
    { id: 22, experiment_id: 2, vars: { voltage: 7 }, material_parameters: {} },
  ]
  const measurements = [
    { id: 30, sample_id: 10, setup_id: 20, updated_at: '2026-07-23T00:00:00Z' },
    { id: 31, sample_id: 11, setup_id: 20, updated_at: '2026-07-23T00:01:00Z' },
    { id: 32, sample_id: 11, setup_id: 21, updated_at: '2026-07-23T00:02:00Z' },
  ]
  apiMocks.sampleList.mockImplementation(
    async (request: { selected_ids?: number[] }) => ({
      total: samples.length,
      items: request.selected_ids?.length
        ? samples.filter((sample) => request.selected_ids?.includes(sample.id))
        : samples,
    }),
  )
  apiMocks.setupList.mockImplementation(
    async (request: { selected_ids?: number[] }) => ({
      total: setups.length,
      items: request.selected_ids?.length
        ? setups.filter((setup) => request.selected_ids?.includes(setup.id))
        : setups,
    }),
  )
  apiMocks.measurementList.mockImplementation(
    async (request: { selected_ids?: number[] }) => ({
      total: measurements.length,
      items: request.selected_ids?.length
        ? measurements.filter((measurement) => request.selected_ids?.includes(measurement.id))
        : measurements,
    }),
  )
  apiMocks.structureList.mockResolvedValue({
    total: 1,
    items: [{ id: 1, name: 'Copper bar', code: 'export default structure({})' }],
  })
  apiMocks.experimentList.mockResolvedValue({
    total: 1,
    items: [{ id: 2, name: 'DC experiment', code: 'export default experiment({})' }],
  })
  apiMocks.measurementContext.mockResolvedValue({
    total: measurements.length,
    items: measurements,
  })
  apiMocks.recordedDataList.mockImplementation(
    async (request: { filter?: { measurement_id?: number[] } }) => {
      const measurementId = request.filter?.measurement_id?.[0]
      return {
        total: measurementId ? 1 : 0,
        items: measurementId
          ? [
              {
                id: measurementId + 100,
                measurement_id: measurementId,
                name: 'Current',
                quantity_kind: 'ElectricCurrent',
                tensor_order: 0,
                dtype: 'float64',
                data: { value: measurementId },
              },
            ]
          : [],
      }
    },
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('MeasurementPage', () => {
  it('clears a selected Sample snapshot before rerolling a new random Sample', async () => {
    apiMocks.sampleList.mockResolvedValue({
      total: 1,
      items: [{ id: 10, structure_id: 1, vars: { width: 3 }, material_parameters: { stored: true } }],
    })
    apiMocks.structureList.mockResolvedValue({
      total: 1,
      items: [{ id: 1, name: 'Copper bar', code: 'export default structure({})' }],
    })
    apiMocks.experimentList.mockResolvedValue({ total: 0, items: [] })
    apiMocks.setupList.mockResolvedValue({ total: 0, items: [] })
    apiMocks.measurementContext.mockResolvedValue({ total: 0, items: [] })

    renderPage('/measurements?sample=10')

    expect(await screen.findByText('Sample #10')).toBeInTheDocument()
    expect(workspaceSpy.mock.calls.some((call) => call[4]?.width === 3)).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Sample 생성' }))

    await waitFor(() => {
      expect(workspaceSpy.mock.calls[workspaceSpy.mock.calls.length - 1]?.[4]).toBeUndefined()
    })
    expect(documentController.handleReroll).toHaveBeenCalledOnce()
  })

  it('restores a Measurement through its Sample and Setup and loads persisted Recorded Data', async () => {
    apiMocks.measurementList.mockResolvedValue({
      total: 1,
      items: [{ id: 30, sample_id: 10, setup_id: 20, updated_at: '2026-07-23T00:00:00Z' }],
    })
    apiMocks.sampleList.mockResolvedValue({
      total: 1,
      items: [{ id: 10, structure_id: 1, vars: { width: 3 }, material_parameters: {} }],
    })
    apiMocks.setupList.mockResolvedValue({
      total: 1,
      items: [{ id: 20, experiment_id: 2, vars: { voltage: 5 }, material_parameters: {} }],
    })
    apiMocks.structureList.mockResolvedValue({
      total: 1,
      items: [{ id: 1, name: 'Copper bar', code: 'export default structure({})' }],
    })
    apiMocks.experimentList.mockResolvedValue({
      total: 1,
      items: [{ id: 2, name: 'DC experiment', code: 'export default experiment({})' }],
    })
    apiMocks.measurementContext.mockResolvedValue({
      total: 1,
      items: [{ id: 30, sample_id: 10, setup_id: 20, updated_at: '2026-07-23T00:00:00Z' }],
    })
    apiMocks.recordedDataList.mockResolvedValue({
      total: 1,
      items: [
        {
          id: 40,
          measurement_id: 30,
          name: 'Current',
          quantity_kind: 'ElectricCurrent',
          tensor_order: 0,
          dtype: 'float64',
          data: { value: 2.5 },
        },
      ],
    })

    renderPage('/measurements?measurement=30')

    expect(await screen.findByText('Copper bar')).toBeInTheDocument()
    expect(screen.getByText('DC experiment')).toBeInTheDocument()
    expect(await screen.findByText('Measurement #30')).toBeInTheDocument()
    await waitFor(() =>
      expect(cadViewerSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          recordedData: { Current: { value: 2.5 } },
        }),
      ),
    )
  })

  it('selects the Measurement and Results matching each Sample and Setup combination', async () => {
    mockMeasurementCombinations()
    const router = renderPage('/measurements?sample=10&setup=20')

    await waitFor(() => expect(new URLSearchParams(router.state.location.search).get('measurement')).toBe('30'))
    await waitFor(() =>
      expect(cadViewerSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ recordedData: { Current: { value: 30 } } }),
      ),
    )

    await userEvent.click((await screen.findByText('Sample #11')).closest('button')!)
    await waitFor(() => expect(new URLSearchParams(router.state.location.search).get('measurement')).toBe('31'))
    await waitFor(() =>
      expect(cadViewerSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ recordedData: { Current: { value: 31 } } }),
      ),
    )

    await userEvent.click(screen.getByText('Setup #21').closest('button')!)
    await waitFor(() => expect(new URLSearchParams(router.state.location.search).get('measurement')).toBe('32'))
    await waitFor(() =>
      expect(cadViewerSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ recordedData: { Current: { value: 32 } } }),
      ),
    )

    await userEvent.click(screen.getByText('Setup #22').closest('button')!)
    await waitFor(() => expect(new URLSearchParams(router.state.location.search).get('measurement')).toBeNull())
    await waitFor(() => expect(cadViewerSpy).toHaveBeenLastCalledWith(expect.objectContaining({ recordedData: null })))
  })

  it('deletes the selected Sample with its Measurement and keeps the Setup selected', async () => {
    mockSelectedMeasurement()
    const router = renderPage('/measurements?measurement=30')
    await screen.findByText('Measurement #30')

    await userEvent.click(screen.getByRole('button', { name: '선택 Sample 삭제' }))
    expect(
      screen.getByText('이 Sample과 연결된 모든 Measurement 및 Recorded Data도 함께 삭제됩니다.'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(apiMocks.sampleDelete).toHaveBeenCalledWith([10]))
    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search)
      expect(params.get('sample')).toBeNull()
      expect(params.get('measurement')).toBeNull()
      expect(params.get('setup')).toBe('20')
    })
    expect(screen.getByRole('button', { name: '선택 Sample 삭제' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '선택 Setup 삭제' })).toBeEnabled()
    await waitFor(() => expect(cadViewerSpy).toHaveBeenLastCalledWith(expect.objectContaining({ recordedData: null })))
  })

  it('deletes the selected Setup with its Measurement and keeps the Sample selected', async () => {
    mockSelectedMeasurement()
    const router = renderPage('/measurements?measurement=30')
    await screen.findByText('Measurement #30')

    await userEvent.click(screen.getByRole('button', { name: '선택 Setup 삭제' }))
    expect(
      screen.getByText('이 Setup과 연결된 모든 Measurement 및 Recorded Data도 함께 삭제됩니다.'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(apiMocks.setupDelete).toHaveBeenCalledWith([20]))
    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search)
      expect(params.get('setup')).toBeNull()
      expect(params.get('measurement')).toBeNull()
      expect(params.get('sample')).toBe('10')
    })
    expect(screen.getByRole('button', { name: '선택 Setup 삭제' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '선택 Sample 삭제' })).toBeEnabled()
  })

  it('deletes only the selected Measurement and clears Results', async () => {
    mockSelectedMeasurement()
    apiMocks.measurementDelete.mockImplementation(async () => {
      apiMocks.measurementContext.mockResolvedValue({ total: 0, items: [] })
    })
    const router = renderPage('/measurements?measurement=30')
    await screen.findByText('Measurement #30')

    await userEvent.click(screen.getByRole('button', { name: '선택 Measurement 삭제' }))
    expect(
      screen.getByText('이 Measurement의 Recorded Data도 함께 삭제됩니다. Sample과 Setup은 유지됩니다.'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(apiMocks.measurementDelete).toHaveBeenCalledWith([30]))
    await waitFor(() => expect(new URLSearchParams(router.state.location.search).get('measurement')).toBeNull())
    expect(new URLSearchParams(router.state.location.search).get('sample')).toBe('10')
    expect(new URLSearchParams(router.state.location.search).get('setup')).toBe('20')
    expect(screen.getByRole('button', { name: '선택 Sample 삭제' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '선택 Setup 삭제' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '선택 Measurement 삭제' })).toBeDisabled()
    await waitFor(() => expect(cadViewerSpy).toHaveBeenLastCalledWith(expect.objectContaining({ recordedData: null })))
  })

  it('keeps the delete confirmation open when deletion fails', async () => {
    mockSelectedMeasurement()
    apiMocks.sampleDelete.mockRejectedValue(new Error('delete failed'))
    renderPage('/measurements?measurement=30')
    await screen.findByText('Measurement #30')

    await userEvent.click(screen.getByRole('button', { name: '선택 Sample 삭제' }))
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith('delete failed'))
    expect(screen.getByRole('heading', { name: 'Sample을 삭제할까요?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '삭제' })).toBeEnabled()
  })

  it('opens the Structure code manager with a Measurement return location', async () => {
    apiMocks.structureList.mockResolvedValue({
      total: 1,
      items: [{ id: 1, name: 'Copper bar', code: 'export default structure({})' }],
    })
    apiMocks.experimentList.mockResolvedValue({
      total: 1,
      items: [{ id: 2, name: 'DC experiment', code: 'export default experiment({})' }],
    })
    apiMocks.sampleList.mockResolvedValue({ total: 0, items: [] })
    apiMocks.setupList.mockResolvedValue({ total: 0, items: [] })
    apiMocks.measurementContext.mockResolvedValue({ total: 0, items: [] })
    apiMocks.recordedDataList.mockResolvedValue({ total: 0, items: [] })

    const router = renderPage('/measurements?structure=1&experiment=2')
    await screen.findByText('Copper bar')
    expect(screen.getByRole('button', { name: '선택 Sample 삭제' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '선택 Setup 삭제' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '선택 Measurement 삭제' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '현재 Structure 편집' }))

    expect(router.state.location.pathname).toBe('/structures')
    expect(router.state.location.search).toBe('?structure=1&mode=code')
    expect(router.state.location.state).toEqual({
      measurementReturnTo: '/measurements?structure=1&experiment=2',
    })
  })
})
