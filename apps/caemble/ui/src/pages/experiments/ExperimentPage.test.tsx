// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserData } from '@/api'
import { cadEntrySource, updateCadEntrySource, type CadSourceDocumentV2 } from '@/lib/cad'
import { defaultExperimentCode } from '@/lib/defaultExperimentCode'
import { ExperimentPage } from './ExperimentPage'

const api = vi.hoisted(() => ({
  deleteExperiments: vi.fn(),
  listExperiments: vi.fn(),
  saveDefinition: vi.fn(),
  upsertExperiments: vi.fn(),
}))

const workspace = vi.hoisted(() => ({
  reroll: vi.fn(),
  useCadWorkspace: vi.fn(),
}))

const auth = vi.hoisted(() => ({
  value: {
    isAuthenticated: true,
    isLoading: false,
    user: { id: 'owner-id', email: 'owner@example.com', is_active: true, roles: ['user'] },
  } as { isAuthenticated: boolean; isLoading: boolean; user: UserData | null },
}))

vi.mock('@/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api')>()
  return {
    ...original,
    dbTables: {
      ...original.dbTables,
      Experiment: {
        ...original.dbTables.Experiment,
        deleteRows: api.deleteExperiments,
        listRows: api.listExperiments,
        upsertRow: api.upsertExperiments,
      },
    },
  }
})

vi.mock('@/features/auth/use-auth', () => ({
  useAuth: () => auth.value,
}))

vi.mock('@/features/viewer/persistence/resolveMaterials', () => ({
  resolveDocumentMaterials: vi.fn(),
}))

vi.mock('@/features/viewer/persistence/saveDefinition', () => ({
  saveCadDefinition: api.saveDefinition,
}))

vi.mock('@/features/viewer/workspace/useCadWorkspace', () => ({
  useCadWorkspace: workspace.useCadWorkspace,
}))

vi.mock('@/features/viewer/workspace/StructureExperimentViewer', () => ({
  StructureExperimentViewer: ({
    experimentDocument,
    experimentLineage,
  }: {
    experimentDocument: { handleSourceChange: (source: string) => void }
    experimentLineage?: React.ReactNode
  }) => (
    <div>
      <button type="button" onClick={() => experimentDocument.handleSourceChange('changed source')}>
        Source 변경
      </button>
      {experimentLineage}
    </div>
  ),
}))

vi.mock('@/features/viewer/viewer/CadViewer', () => ({
  default: ({ experiment }: { experiment: unknown }) => (
    <div data-testid="experiment-viewer">{experiment ? 'Experiment rendered' : 'No Experiment selected'}</div>
  ),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const experiments = [
  {
    id: 1,
    parent_id: null,
    name: 'Root',
    description: 'family root',
    code: 'root source',
    user_id: 'owner-id',
    updated_at: '2026-07-01T00:00:00Z',
  },
  {
    id: 2,
    parent_id: 1,
    name: 'Middle',
    description: 'middle node',
    code: 'middle source',
    user_id: 'owner-id',
    updated_at: '2026-07-02T00:00:00Z',
  },
  {
    id: 3,
    parent_id: 1,
    name: 'Public Leaf',
    description: 'searchable beta',
    code: 'public source',
    user_id: null,
    updated_at: '2026-07-03T00:00:00Z',
  },
  {
    id: 4,
    parent_id: null,
    name: 'Foreign Leaf',
    description: 'outside family',
    code: 'foreign source',
    user_id: 'other-id',
    updated_at: '2026-07-04T00:00:00Z',
  },
  {
    id: 5,
    parent_id: 2,
    name: 'Owned Grandchild',
    description: 'alpha leaf',
    code: 'owned source',
    user_id: 'owner-id',
    updated_at: '2026-07-05T00:00:00Z',
  },
]

function renderPage(initialEntry = '/experiments') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter([{ path: '/experiments', element: <ExperimentPage /> }], {
    initialEntries: [initialEntry],
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

beforeEach(() => {
  auth.value = {
    isAuthenticated: true,
    isLoading: false,
    user: { id: 'owner-id', email: 'owner@example.com', is_active: true, roles: ['user'] },
  }
  api.listExperiments.mockResolvedValue({ items: experiments, total: experiments.length })
  api.deleteExperiments.mockResolvedValue(undefined)
  api.upsertExperiments.mockResolvedValue([{ id: 5 }])
  api.saveDefinition.mockResolvedValue({
    id: 10,
    action: 'created',
    parentId: null,
    code: 'owned source',
    kind: 'experiment',
  })
  workspace.useCadWorkspace.mockImplementation(
    (
      _structure: null,
      experiment: CadSourceDocumentV2 | null,
      _onStructureChange: undefined,
      onExperimentChange?: (document: CadSourceDocumentV2) => void,
    ) => {
      const experimentDocument = {
        handleReroll: workspace.reroll,
        handleSourceChange: (source: string) => {
          if (experiment && onExperimentChange) onExperimentChange(updateCadEntrySource(experiment, source))
        },
        handleRenderEnd: vi.fn(),
        handleRenderError: vi.fn(),
        handleRenderStart: vi.fn(),
        scene: experiment ? { parts: [] } : null,
        sceneHash: experiment ? 'scene-hash' : null,
        selection: null,
        variables: null,
      }
      return {
        structureDocument: {},
        simulation: { compatibility: { status: 'unavailable', issues: [] } },
        experimentDocument,
      }
    },
  )
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ExperimentPage', () => {
  it('shows only visible leaves and searches leaf names or descriptions', async () => {
    renderPage()

    expect(await screen.findByText('Owned Grandchild')).toBeInTheDocument()
    expect(screen.getByText('Public Leaf')).toBeInTheDocument()
    expect(screen.getByText('Foreign Leaf')).toBeInTheDocument()
    expect(screen.queryByText('Root')).not.toBeInTheDocument()
    expect(screen.queryByText('Middle')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '코드 에디터 열기' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Public Leaf 코드 에디터 열기' })).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox', { name: 'Experiment 검색' }), 'BETA')
    expect(screen.getByText('Public Leaf')).toBeInTheDocument()
    expect(screen.queryByText('Owned Grandchild')).not.toBeInTheDocument()
  })

  it('loads a leaf, rerolls it on the second list click, and protects dirty lineage navigation', async () => {
    const router = renderPage()
    await screen.findByText('Owned Grandchild')

    await userEvent.click(screen.getByText('Owned Grandchild'))
    await waitFor(() => expect(screen.getByTestId('experiment-viewer')).toHaveTextContent('Experiment rendered'))
    await waitFor(() => expect(router.state.location.search).toBe('?experiment=5'))
    await userEvent.click(screen.getByText('Owned Grandchild'))
    await waitFor(() => expect(workspace.reroll).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByRole('button', { name: 'Owned Grandchild 코드 에디터 열기' }))
    expect(screen.getByText('Root')).toBeInTheDocument()
    expect(screen.getByText('Middle')).toBeInTheDocument()
    expect(screen.getByText('Public Leaf')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Source 변경' }))
    await userEvent.click(screen.getByRole('button', { name: /Public Leaf/ }))

    expect(screen.getByRole('heading', { name: '저장되지 않은 변경을 버릴까요?' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?experiment=5')
    await userEvent.click(screen.getByRole('button', { name: '변경 버리고 이동' }))
    expect(router.state.location.search).toBe('?experiment=3')
  })

  it('opens the double-clicked Experiment in the code editor', async () => {
    const router = renderPage()
    await screen.findByText('Public Leaf')

    await userEvent.dblClick(screen.getByRole('row', { name: /Public Leaf Experiment #3/ }))

    expect(screen.getByRole('button', { name: '목록' })).toBeInTheDocument()
    expect(screen.getAllByText('Public Leaf')).not.toHaveLength(0)
    expect(router.state.location.search).toBe('?experiment=3')
    expect(workspace.reroll).not.toHaveBeenCalled()
  })

  it('confirms dirty navigation before opening a double-clicked Experiment', async () => {
    const router = renderPage('/experiments?experiment=5')
    await screen.findByText('Owned Grandchild')
    await userEvent.click(screen.getByRole('button', { name: 'Owned Grandchild 코드 에디터 열기' }))
    await userEvent.click(screen.getByRole('button', { name: 'Source 변경' }))
    await userEvent.click(screen.getByRole('button', { name: '목록' }))

    await userEvent.dblClick(screen.getByRole('row', { name: /Public Leaf Experiment #3/ }))

    const confirmDialog = screen.getByRole('dialog')
    expect(within(confirmDialog).getByRole('heading', { name: '저장되지 않은 변경을 버릴까요?' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?experiment=5')

    await userEvent.click(within(confirmDialog).getByRole('button', { name: '변경 버리고 이동' }))

    expect(screen.getByRole('button', { name: '목록' })).toBeInTheDocument()
    expect(screen.getAllByText('Public Leaf')).not.toHaveLength(0)
    expect(router.state.location.search).toBe('?experiment=3')
  })

  it('starts a default Experiment from the list and saves it as a new root', async () => {
    api.saveDefinition.mockResolvedValueOnce({
      id: 10,
      action: 'created',
      parentId: null,
      code: defaultExperimentCode,
      kind: 'experiment',
    })
    renderPage('/experiments?experiment=5')
    await screen.findByText('Owned Grandchild')

    await userEvent.click(screen.getByRole('button', { name: '새 Experiment 생성' }))

    expect(screen.getByText('저장 전 새 Experiment입니다.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Experiment 생성' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /정보 (편집|보기)/ })).not.toBeInTheDocument()
    const draft = workspace.useCadWorkspace.mock.calls[
      workspace.useCadWorkspace.mock.calls.length - 1
    ]?.[1] as CadSourceDocumentV2
    expect(cadEntrySource(draft)).toBe(defaultExperimentCode)

    await userEvent.click(screen.getByRole('button', { name: 'Experiment 생성' }))
    const saveDialog = screen.getByRole('dialog')
    expect(within(saveDialog).getByRole('heading', { name: '새 Experiment 생성' })).toBeInTheDocument()
    await userEvent.click(within(saveDialog).getByRole('button', { name: 'Experiment 생성' }))

    await waitFor(() =>
      expect(api.saveDefinition).toHaveBeenCalledWith(
        expect.objectContaining({ forceRoot: true, savedCode: null, selectedId: null }),
      ),
    )
    const request = api.saveDefinition.mock.calls[api.saveDefinition.mock.calls.length - 1]?.[0]
    expect(cadEntrySource(request.document)).toBe(defaultExperimentCode)
    await waitFor(() => expect(screen.getByRole('button', { name: '새 root로 저장' })).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Experiment 생성' })).not.toBeInTheDocument()
  })

  it('confirms before replacing an unsaved edit with a new Experiment', async () => {
    renderPage('/experiments?experiment=5')
    await screen.findByText('Owned Grandchild')
    await userEvent.click(screen.getByRole('button', { name: 'Owned Grandchild 코드 에디터 열기' }))
    await userEvent.click(screen.getByRole('button', { name: 'Source 변경' }))
    await userEvent.click(screen.getByRole('button', { name: '목록' }))

    await userEvent.click(screen.getByRole('button', { name: '새 Experiment 생성' }))

    const confirmDialog = screen.getByRole('dialog')
    expect(within(confirmDialog).getByText(/새 Experiment를 시작하면/)).toBeInTheDocument()
    await userEvent.click(within(confirmDialog).getByRole('button', { name: '변경 버리고 이동' }))

    expect(screen.getByText('저장 전 새 Experiment입니다.')).toBeInTheDocument()
    const draft = workspace.useCadWorkspace.mock.calls[
      workspace.useCadWorkspace.mock.calls.length - 1
    ]?.[1] as CadSourceDocumentV2
    expect(cadEntrySource(draft)).toBe(defaultExperimentCode)
  })

  it('keeps foreign metadata read-only and saves the current code as a new root', async () => {
    renderPage('/experiments?experiment=4')

    await screen.findByText('Foreign Leaf')
    await waitFor(() =>
      expect(screen.getByRole('row', { name: /Foreign Leaf Experiment #4/ })).toHaveAttribute('aria-selected', 'true'),
    )
    expect(screen.getByRole('button', { name: 'Foreign Leaf 정보 보기' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Foreign Leaf 코드 에디터 열기' }))
    fireEvent.click(screen.getByRole('button', { name: 'Foreign Leaf 정보 보기' }))
    const infoDialog = await screen.findByRole('dialog')
    expect(within(infoDialog).getByLabelText('이름')).toBeDisabled()
    expect(within(infoDialog).queryByRole('button', { name: '저장' })).not.toBeInTheDocument()
    await userEvent.click(within(infoDialog).getAllByRole('button', { name: '닫기' })[0])

    expect(screen.queryByRole('button', { name: 'Experiment 저장' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '새 root로 저장' }))
    const saveDialog = screen.getByRole('dialog')
    await userEvent.click(within(saveDialog).getByRole('button', { name: '새 root로 저장' }))

    await waitFor(() => expect(api.saveDefinition).toHaveBeenCalledWith(expect.objectContaining({ forceRoot: true })))
  })

  it('edits owned metadata and falls back to the parent after deleting the selected node', async () => {
    const router = renderPage('/experiments?experiment=5')
    await screen.findByText('Owned Grandchild')
    await waitFor(() =>
      expect(screen.getByRole('row', { name: /Owned Grandchild Experiment #5/ })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )

    expect(screen.getByRole('button', { name: 'Owned Grandchild 정보 편집' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Owned Grandchild 코드 에디터 열기' }))
    fireEvent.click(screen.getByRole('button', { name: 'Owned Grandchild 정보 편집' }))
    const infoDialog = await screen.findByRole('dialog')
    await userEvent.clear(within(infoDialog).getByLabelText('이름'))
    await userEvent.type(within(infoDialog).getByLabelText('이름'), 'Renamed leaf')
    await userEvent.click(within(infoDialog).getByRole('button', { name: '저장' }))
    await waitFor(() =>
      expect(api.upsertExperiments).toHaveBeenCalledWith([
        expect.objectContaining({ id: 5, name: 'Renamed leaf', code: 'owned source' }),
      ]),
    )

    await userEvent.click(screen.getByRole('button', { name: 'Owned Grandchild 삭제' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(api.deleteExperiments).toHaveBeenCalledWith([5]))
    expect(router.state.location.search).toBe('?experiment=2')
  })

  it('lets an administrator manage an Experiment owned by another user', async () => {
    auth.value = {
      isAuthenticated: true,
      isLoading: false,
      user: { id: 'admin-id', email: 'admin@example.com', is_active: true, roles: ['admin'] },
    }
    renderPage('/experiments?experiment=4')

    await screen.findByText('Foreign Leaf')
    fireEvent.click(screen.getByRole('button', { name: 'Foreign Leaf 정보 편집' }))
    expect(within(await screen.findByRole('dialog')).getByLabelText('이름')).toBeEnabled()
    await userEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: '닫기' })[0])

    await userEvent.click(screen.getByRole('button', { name: 'Foreign Leaf 코드 에디터 열기' }))
    expect(screen.getByRole('button', { name: 'Experiment 저장' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Foreign Leaf 삭제' })).toBeInTheDocument()
  })

  it('keeps metadata, Source, and Tree read-only for an anonymous visitor', async () => {
    auth.value = { isAuthenticated: false, isLoading: false, user: null }
    renderPage('/experiments?experiment=5')

    await screen.findByText('Owned Grandchild')
    expect(screen.queryByRole('button', { name: '새 Experiment 생성' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Owned Grandchild 정보 보기' }))
    expect(within(await screen.findByRole('dialog')).getByLabelText('이름')).toBeDisabled()
    await userEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: '닫기' })[0])

    await userEvent.click(screen.getByRole('button', { name: 'Owned Grandchild 코드 에디터 열기' }))
    expect(screen.queryByRole('button', { name: 'Experiment 저장' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '새 root로 저장' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Owned Grandchild 삭제' })).not.toBeInTheDocument()
    expect(workspace.useCadWorkspace).toHaveBeenLastCalledWith(
      null,
      expect.anything(),
      undefined,
      undefined,
      undefined,
      undefined,
      expect.any(Function),
    )
  })
})
