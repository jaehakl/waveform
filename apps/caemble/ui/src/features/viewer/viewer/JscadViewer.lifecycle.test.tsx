// @vitest-environment jsdom

import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JscadViewer from './JscadViewer'

const rendererMocks = vi.hoisted(() => ({
  entitiesFromSolids: vi.fn((_options: unknown, geometry: unknown) => [{ geometry }]),
  render: vi.fn(),
}))

vi.mock('@jscad/regl-renderer', () => ({
  cameras: {
    perspective: {
      defaults: { position: [10, 10, 10], target: [0, 0, 0], up: [0, 1, 0] },
      setProjection: vi.fn((output: unknown) => output),
      update: vi.fn((output: unknown) => output),
    },
  },
  controls: {
    orbit: {
      defaults: {},
      pan: vi.fn((state: unknown) => state),
      rotate: vi.fn((state: unknown) => state),
      update: vi.fn((state: unknown) => state),
      zoom: vi.fn((state: unknown) => state),
      zoomToFit: vi.fn((state: unknown) => state),
    },
  },
  drawCommands: { drawAxis: {}, drawGrid: {}, drawLines: {}, drawMesh: {} },
  entitiesFromSolids: rendererMocks.entitiesFromSolids,
  prepareRender: vi.fn(() => rendererMocks.render),
}))

class FakeWorker {
  static instances: FakeWorker[] = []
  static constructorError: Error | null = null
  static postMessageError: Error | null = null

  onerror: ((event: ErrorEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent) => void) | null = null
  request: { requestId: string } | null = null
  terminated = false

  constructor() {
    if (FakeWorker.constructorError) throw FakeWorker.constructorError
    FakeWorker.instances.push(this)
  }

  postMessage(request: { requestId: string }) {
    if (FakeWorker.postMessageError) throw FakeWorker.postMessageError
    this.request = request
  }

  terminate() {
    this.terminated = true
  }

  succeed() {
    this.onmessage?.({
      data: {
        requestId: this.request?.requestId,
        result: {
          candidatePointCount: 1,
          colors: new Float32Array([0.1, 0.2, 0.3, 1]),
          effectiveSpacing: 1,
          positions: new Float32Array([0, 0, 0]),
          requestedSpacing: 1,
          visiblePointCount: 1,
        },
        type: 'success',
      },
    } as MessageEvent)
  }

  fail(message: string) {
    this.onerror?.({ message } as ErrorEvent)
  }

  messageError() {
    this.onmessageerror?.({} as MessageEvent)
  }
}

const coloredLayer = {
  documentType: 'structure' as const,
  lengthUnit: 'mm' as const,
  parts: [
    {
      id: 'part',
      geometry: {},
      material: { name: 'Copper', variables: { color: '#a1b2c3' } },
      surfaces: [],
    },
  ],
  sceneHash: 'same-scene',
}
const coloredLayers = [coloredLayer]

function GridHarness() {
  const [status, setStatus] = useState('Ready')
  return (
    <>
      <output aria-label="Render status">{status}</output>
      <JscadViewer
        layers={coloredLayers}
        lengthUnit="mm"
        selected={null}
        onRenderEnd={() => setStatus('Ready')}
        onRenderError={() => setStatus('Error')}
        onRenderStart={() => setStatus('Rendering')}
      />
    </>
  )
}

describe('JscadViewer render lifecycle', () => {
  beforeEach(() => {
    FakeWorker.instances = []
    FakeWorker.constructorError = null
    FakeWorker.postMessageError = null
    rendererMocks.entitiesFromSolids.mockClear()
    rendererMocks.render.mockClear()
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('keeps one grid worker alive across Rendering status rerenders and returns to Ready after drawing points', async () => {
    render(<GridHarness />)

    fireEvent.click(screen.getByRole('tab', { name: 'Material Grid' }))

    await waitFor(() => expect(screen.getByLabelText('Render status')).toHaveTextContent('Rendering'))
    expect(FakeWorker.instances).toHaveLength(1)
    expect(FakeWorker.instances[0].terminated).toBe(false)

    act(() => FakeWorker.instances[0].succeed())

    await waitFor(() => expect(screen.getByLabelText('Render status')).toHaveTextContent('Ready'))
    expect(screen.getByText(/1 points/)).toBeInTheDocument()
    expect(FakeWorker.instances).toHaveLength(1)
  })

  it('ends Rendering when the grid worker cannot be constructed', async () => {
    FakeWorker.constructorError = new Error('Worker unavailable')
    render(<GridHarness />)
    fireEvent.click(screen.getByRole('tab', { name: 'Material Grid' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Worker unavailable'))
    expect(screen.getByLabelText('Render status')).toHaveTextContent('Ready')
  })

  it('ends Rendering when the grid request cannot be posted', async () => {
    FakeWorker.postMessageError = new Error('Clone failed')
    render(<GridHarness />)
    fireEvent.click(screen.getByRole('tab', { name: 'Material Grid' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Clone failed'))
    expect(screen.getByLabelText('Render status')).toHaveTextContent('Ready')
    expect(FakeWorker.instances[FakeWorker.instances.length - 1]?.terminated).toBe(true)
  })

  it('ends Rendering when the grid worker reports an asynchronous error', async () => {
    render(<GridHarness />)
    fireEvent.click(screen.getByRole('tab', { name: 'Material Grid' }))

    act(() => FakeWorker.instances[0].fail('Grid calculation failed'))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Grid calculation failed'))
    expect(screen.getByLabelText('Render status')).toHaveTextContent('Ready')
    expect(FakeWorker.instances[0].terminated).toBe(true)
  })

  it('ends Rendering when the grid worker cannot deserialize its response', async () => {
    render(<GridHarness />)
    fireEvent.click(screen.getByRole('tab', { name: 'Material Grid' }))

    act(() => FakeWorker.instances[0].messageError())

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('could not deserialize'))
    expect(screen.getByLabelText('Render status')).toHaveTextContent('Ready')
    expect(FakeWorker.instances[0].terminated).toBe(true)
  })

  it('ends Rendering and terminates a grid worker after 30 seconds', () => {
    vi.useFakeTimers()
    render(<GridHarness />)
    fireEvent.click(screen.getByRole('tab', { name: 'Material Grid' }))

    expect(screen.getByLabelText('Render status')).toHaveTextContent('Rendering')
    expect(FakeWorker.instances).toHaveLength(1)

    act(() => vi.advanceTimersByTime(30_000))

    expect(screen.getByRole('alert')).toHaveTextContent('timed out after 30 seconds')
    expect(screen.getByLabelText('Render status')).toHaveTextContent('Ready')
    expect(FakeWorker.instances[0].terminated).toBe(true)
  })

  it('invalidates geometry entities when only the resolved Material color changes', async () => {
    const callbacks = {
      onRenderEnd: vi.fn(),
      onRenderError: vi.fn(),
      onRenderStart: vi.fn(),
    }
    const view = render(<JscadViewer layers={[coloredLayer]} lengthUnit="mm" selected={null} {...callbacks} />)
    await waitFor(() => expect(rendererMocks.entitiesFromSolids).toHaveBeenCalledTimes(1))

    view.rerender(
      <JscadViewer
        layers={[
          {
            ...coloredLayer,
            parts: [
              {
                ...coloredLayer.parts[0],
                material: { name: 'Copper', variables: { color: '#d97706' } },
              },
            ],
          },
        ]}
        lengthUnit="mm"
        selected={null}
        {...callbacks}
      />,
    )

    await waitFor(() => expect(rendererMocks.entitiesFromSolids).toHaveBeenCalledTimes(2))
    expect(rendererMocks.entitiesFromSolids.mock.calls[1][0]).toMatchObject({
      color: [217 / 255, 119 / 255, 6 / 255, 1],
    })
  })
})
