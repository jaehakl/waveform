// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ViewerPersistenceBar } from './ViewerPersistenceBar'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ViewerPersistenceBar', () => {
  it('shows current definitions without selectors and keeps the remaining Selects controlled', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const props: ComponentProps<typeof ViewerPersistenceBar> = {
      currentExampleId: 'dc-conductor',
      currentExperimentName: null,
      currentStructureName: null,
      onExampleChange: vi.fn(),
      onLoadSample: vi.fn(),
      onLoadSetup: vi.fn(),
      onSaveExperiment: vi.fn(),
      onSaveSample: vi.fn(),
      onSaveSetup: vi.fn(),
      onSaveStructure: vi.fn(),
      realizationPending: false,
      sampleReady: true,
      sampleUnavailableReason: null,
      samples: [{ id: 201, structure_id: 101, vars: {}, material_parameters: {} }],
      selectedSampleId: null,
      selectedSetupId: null,
      setupReady: true,
      setupUnavailableReason: null,
      setups: [{ id: 202, experiment_id: 102, vars: {}, material_parameters: {} }],
    }
    const { rerender } = render(<ViewerPersistenceBar {...props} />)

    expect(screen.getByRole('combobox', { name: 'Structure 예제' })).toHaveTextContent('DC Conductor')
    expect(screen.queryByRole('combobox', { name: 'Structure' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('현재 Structure 이름')).toHaveTextContent('선택 없음')
    expect(screen.getByRole('combobox', { name: 'Sample' })).toHaveTextContent('Sample 열기')
    expect(screen.queryByRole('combobox', { name: 'Experiment' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('현재 Experiment 이름')).toHaveTextContent('선택 없음')
    expect(screen.getByRole('combobox', { name: 'Setup' })).toHaveTextContent('Setup 열기')

    rerender(
      <ViewerPersistenceBar
        {...props}
        currentExampleId=""
        currentExperimentName="Experiment A"
        currentStructureName="Structure A"
        selectedSampleId={201}
        selectedSetupId={202}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Structure 예제' })).toHaveTextContent('Custom Structure')
    expect(screen.getByLabelText('현재 Structure 이름')).toHaveTextContent('Structure A')
    expect(screen.getByRole('combobox', { name: 'Sample' })).toHaveTextContent('Sample #201')
    expect(screen.getByLabelText('현재 Experiment 이름')).toHaveTextContent('Experiment A')
    expect(screen.getByRole('combobox', { name: 'Setup' })).toHaveTextContent('Setup #202')

    rerender(<ViewerPersistenceBar {...props} />)
    await waitFor(() => {
      const messages = [...warn.mock.calls, ...error.mock.calls].flat().map(String)
      expect(
        messages.filter((message) =>
          /changing from (?:uncontrolled to controlled|controlled to uncontrolled)/i.test(message),
        ),
      ).toEqual([])
    })
  })
})
