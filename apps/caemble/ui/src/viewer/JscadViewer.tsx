import { useEffect, useRef } from 'react'
import * as reglRenderer from '@jscad/regl-renderer'

type RendererEntity = Record<string, unknown>
type RendererOptions = Record<string, unknown> & {
  camera?: RendererState
  entities?: RendererEntity[]
}
type RendererState = Record<string, unknown>
type RendererChange = {
  camera: RendererState
  controls: RendererState
}
type ReglRendererApi = {
  cameras: {
    perspective: {
      defaults: RendererState
      setProjection: (output: RendererState, camera: RendererState, input: { height: number; width: number }) => RendererState
      update: (output: RendererState, camera: RendererState) => RendererState
    }
  }
  controls: {
    orbit: {
      defaults: RendererState
      pan: (state: RendererState & { camera: RendererState; controls: RendererState; speed: number }, delta: number[]) => RendererChange
      rotate: (state: RendererState & { camera: RendererState; controls: RendererState; speed: number }, angle: number[]) => RendererChange
      update: (state: { camera: RendererState; controls: RendererState }) => RendererChange
      zoom: (state: RendererState & { camera: RendererState; controls: RendererState; speed: number }, delta: number) => RendererChange
      zoomToFit: (state: { camera: RendererState; controls: RendererState; entities: RendererEntity[] }) => RendererChange
    }
  }
  drawCommands: Record<string, unknown>
  entitiesFromSolids: (options: Record<string, unknown>, ...solids: unknown[]) => RendererEntity[]
  prepareRender: (options: RendererOptions) => (options: RendererOptions) => void
}

type JscadViewerProps = {
  geometry: unknown
  onRenderEnd: () => void
  onRenderError: (message: string) => void
  onRenderStart: () => void
}

const renderer = reglRenderer as unknown as ReglRendererApi

function JscadViewer({ geometry, onRenderEnd, onRenderError, onRenderStart }: JscadViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const cameraRef = useRef<RendererState | null>(null)
  const controlsRef = useRef<RendererState | null>(null)
  const lastPointRef = useRef<{ button: number; x: number; y: number } | null>(null)
  const optionsRef = useRef<RendererOptions | null>(null)
  const renderRef = useRef<((options: RendererOptions) => void) | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const perspectiveCamera = renderer.cameras.perspective
    const orbit = renderer.controls.orbit
    const camera = Object.assign({}, perspectiveCamera.defaults)
    const controls = Object.assign({}, orbit.defaults, {
      autoRotate: { enabled: false, speed: 1 },
      userControl: {
        zoom: true,
        zoomSpeed: 1,
        rotate: true,
        rotateSpeed: 1,
        pan: true,
        panSpeed: 1,
      },
    })

    cameraRef.current = camera
    controlsRef.current = controls

    const options = {
      camera,
      drawCommands: {
        drawAxis: renderer.drawCommands.drawAxis,
        drawGrid: renderer.drawCommands.drawGrid,
        drawLines: renderer.drawCommands.drawLines,
        drawMesh: renderer.drawCommands.drawMesh,
      },
      entities: [],
      glOptions: { canvas },
      rendering: {
        background: [0.98, 0.99, 1, 1],
      },
    }

    optionsRef.current = options
    renderRef.current = renderer.prepareRender(options)

    const renderScene = () => {
      if (!renderRef.current || !optionsRef.current) return
      renderRef.current(optionsRef.current)
    }

    const resize = () => {
      const parent = canvas.parentElement
      const rect = parent?.getBoundingClientRect()
      const width = Math.max(1, Math.floor(rect?.width ?? canvas.clientWidth))
      const height = Math.max(1, Math.floor(rect?.height ?? canvas.clientHeight))
      const ratio = window.devicePixelRatio || 1

      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      perspectiveCamera.setProjection(camera, camera, {
        width: canvas.width,
        height: canvas.height,
      })
      perspectiveCamera.update(camera, camera)
      renderScene()
    }

    const resizeObserver = new ResizeObserver(resize)
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement)
    resize()

    return () => {
      resizeObserver.disconnect()
      renderRef.current = null
      optionsRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!geometry || !optionsRef.current || !renderRef.current || !cameraRef.current || !controlsRef.current) return

    onRenderStart()

    try {
      const solids = Array.isArray(geometry) ? geometry : [geometry]
      const solidsEntities = renderer.entitiesFromSolids(
        { color: [0.18, 0.47, 0.82, 1], smoothNormals: true },
        ...solids,
      )
      const gridEntity = {
        size: [120, 120],
        ticks: [10, 2],
        visuals: {
          drawCmd: 'drawGrid',
          show: true,
        },
      }
      const axisEntity = {
        size: 70,
        visuals: {
          drawCmd: 'drawAxis',
          show: true,
        },
      }

      optionsRef.current.entities = [gridEntity, axisEntity, ...solidsEntities]

      const zoomed = renderer.controls.orbit.zoomToFit({
        camera: cameraRef.current,
        controls: controlsRef.current,
        entities: solidsEntities,
      })
      Object.assign(cameraRef.current, zoomed.camera)
      Object.assign(controlsRef.current, zoomed.controls)

      const updated = renderer.controls.orbit.update({
        camera: cameraRef.current,
        controls: controlsRef.current,
      })
      Object.assign(cameraRef.current, updated.camera)
      Object.assign(controlsRef.current, updated.controls)
      renderer.cameras.perspective.update(cameraRef.current, cameraRef.current)

      renderRef.current(optionsRef.current)
      onRenderEnd()
    } catch (error) {
      const typedError = error as { message?: string }
      onRenderError(typedError.message ?? String(error))
    }
  }, [geometry, onRenderEnd, onRenderError, onRenderStart])

  const renderWithControls = () => {
    if (!cameraRef.current || !controlsRef.current || !optionsRef.current || !renderRef.current) return

    const updated = renderer.controls.orbit.update({
      camera: cameraRef.current,
      controls: controlsRef.current,
    })
    Object.assign(cameraRef.current, updated.camera)
    Object.assign(controlsRef.current, updated.controls)
    renderer.cameras.perspective.update(cameraRef.current, cameraRef.current)
    renderRef.current(optionsRef.current)
  }

  return (
    <div className="relative h-full min-h-[320px] w-full overflow-hidden bg-slate-50">
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-grab active:cursor-grabbing"
        data-viewer-canvas="true"
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          lastPointRef.current = { button: event.button, x: event.clientX, y: event.clientY }
        }}
        onPointerMove={(event) => {
          const lastPoint = lastPointRef.current
          if (!lastPoint || !cameraRef.current || !controlsRef.current) return

          const dx = event.clientX - lastPoint.x
          const dy = event.clientY - lastPoint.y
          const controlChange =
            lastPoint.button === 2
              ? renderer.controls.orbit.pan(
                  { camera: cameraRef.current, controls: controlsRef.current, speed: 0.002 },
                  [dx, dy],
                )
              : renderer.controls.orbit.rotate(
                  { camera: cameraRef.current, controls: controlsRef.current, speed: 0.006 },
                  [dx, dy],
                )

          Object.assign(cameraRef.current, controlChange.camera)
          Object.assign(controlsRef.current, controlChange.controls)
          lastPointRef.current = { ...lastPoint, x: event.clientX, y: event.clientY }
          renderWithControls()
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId)
          lastPointRef.current = null
        }}
        onWheel={(event) => {
          if (!cameraRef.current || !controlsRef.current) return

          event.preventDefault()
          const controlChange = renderer.controls.orbit.zoom(
            { camera: cameraRef.current, controls: controlsRef.current, speed: 0.12 },
            event.deltaY > 0 ? 1 : -1,
          )

          Object.assign(cameraRef.current, controlChange.camera)
          Object.assign(controlsRef.current, controlChange.controls)
          renderWithControls()
        }}
      />

      {!geometry ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-slate-500">
          Waiting for model...
        </div>
      ) : null}
    </div>
  )
}

export default JscadViewer
