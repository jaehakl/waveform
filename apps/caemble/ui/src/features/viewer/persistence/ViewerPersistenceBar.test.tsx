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
  it('keeps every Select controlled while selections are applied and cleared', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const props: ComponentProps<typeof ViewerPersistenceBar> = {
      currentExampleId: 'dc-conductor',
      experiments: [{ id: 102, name: 'Experiment A', description: null, code: 'experiment code' }],
      onExampleChange: vi.fn(),
      onLoadExperiment: vi.fn(),
      onLoadSample: vi.fn(),
      onLoadSetup: vi.fn(),
      onLoadStructure: vi.fn(),
      onSaveExperiment: vi.fn(),
      onSaveSample: vi.fn(),
      onSaveSetup: vi.fn(),
      onSaveStructure: vi.fn(),
      realizationPending: false,
      sampleReady: true,
      sampleUnavailableReason: null,
      samples: [{ id: 201, structure_id: 101, vars: {}, material_parameters: {} }],
      selectedExperimentId: null,
      selectedSampleId: null,
      selectedSetupId: null,
      selectedStructureId: null,
      setupReady: true,
      setupUnavailableReason: null,
      setups: [{ id: 202, experiment_id: 102, vars: {} }],
      structures: [{ id: 101, name: 'Structure A', description: null, code: 'structure code' }],
    }
    const { rerender } = render(<ViewerPersistenceBar {...props} />)

    expect(screen.getByRole('combobox', { name: 'Structure 예제' })).toHaveTextContent('DC Conductor')
    expect(screen.getByRole('combobox', { name: 'Structure' })).toHaveTextContent('Structure 열기')
    expect(screen.getByRole('combobox', { name: 'Sample' })).toHaveTextContent('Sample 열기')
    expect(screen.getByRole('combobox', { name: 'Experiment' })).toHaveTextContent('Experiment 열기')
    expect(screen.getByRole('combobox', { name: 'Setup' })).toHaveTextContent('Setup 열기')

    rerender(
      <ViewerPersistenceBar
        {...props}
        currentExampleId=""
        selectedExperimentId={102}
        selectedSampleId={201}
        selectedSetupId={202}
        selectedStructureId={101}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Structure 예제' })).toHaveTextContent('Custom Structure')
    expect(screen.getByRole('combobox', { name: 'Structure' })).toHaveTextContent('Structure A')
    expect(screen.getByRole('combobox', { name: 'Sample' })).toHaveTextContent('Sample #201')
    expect(screen.getByRole('combobox', { name: 'Experiment' })).toHaveTextContent('Experiment A')
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
