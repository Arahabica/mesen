import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react'
import { X, RotateCcw, Download, Expand } from 'lucide-react'
import { Line, LoupeState, DrawingMode, DeleteZoneState } from '@/types/editor'
import Loupe from './Loupe'
import TemporalTooltip from './TemporalTooltip'
import DeleteZone from './DeleteZone'

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
  // Tooltip states
  const [showResetTooltip, setShowResetTooltip] = useState(false)
  const [showThicknessTooltip, setShowThicknessTooltip] = useState(false)
  const [showUndoTooltip, setShowUndoTooltip] = useState(false)
  const [showDownloadTooltip, setShowDownloadTooltip] = useState(false)
  const [showAiTooltip, setShowAiTooltip] = useState(false)
  const [shownThicknessTooltip, setShownThicknessTooltip] = useState(false)
  const [lastConfirmedLineCenter, setLastConfirmedLineCenter] = useState<{ x: number; y: number } | null>(null)

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
      setShowResetTooltip(true)
    }
  }, [isAtInitialScale])

  // Handle sequential tooltip sequence when line is confirmed
  useEffect(() => {
    if (!shownThicknessTooltip && lines.length > 0) {
      const lastLine = lines[lines.length - 1]
      const lineCenter = {
        x: (lastLine.start.x + lastLine.end.x) / 2,
        y: (lastLine.start.y + lastLine.end.y) / 2
      }
      setLastConfirmedLineCenter(lineCenter)
      setShownThicknessTooltip(true)
      setTimeout(() => {
        setShowThicknessTooltip(true);
      }, 200)
    }
  }, [shownThicknessTooltip, lines])

  const onThicknessTooltipClose = useCallback(() => {
    setShowUndoTooltip(true)
  }, []);

  const onUndoTooltipClose = useCallback(() => {
    setShowDownloadTooltip(true)
  }, []);

  // Show AI tooltip when instruction tooltip is closed
  useEffect(() => {
    if (showAiTooltipTrigger && isImageLoaded) {
      setShowAiTooltip(true)
    }
  }, [showAiTooltipTrigger, isImageLoaded]);

  return (
    <div className="relative w-screen h-dvh overflow-hidden bg-gray-900">
      {drawingMode !== 'moveLine' && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-12 h-12 bg-gray-700 text-gray-300 rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors z-10"
          aria-label="閉じる"
        >
          <X size={24} />
        </button>
      )}

      {drawingMode !== 'moveLine' && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4 z-10">
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
          >
            <RotateCcw size={24} />
          </button>
          <TemporalTooltip
            text="元に戻す"
            show={showUndoTooltip}
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
          >
            <Download size={24} />
          </button>
          <TemporalTooltip
            text="ダウンロード"
            show={showDownloadTooltip}
            duration={1400}
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
          >
            <Expand size={24} />
          </button>
          <TemporalTooltip
            text="元の位置に戻す"
            show={showResetTooltip}
            duration={2500}
            className="bottom-full left-1/2 -translate-x-1/2 mb-2"
          />
        </div>
        </div>
      )}

      {drawingMode !== 'moveLine' && (
        <div className="absolute bottom-4 right-4 z-10">
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
            >
              AI
            </button>
            <TemporalTooltip
              text="AIで自動検出"
              show={showAiTooltip}
              duration={2000}
              onClose={() => setShowAiTooltip(false)}
              className="bottom-full right-0 mb-2"
            />
          </div>
        </div>
      )}

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
        {showThicknessTooltip && (
          isAiDetectionLine ? (
            <TemporalTooltip
              text="タップで太さを変えられます"
              show={showThicknessTooltip}
              duration={1200}
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20"
              onClose={onThicknessTooltipClose}
            />
          ) : (
            lastConfirmedLineCenter && (
              <TemporalTooltip
                text="タップで太さを変えられます"
                show={showThicknessTooltip}
                duration={1200}
                className="z-20"
                onClose={onThicknessTooltipClose}
                targetPosition={{
                  x: lastConfirmedLineCenter.x * scale + position.x,
                  y: lastConfirmedLineCenter.y * scale + position.y
                }}
                preferredPlacement="top"
              />
            )
          )
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
