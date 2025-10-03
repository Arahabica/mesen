import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react'
import { X, RotateCcw, Download, Expand } from 'lucide-react'
import { Line, LoupeState, DrawingMode, DeleteZoneState } from '@/types/editor'
import Loupe from './Loupe'
import TemporalTooltip from './TemporalTooltip'
import DeleteZone from './DeleteZone'
import { TooltipStateManager, TooltipType } from '@/utils/tooltipStateManager'

interface CanvasEditorProps {
  image: string
  lines: Line[]
  currentLine: Line | null
  animatingLine: Line | null
  animationProgress: number
  greenLines: Line[]
  colorTransitionProgress: number
  scale: number
  position: { x: number; y: number }
  lineThickness: number
  isDrawing: boolean
  drawingMode: DrawingMode
  loupeState: LoupeState
  deleteZoneState: DeleteZoneState
  isZoomInitialized: boolean
  isAtInitialScale: boolean
  showAiTooltipTrigger: boolean
  isAiDetectionLine: boolean
  getCanvasCoordinates: (screenX: number, screenY: number) => { x: number; y: number }
  onImageLoad: (width: number, height: number) => void
  onMouseDown: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseUp: (e: React.MouseEvent) => void
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
  onUndo: () => void
  onDownload: () => void
  onClose: () => void
  onResetView: () => void
  onDetectFaces: () => void
  isDetectingFaces: boolean
}

export interface CanvasEditorRef {
  getCanvas: () => HTMLCanvasElement | null
}

type ShowTooltipOptions = {
  variant?: 'manual' | 'ai'
  manualLineIndex?: number
  force?: boolean
}

const CanvasEditor = forwardRef<CanvasEditorRef, CanvasEditorProps>(({
  image,
  lines,
  currentLine,
  animatingLine,
  animationProgress,
  greenLines,
  colorTransitionProgress,
  scale,
  position,
  lineThickness,
  isDrawing,
  drawingMode,
  loupeState,
  deleteZoneState,
  isZoomInitialized,
  isAtInitialScale,
  showAiTooltipTrigger,
  isAiDetectionLine,
  getCanvasCoordinates,
  onImageLoad,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onUndo,
  onDownload,
  onClose,
  onResetView,
  onDetectFaces,
  isDetectingFaces
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const baseCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current
  }))

  // State to track if image is loaded
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const tooltipManagerRef = useRef(new TooltipStateManager())
  const pendingTooltipRef = useRef<{ type: TooltipType; options?: ShowTooltipOptions } | null>(null)
  const [shownTooltipType, setShownTooltipType] = useState<TooltipType | null>(null)
  const [thicknessTooltipVariant, setThicknessTooltipVariant] = useState<'manual' | 'ai' | null>(null)
  const [manualTooltipLineIndex, setManualTooltipLineIndex] = useState<number | null>(null)
  const previousLinesCountRef = useRef(lines.length)

  const showTooltip = useCallback(
    (type: TooltipType, options?: ShowTooltipOptions) => {
      const manager = tooltipManagerRef.current
      const force = options?.force ?? false

      if (!force && shownTooltipType !== null && shownTooltipType !== type) {
        pendingTooltipRef.current = { type, options }
        return false
      }

      if (manager.shouldShow(type)) {
        manager.markShown(type)
      } else if (shownTooltipType !== type) {
        return false
      }

      pendingTooltipRef.current = null

      setShownTooltipType(type)

      if (type === 'thickness') {
        setThicknessTooltipVariant(options?.variant ?? null)
        setManualTooltipLineIndex(options?.manualLineIndex ?? null)
      } else {
        setThicknessTooltipVariant(null)
        setManualTooltipLineIndex(null)
      }

      return true
    },
    [shownTooltipType]
  )

  const handleTooltipClose = useCallback(
    (type: TooltipType) => {
      const pending = pendingTooltipRef.current
      setShownTooltipType(prev => (prev === type ? null : prev))

      let sequentialDisplayed = false

      if (type === 'thickness') {
        setThicknessTooltipVariant(null)
        setManualTooltipLineIndex(null)
        sequentialDisplayed = showTooltip('undo', { force: true })
      } else if (type === 'undo') {
        sequentialDisplayed = showTooltip('download', { force: true })
      }

      if (!sequentialDisplayed && pending) {
        pendingTooltipRef.current = null
        const displayed = showTooltip(pending.type, { ...pending.options, force: true })
        if (!displayed) {
          pendingTooltipRef.current = pending
        }
      }
    },
    [showTooltip]
  )

  // Handle image loading and create base canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const baseCanvas = baseCanvasRef.current
    if (!canvas || !baseCanvas || !image) return
    
    setIsImageLoaded(false)
    const img = new Image()
    img.onload = () => {
      // Set up both canvases with same dimensions
      canvas.width = img.width
      canvas.height = img.height
      baseCanvas.width = img.width
      baseCanvas.height = img.height
      onImageLoad(img.width, img.height)
      
      // Draw image to base canvas (once only)
      const baseCtx = baseCanvas.getContext('2d')
      if (baseCtx) {
        baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height)
        baseCtx.drawImage(img, 0, 0)
      }
      
      // Copy base canvas to main canvas
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(baseCanvas, 0, 0)
      }
      
      setIsImageLoaded(true)
    }
    img.src = image
  }, [image, onImageLoad])

  // Handle redraw for confirmed lines only
  useEffect(() => {
    if (!isImageLoaded) return

    // Skip if animating line is present (it will be handled by the other useEffect)
    if (animatingLine || greenLines.length > 0) return

    const canvas = canvasRef.current
    const baseCanvas = baseCanvasRef.current
    if (!canvas || !baseCanvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Copy base canvas (image) to main canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(baseCanvas, 0, 0)

    // Draw only confirmed lines (black)
    ctx.strokeStyle = 'black'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    lines.forEach(line => {
      ctx.lineWidth = line.thickness
      ctx.beginPath()
      ctx.moveTo(line.start.x, line.start.y)
      ctx.lineTo(line.end.x, line.end.y)
      ctx.stroke()
    })
  }, [lines, isImageLoaded, animatingLine, greenLines])

  // Handle current line drawing (real-time), animating line, and green lines
  useEffect(() => {
    if ((!currentLine && !animatingLine && greenLines.length === 0) || !isImageLoaded) return

    const canvas = canvasRef.current
    const baseCanvas = baseCanvasRef.current
    if (!canvas || !baseCanvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Redraw base + confirmed lines
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(baseCanvas, 0, 0)

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Draw confirmed lines (black)
    ctx.strokeStyle = 'black'
    lines.forEach(line => {
      ctx.lineWidth = line.thickness
      ctx.beginPath()
      ctx.moveTo(line.start.x, line.start.y)
      ctx.lineTo(line.end.x, line.end.y)
      ctx.stroke()
    })

    // Draw green lines (completed animation but not yet converted to black)
    // Interpolate color from green to black based on colorTransitionProgress
    if (colorTransitionProgress > 0) {
      // Interpolate RGB from green (0, 255, 0) to black (0, 0, 0)
      const greenValue = Math.round(255 * (1 - colorTransitionProgress))
      ctx.strokeStyle = `rgb(0, ${greenValue}, 0)`

      // Reduce shadow as color transitions to black
      const shadowIntensity = 10 * (1 - colorTransitionProgress)
      ctx.shadowBlur = shadowIntensity
      ctx.shadowColor = `rgb(0, ${greenValue}, 0)`
    } else {
      ctx.strokeStyle = '#00ff00'
      ctx.shadowBlur = 10
      ctx.shadowColor = '#00ff00'
    }

    greenLines.forEach(line => {
      ctx.lineWidth = line.thickness
      ctx.beginPath()
      ctx.moveTo(line.start.x, line.start.y)
      ctx.lineTo(line.end.x, line.end.y)
      ctx.stroke()
    })
    ctx.shadowBlur = 0

    // Draw animating line (green, growing from start to end using dash offset)
    if (animatingLine && animationProgress > 0) {
      const { start, end, thickness } = animatingLine

      // Calculate line length
      const dx = end.x - start.x
      const dy = end.y - start.y
      const lineLength = Math.sqrt(dx * dx + dy * dy)

      // Use dash array to create growing effect
      const dashLength = lineLength * animationProgress
      const gapLength = lineLength

      ctx.strokeStyle = '#00ff00'
      ctx.lineWidth = thickness
      ctx.shadowBlur = 10
      ctx.shadowColor = '#00ff00'
      ctx.setLineDash([dashLength, gapLength])
      ctx.lineDashOffset = 0
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.stroke()

      // Reset dash settings
      ctx.setLineDash([])
      ctx.shadowBlur = 0
    }

    // Draw current line (black)
    if (currentLine) {
      ctx.strokeStyle = 'black'
      ctx.lineWidth = currentLine.thickness
      ctx.beginPath()
      ctx.moveTo(currentLine.start.x, currentLine.start.y)
      ctx.lineTo(currentLine.end.x, currentLine.end.y)
      ctx.stroke()
    }
  }, [currentLine, animatingLine, animationProgress, greenLines, colorTransitionProgress, lines, isImageLoaded])

  // Vibration feedback for mode transitions
  useEffect(() => {
    if (drawingMode === 'draw') {
      // Vibration for draw mode
      if ('vibrate' in navigator) {
        navigator.vibrate(30)
      }
    }
  }, [drawingMode])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault()
      // Wheel handling is done in parent component
    }
    
    container.addEventListener('wheel', handleWheelEvent, { passive: false })
    
    return () => {
      container.removeEventListener('wheel', handleWheelEvent)
    }
  }, [])

  // Handle tooltip display logic
  useEffect(() => {
    if (!isAtInitialScale) {
      showTooltip('reset')
    }
  }, [isAtInitialScale, showTooltip])

  // Handle sequential tooltip sequence when line is confirmed
  useEffect(() => {
    const previousCount = previousLinesCountRef.current

    if (lines.length > previousCount) {
      const newIndex = lines.length - 1

      if (isAiDetectionLine) {
        showTooltip('thickness', { variant: 'ai' })
      } else if (newIndex >= 0) {
        const displayed = showTooltip('thickness', {
          variant: 'manual',
          manualLineIndex: newIndex
        })

        if (!displayed && shownTooltipType === 'thickness' && thicknessTooltipVariant === 'manual') {
          setManualTooltipLineIndex(newIndex)
        }
      }
    }

    if (
      shownTooltipType === 'thickness' &&
      thicknessTooltipVariant === 'manual' &&
      manualTooltipLineIndex !== null &&
      (manualTooltipLineIndex < 0 || manualTooltipLineIndex >= lines.length)
    ) {
      setManualTooltipLineIndex(null)
    }

    previousLinesCountRef.current = lines.length
  }, [
    lines,
    isAiDetectionLine,
    manualTooltipLineIndex,
    thicknessTooltipVariant,
    showTooltip,
    shownTooltipType
  ])

  const onThicknessTooltipClose = useCallback(() => {
    handleTooltipClose('thickness')
  }, [handleTooltipClose])

  const onUndoTooltipClose = useCallback(() => {
    handleTooltipClose('undo')
  }, [handleTooltipClose])

  const onDownloadTooltipClose = useCallback(() => {
    handleTooltipClose('download')
  }, [handleTooltipClose])

  const onResetTooltipClose = useCallback(() => {
    handleTooltipClose('reset')
  }, [handleTooltipClose])

  const onAiTooltipClose = useCallback(() => {
    handleTooltipClose('ai')
  }, [handleTooltipClose])

  // Show AI tooltip when instruction tooltip is closed
  useEffect(() => {
    if (showAiTooltipTrigger && isImageLoaded) {
      showTooltip('ai')
    }
  }, [showAiTooltipTrigger, isImageLoaded, showTooltip])

  let manualThicknessTooltipPosition: { x: number; y: number } | null = null
  if (manualTooltipLineIndex !== null) {
    const targetLine = lines[manualTooltipLineIndex]
    if (targetLine) {
      manualThicknessTooltipPosition = {
        x: ((targetLine.start.x + targetLine.end.x) / 2) * scale + position.x,
        y: ((targetLine.start.y + targetLine.end.y) / 2) * scale + position.y
      }
    }
  }

  const isMoveLineMode = drawingMode === 'moveLine'

  return (
    <div className="relative w-screen h-dvh overflow-hidden bg-gray-900">
      <button
        onClick={onClose}
        className={`absolute top-4 right-4 w-12 h-12 bg-gray-700 text-gray-300 rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors z-10 transition-opacity duration-200 ${
          isMoveLineMode ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        aria-label="閉じる"
        aria-hidden={isMoveLineMode}
        tabIndex={isMoveLineMode ? -1 : undefined}
      >
        <X size={24} />
      </button>

      <div
        className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4 z-10 transition-opacity duration-200 ${
          isMoveLineMode ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        aria-hidden={isMoveLineMode}
      >
        <div className="relative">
          <button
            onClick={onUndo}
            disabled={lines.length === 0}
            className={`w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 text-gray-300 transition-all ${
              lines.length === 0 
                ? 'opacity-40 cursor-not-allowed' 
                : 'opacity-100 hover:bg-gray-600'
            }`}
            aria-label="元に戻す"
            tabIndex={isMoveLineMode ? -1 : undefined}
          >
            <RotateCcw size={24} />
          </button>
          <TemporalTooltip
            text="元に戻す"
            show={shownTooltipType === 'undo'}
            duration={1400}
            onClose={onUndoTooltipClose}
            className="bottom-full left-1/2 -translate-x-1/2 mb-2"
          />
        </div>
        <div className="relative">
          <button
            onClick={onDownload}
            disabled={lines.length === 0}
            className={`w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 text-gray-300 transition-all ${
              lines.length === 0 
                ? 'opacity-40 cursor-not-allowed' 
                : 'opacity-100 hover:bg-gray-600'
            }`}
            aria-label="ダウンロード"
            tabIndex={isMoveLineMode ? -1 : undefined}
          >
            <Download size={24} />
          </button>
          <TemporalTooltip
            text="ダウンロード"
            show={shownTooltipType === 'download'}
            duration={1400}
            onClose={onDownloadTooltipClose}
            className="bottom-full left-1/2 -translate-x-1/2 mb-2"
          />
        </div>
        <div className="relative">
          <button
            onClick={onResetView}
            disabled={isAtInitialScale}
            className={`w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 text-gray-300 transition-all ${
              isAtInitialScale 
                ? 'opacity-40 cursor-not-allowed' 
                : 'opacity-100 hover:bg-gray-600'
            }`}
            aria-label="元の位置に戻す"
            tabIndex={isMoveLineMode ? -1 : undefined}
          >
            <Expand size={24} />
          </button>
          <TemporalTooltip
            text="元の位置に戻す"
            show={shownTooltipType === 'reset'}
            duration={2500}
            onClose={onResetTooltipClose}
            className="bottom-full left-1/2 -translate-x-1/2 mb-2"
          />
        </div>
      </div>

      <div
        className={`absolute bottom-4 right-4 z-10 transition-opacity duration-200 ${
          isMoveLineMode ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        aria-hidden={isMoveLineMode}
      >
        <div className="relative">
          <button
            onClick={onDetectFaces}
            disabled={isDetectingFaces || !isImageLoaded}
            className={`w-9 h-9 rounded-full flex items-center justify-center bg-gray-700 text-gray-300 transition-all text-base gothic-font ${
              isDetectingFaces || !isImageLoaded
                ? 'opacity-40 cursor-not-allowed'
                : 'hover:bg-gray-600'
            } ${isDetectingFaces ? 'animate-pulse' : ''}`}
            aria-label="AIで顔を検出"
            tabIndex={isMoveLineMode ? -1 : undefined}
          >
            AI
          </button>
          <TemporalTooltip
            text="AIで自動検出"
            show={shownTooltipType === 'ai'}
            duration={2000}
            onClose={onAiTooltipClose}
            className="bottom-full right-0 mb-2"
          />
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full h-dvh"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          className="absolute"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'top left',
            cursor: isDrawing ? 'crosshair' : 'move',
            imageRendering: 'auto',
            opacity: isImageLoaded && isZoomInitialized ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out'
          }}
        />
        {/* Hidden base canvas for image caching */}
        <canvas
          ref={baseCanvasRef}
          className="absolute"
          style={{ display: 'none' }}
        />
        {loupeState.visible && (
          <Loupe
            visible={loupeState.visible}
            position={loupeState.position}
            mode={loupeState.mode}
            isStationary={loupeState.isStationary}
            sourceCanvas={canvasRef.current}
            lineThickness={lineThickness}
            scale={scale}
            imagePosition={position}
            getCanvasCoordinates={getCanvasCoordinates}
            relativePosition={loupeState.relativePosition}
          />
        )}
        {/* Thickness tooltip on line center or screen center for AI detection */}
        {shownTooltipType === 'thickness' && thicknessTooltipVariant === 'ai' && (
          <TemporalTooltip
            text="タップで太さを変えられます"
            show={shownTooltipType === 'thickness'}
            duration={1200}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20"
            onClose={onThicknessTooltipClose}
          />
        )}
        {shownTooltipType === 'thickness' && thicknessTooltipVariant === 'manual' && manualThicknessTooltipPosition && (
          <TemporalTooltip
            text="タップで太さを変えられます"
            show={shownTooltipType === 'thickness'}
            duration={1200}
            className="z-20"
            onClose={onThicknessTooltipClose}
            targetPosition={manualThicknessTooltipPosition}
            preferredPlacement="top"
          />
        )}
      </div>
      <DeleteZone
        visible={deleteZoneState.visible}
        position={deleteZoneState.position}
        isNearby={deleteZoneState.isNearby}
      />
    </div>
  )
})

CanvasEditor.displayName = 'CanvasEditor'

export default CanvasEditor;
