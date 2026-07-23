// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CurrentCadSelectionProvider, useCurrentCadSelection } from '@/features/viewer/current-cad-selection'
import { cadEntrySource } from '@/lib/cad'
import { ViewerPage } from './ViewerPage'

const api = vi.hoisted(() => ({
  listExperiments: vi.fn(),
  listSamples: vi.fn(),
  listSetups: vi.fn(),
  listStructures: vi.fn(),
}))

const workspace = vi.hoisted(() => ({
  useCadWorkspace: vi.fn(),
}))

vi.mock('@/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api')>()
  return {
    ...original,
    dbTables: {
      ...original.dbTables,
      Experiment: { ...original.dbTables.Experiment, listRows: api.listExperiments },
      Sample: { ...original.dbTables.Sample, listRows: api.listSamples },
      Setup: { ...original.dbTables.Setup, listRows: api.listSetups },
      Structure: { ...original.dbTables.Structure, listRows: api.listStructures },
    },
  }
})

vi.mock('@/features/auth/use-auth', () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { id: 'user-id' } }),
}))

vi.mock('@/features/viewer/persistence/SaveDefinitionDialog', () => ({
  SaveDefinitionDialog: () => null,
}))

vi.mock('@/features/viewer/persistence/ViewerPersistenceBar', () => ({
  ViewerPersistenceBar: ({
    currentExperimentName,
    currentStructureName,
    onLoadSample,
    onLoadSetup,
  }: {
    currentExperimentName: string | null
    currentStructureName: string | null
    onLoadSample: (id: number) => void
    onLoadSetup: (id: number) => void
  }) => (
    <div>
      <output aria-label="Viewer 현재 Structure">{currentStructureName ?? '선택 없음'}</output>
      <output aria-label="Viewer 현재 Experiment">{currentExperimentName ?? '선택 없음'}</output>
      <button onClick={() => onLoadSample(201)}>Sample 적용</button>
      <button onClick={() => onLoadSetup(202)}>Setup 적용</button>
    </div>
  ),
}))

vi.mock('@/features/viewer/workspace/StructureExperimentViewer', () => ({
  StructureExperimentViewer: () => null,
}))

vi.mock('@/features/viewer/viewer/CadViewer', () => ({ default: () => null }))

vi.mock('@/features/viewer/workspace/useCadWorkspace', () => ({
  useCadWorkspace: workspace.useCadWorkspace,
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const structures = [
  { id: 101, name: 'Global Structure', description: null, code: 'global structure source' },
  { id: 111, name: 'Linked Structure', description: 'linked', code: 'linked structure source' },
]
const experiments = [
  { id: 102, name: 'Global Experiment', description: null, code: 'global experiment source' },
  { id: 112, name: 'Linked Experiment', description: 'linked', code: 'linked experiment source' },
]
const samples = [{ id: 201, structure_id: 101, vars: { width: 3 }, material_parameters: {} }]
const setups = [{ id: 202, experiment_id: 102, vars: { current: 4 }, material_parameters: {} }]

function selectedItems<T extends { id: number }>(items: readonly T[], request: { selected_ids: number[] }) {
  return request.selected_ids.length === 0 ? items : items.filter((item) => request.selected_ids.includes(item.id))
}

function SelectionHarness({
  initialExperimentId,
  initialStructureId,
}: {
  initialExperimentId?: number
  initialStructureId?: number
}) {
  const { currentExperimentId, currentStructureId, setCurrentExperimentId, setCurrentStructureId } =
    useCurrentCadSelection()
  const [ready, setReady] = useState(initialExperimentId === undefined && initialStructureId === undefined)

  useEffect(() => {
    if (initialExperimentId !== undefined) setCurrentExperimentId(initialExperimentId)
    if (initialStructureId !== undefined) setCurrentStructureId(initialStructureId)
    setReady(true)
  }, [initialExperimentId, initialStructureId, setCurrentExperimentId, setCurrentStructureId])

  return (
    <>
      <output aria-label="전역 Structure">{currentStructureId ?? '없음'}</output>
      <output aria-label="전역 Experiment">{currentExperimentId ?? '없음'}</output>
      {ready ? <ViewerPage /> : null}
    </>
  )
}

function renderPage(
  initialEntry: string,
  selections: { initialExperimentId?: number; initialStructureId?: number } = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter([{ path: '/viewer', element: <SelectionHarness {...selections} /> }], {
    initialEntries: [initialEntry],
  })
  render(
    <QueryClientProvider client={queryClient}>
      <CurrentCadSelectionProvider>
        <RouterProvider router={router} />
      </CurrentCadSelectionProvider>
    </QueryClientProvider>,
  )
  return router
}

beforeEach(() => {
  api.listStructures.mockImplementation(async (request) => ({
    items: selectedItems(structures, request),
    total: structures.length,
  }))
  api.listExperiments.mockImplementation(async (request) => ({
    items: selectedItems(experiments, request),
    total: experiments.length,
  }))
  api.listSamples.mockImplementation(async (request) => ({
    items: selectedItems(samples, request),
    total: samples.length,
  }))
  api.listSetups.mockImplementation(async (request) => ({
    items: selectedItems(setups, request),
    total: setups.length,
  }))
  const document = {
    experimentRules: [],
    handleRenderEnd: vi.fn(),
    handleRenderError: vi.fn(),
    handleRenderStart: vi.fn(),
    materialParameters: {},
    scene: null,
    sceneHash: null,
    selection: null,
    solver: null,
    status: 'Ready',
    variables: {},
  }
  workspace.useCadWorkspace.mockReturnValue({
    experimentDocument: document,
    simulation: {
      canRun: false,
      cancel: vi.fn(),
      compatibility: null,
      process: null,
      recordedData: null,
      run: vi.fn(),
      stale: false,
    },
    structureDocument: document,
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ViewerPage current CAD selection', () => {
  it('loads the global Structure and Experiment when the URL has no explicit selection', async () => {
    const router = renderPage('/viewer', { initialExperimentId: 102, initialStructureId: 101 })

    await waitFor(() => {
      expect(screen.getByLabelText('Viewer 현재 Structure')).toHaveTextContent('Global Structure')
      expect(screen.getByLabelText('Viewer 현재 Experiment')).toHaveTextContent('Global Experiment')
    })
    expect(router.state.location.search).toContain('structure=101')
    expect(router.state.location.search).toContain('experiment=102')
    expect(
      workspace.useCadWorkspace.mock.calls.some(
        ([structure, experiment]) =>
          cadEntrySource(structure) === 'global structure source' &&
          cadEntrySource(experiment) === 'global experiment source',
      ),
    ).toBe(true)
  })

  it('gives explicit Viewer deep links precedence and updates the global selection', async () => {
    renderPage('/viewer?structure=111&experiment=112', {
      initialExperimentId: 102,
      initialStructureId: 101,
    })

    await waitFor(() => {
      expect(screen.getByLabelText('전역 Structure')).toHaveTextContent('111')
      expect(screen.getByLabelText('전역 Experiment')).toHaveTextContent('112')
      expect(screen.getByLabelText('Viewer 현재 Structure')).toHaveTextContent('Linked Structure')
      expect(screen.getByLabelText('Viewer 현재 Experiment')).toHaveTextContent('Linked Experiment')
    })
  })

  it('sets Sample and Setup parents as the global current definitions', async () => {
    renderPage('/viewer')

    screen.getByRole('button', { name: 'Sample 적용' }).click()
    screen.getByRole('button', { name: 'Setup 적용' }).click()

    await waitFor(() => {
      expect(screen.getByLabelText('전역 Structure')).toHaveTextContent('101')
      expect(screen.getByLabelText('전역 Experiment')).toHaveTextContent('102')
      expect(screen.getByLabelText('Viewer 현재 Structure')).toHaveTextContent('Global Structure')
      expect(screen.getByLabelText('Viewer 현재 Experiment')).toHaveTextContent('Global Experiment')
    })
  })
})
