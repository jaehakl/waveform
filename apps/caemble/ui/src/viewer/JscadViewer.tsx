import { useEffect, useRef } from 'react'
import * as reglRenderer from '@jscad/regl-renderer'
import type { CadScenePart } from '../cad'

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
  onRenderEnd: () => void
  onRenderError: (message: string) => void
  onRenderStart: () => void
  parts: CadScenePart[]
}

const renderer = reglRenderer as unknown as ReglRendererApi

function colorFromHex(hex: string): [number, number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
    1,
  ]
}

function JscadViewer({ onRenderEnd, onRenderError, onRenderStart, parts }: JscadViewerProps) {
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
    if (parts.length === 0 || !optionsRef.current || !renderRef.current || !cameraRef.current || !controlsRef.current) return

    onRenderStart()

    try {
      const solidsEntities = parts.flatMap((part) =>
        renderer.entitiesFromSolids(
          { color: colorFromHex(part.displayColor), smoothNormals: true },
          part.geometry,
        ),
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
  }, [onRenderEnd, onRenderError, onRenderStart, parts])

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

      {parts.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-slate-500">
          Waiting for model...
        </div>
      ) : null}

      {parts.length > 0 ? (
        <div className="pointer-events-none absolute right-3 top-3 min-w-32 rounded border border-slate-200 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Materials</div>
          {[...new Map(parts.map((part) => [part.materialName, part])).values()].map((part) => (
            <div key={part.materialName} className="flex items-center gap-2 py-0.5 text-xs text-slate-700">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm border border-black/10"
                style={{ backgroundColor: part.displayColor }}
              />
              <span>{part.materialName}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default JscadViewer
