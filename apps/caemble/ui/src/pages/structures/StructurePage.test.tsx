// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserData } from '@/api'
import { cadEntrySource, updateCadEntrySource, type CadSourceDocumentV2 } from '@/lib/cad'
import { defaultCode } from '@/lib/defaultCode'
import { StructurePage } from './StructurePage'

const api = vi.hoisted(() => ({
  deleteStructures: vi.fn(),
  listStructures: vi.fn(),
  saveDefinition: vi.fn(),
  upsertStructures: vi.fn(),
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
      Structure: {
        ...original.dbTables.Structure,
        deleteRows: api.deleteStructures,
        listRows: api.listStructures,
        upsertRow: api.upsertStructures,
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
    structureDocument,
    structureLineage,
  }: {
    structureDocument: { handleSourceChange: (source: string) => void }
    structureLineage?: React.ReactNode
  }) => (
    <div>
      <button type="button" onClick={() => structureDocument.handleSourceChange('changed source')}>
        Source 변경
      </button>
      {structureLineage}
    </div>
  ),
}))

vi.mock('@/features/viewer/viewer/CadViewer', () => ({
  default: ({ structure }: { structure: unknown }) => (
    <div data-testid="structure-viewer">{structure ? 'Structure rendered' : 'No Structure selected'}</div>
  ),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const structures = [
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

function renderPage(initialEntry = '/structures') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter([{ path: '/structures', element: <StructurePage /> }], {
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
  api.listStructures.mockResolvedValue({ items: structures, total: structures.length })
  api.deleteStructures.mockResolvedValue(undefined)
  api.upsertStructures.mockResolvedValue([{ id: 5 }])
  api.saveDefinition.mockResolvedValue({
    id: 10,
    action: 'created',
    parentId: null,
    code: 'owned source',
    kind: 'structure',
  })
  workspace.useCadWorkspace.mockImplementation(
    (
      structure: CadSourceDocumentV2 | null,
      _experiment: null,
      onStructureChange?: (document: CadSourceDocumentV2) => void,
    ) => {
      const structureDocument = {
        handleReroll: workspace.reroll,
        handleSourceChange: (source: string) => {
          if (structure && onStructureChange) onStructureChange(updateCadEntrySource(structure, source))
        },
        handleRenderEnd: vi.fn(),
        handleRenderError: vi.fn(),
        handleRenderStart: vi.fn(),
        scene: structure ? { parts: [] } : null,
        sceneHash: structure ? 'scene-hash' : null,
        selection: null,
        variables: null,
      }
      return {
        experimentDocument: {},
        simulation: { compatibility: { status: 'unavailable', issues: [] } },
        structureDocument,
      }
    },
  )
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('StructurePage', () => {
  it('shows only visible leaves and searches leaf names or descriptions', async () => {
    renderPage()

    expect(await screen.findByText('Owned Grandchild')).toBeInTheDocument()
    expect(screen.getByText('Public Leaf')).toBeInTheDocument()
    expect(screen.getByText('Foreign Leaf')).toBeInTheDocument()
    expect(screen.queryByText('Root')).not.toBeInTheDocument()
    expect(screen.queryByText('Middle')).not.toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox', { name: 'Structure 검색' }), 'BETA')
    expect(screen.getByText('Public Leaf')).toBeInTheDocument()
    expect(screen.queryByText('Owned Grandchild')).not.toBeInTheDocument()
  })

  it('loads a leaf, rerolls it on the second list click, and protects dirty lineage navigation', async () => {
    const router = renderPage()
    await screen.findByText('Owned Grandchild')

    await userEvent.click(screen.getByText('Owned Grandchild'))
    expect(screen.getByTestId('structure-viewer')).toHaveTextContent('Structure rendered')
    expect(router.state.location.search).toBe('?structure=5')
    await userEvent.click(screen.getByText('Owned Grandchild'))
    expect(workspace.reroll).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: '코드 에디터 열기' }))
    expect(screen.getByText('Root')).toBeInTheDocument()
    expect(screen.getByText('Middle')).toBeInTheDocument()
    expect(screen.getByText('Public Leaf')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Source 변경' }))
    await userEvent.click(screen.getByRole('button', { name: /Public Leaf/ }))

    expect(screen.getByRole('heading', { name: '저장되지 않은 변경을 버릴까요?' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?structure=5')
    await userEvent.click(screen.getByRole('button', { name: '변경 버리고 이동' }))
    expect(router.state.location.search).toBe('?structure=3')
  })

  it('starts a default Structure from the list and saves it as a new root', async () => {
    api.saveDefinition.mockResolvedValueOnce({
      id: 10,
      action: 'created',
      parentId: null,
      code: defaultCode,
      kind: 'structure',
    })
    renderPage('/structures?structure=5')
    await screen.findByText('Owned Grandchild')

    await userEvent.click(screen.getByRole('button', { name: '새 Structure 생성' }))

    expect(screen.getByText('저장 전 새 Structure입니다.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Structure 생성' })).toBeInTheDocument()
    const draft = workspace.useCadWorkspace.mock.calls[
      workspace.useCadWorkspace.mock.calls.length - 1
    ]?.[0] as CadSourceDocumentV2
    expect(cadEntrySource(draft)).toBe(defaultCode)

    await userEvent.click(screen.getByRole('button', { name: 'Structure 생성' }))
    const saveDialog = screen.getByRole('dialog')
    expect(within(saveDialog).getByRole('heading', { name: '새 Structure 생성' })).toBeInTheDocument()
    await userEvent.click(within(saveDialog).getByRole('button', { name: 'Structure 생성' }))

    await waitFor(() =>
      expect(api.saveDefinition).toHaveBeenCalledWith(
        expect.objectContaining({ forceRoot: true, savedCode: null, selectedId: null }),
      ),
    )
    const request = api.saveDefinition.mock.calls[api.saveDefinition.mock.calls.length - 1]?.[0]
    expect(cadEntrySource(request.document)).toBe(defaultCode)
    await waitFor(() => expect(screen.getByRole('button', { name: '새 root로 저장' })).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Structure 생성' })).not.toBeInTheDocument()
  })

  it('confirms before replacing an unsaved edit with a new Structure', async () => {
    renderPage('/structures?structure=5')
    await screen.findByText('Owned Grandchild')
    await userEvent.click(screen.getByRole('button', { name: '코드 에디터 열기' }))
    await userEvent.click(screen.getByRole('button', { name: 'Source 변경' }))
    await userEvent.click(screen.getByRole('button', { name: '목록' }))

    await userEvent.click(screen.getByRole('button', { name: '새 Structure 생성' }))

    const confirmDialog = screen.getByRole('dialog')
    expect(within(confirmDialog).getByText(/새 Structure를 시작하면/)).toBeInTheDocument()
    await userEvent.click(within(confirmDialog).getByRole('button', { name: '변경 버리고 이동' }))

    expect(screen.getByText('저장 전 새 Structure입니다.')).toBeInTheDocument()
    const draft = workspace.useCadWorkspace.mock.calls[
      workspace.useCadWorkspace.mock.calls.length - 1
    ]?.[0] as CadSourceDocumentV2
    expect(cadEntrySource(draft)).toBe(defaultCode)
  })

  it('keeps foreign metadata read-only and saves the current code as a new root', async () => {
    renderPage('/structures?structure=4')

    await screen.findByText('Foreign Leaf')
    await waitFor(() =>
      expect(screen.getByRole('row', { name: /Foreign Leaf Structure #4/ })).toHaveAttribute('aria-selected', 'true'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Foreign Leaf 정보 보기' }))
    const infoDialog = await screen.findByRole('dialog')
    expect(within(infoDialog).getByLabelText('이름')).toBeDisabled()
    expect(within(infoDialog).queryByRole('button', { name: '저장' })).not.toBeInTheDocument()
    await userEvent.click(within(infoDialog).getAllByRole('button', { name: '닫기' })[0])

    await userEvent.click(screen.getByRole('button', { name: '코드 에디터 열기' }))
    expect(screen.queryByRole('button', { name: 'Structure 저장' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '새 root로 저장' }))
    const saveDialog = screen.getByRole('dialog')
    await userEvent.click(within(saveDialog).getByRole('button', { name: '새 root로 저장' }))

    await waitFor(() => expect(api.saveDefinition).toHaveBeenCalledWith(expect.objectContaining({ forceRoot: true })))
  })

  it('edits owned metadata and falls back to the parent after deleting the selected node', async () => {
    const router = renderPage('/structures?structure=5')
    await screen.findByText('Owned Grandchild')
    await waitFor(() =>
      expect(screen.getByRole('row', { name: /Owned Grandchild Structure #5/ })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Owned Grandchild 정보 편집' }))
    const infoDialog = await screen.findByRole('dialog')
    await userEvent.clear(within(infoDialog).getByLabelText('이름'))
    await userEvent.type(within(infoDialog).getByLabelText('이름'), 'Renamed leaf')
    await userEvent.click(within(infoDialog).getByRole('button', { name: '저장' }))
    await waitFor(() =>
      expect(api.upsertStructures).toHaveBeenCalledWith([
        expect.objectContaining({ id: 5, name: 'Renamed leaf', code: 'owned source' }),
      ]),
    )

    await userEvent.click(screen.getByRole('button', { name: '코드 에디터 열기' }))
    await userEvent.click(screen.getByRole('button', { name: 'Owned Grandchild 삭제' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(api.deleteStructures).toHaveBeenCalledWith([5]))
    expect(router.state.location.search).toBe('?structure=2')
  })

  it('lets an administrator manage a Structure owned by another user', async () => {
    auth.value = {
      isAuthenticated: true,
      isLoading: false,
      user: { id: 'admin-id', email: 'admin@example.com', is_active: true, roles: ['admin'] },
    }
    renderPage('/structures?structure=4')

    await screen.findByText('Foreign Leaf')
    fireEvent.click(screen.getByRole('button', { name: 'Foreign Leaf 정보 편집' }))
    expect(within(await screen.findByRole('dialog')).getByLabelText('이름')).toBeEnabled()
    await userEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: '닫기' })[0])

    await userEvent.click(screen.getByRole('button', { name: '코드 에디터 열기' }))
    expect(screen.getByRole('button', { name: 'Structure 저장' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Foreign Leaf 삭제' })).toBeInTheDocument()
  })

  it('keeps metadata, Source, and Tree read-only for an anonymous visitor', async () => {
    auth.value = { isAuthenticated: false, isLoading: false, user: null }
    renderPage('/structures?structure=5')

    await screen.findByText('Owned Grandchild')
    expect(screen.queryByRole('button', { name: '새 Structure 생성' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Owned Grandchild 정보 보기' }))
    expect(within(await screen.findByRole('dialog')).getByLabelText('이름')).toBeDisabled()
    await userEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: '닫기' })[0])

    await userEvent.click(screen.getByRole('button', { name: '코드 에디터 열기' }))
    expect(screen.queryByRole('button', { name: 'Structure 저장' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '새 root로 저장' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Owned Grandchild 삭제' })).not.toBeInTheDocument()
    expect(workspace.useCadWorkspace).toHaveBeenLastCalledWith(
      expect.anything(),
      null,
      undefined,
      undefined,
      undefined,
      undefined,
      expect.any(Function),
    )
  })
})
