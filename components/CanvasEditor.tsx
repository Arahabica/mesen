import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { X, RotateCcw, Download, Expand } from 'lucide-react'
import { Line, LoupeState, DrawingMode } from '@/types/editor'
import Loupe from './Loupe'

interface CanvasEditorProps {
  image: string
  lines: Line[]
  currentLine: Line | null
  scale: number
  position: { x: number; y: number }
  lineThickness: number
  isDrawing: boolean
  drawingMode: DrawingMode
  loupeState: LoupeState
  isZoomInitialized: boolean
  isAtInitialScale: boolean
  triggerTooltipSequence: boolean
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
}

export interface CanvasEditorRef {
  getCanvas: () => HTMLCanvasElement | null
}

const CanvasEditor = forwardRef<CanvasEditorRef, CanvasEditorProps>(({
  image,
  lines,
  currentLine,
  scale,
  position,
  lineThickness,
  isDrawing,
  drawingMode,
  loupeState,
  isZoomInitialized,
  isAtInitialScale,
  triggerTooltipSequence,
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
  onResetView
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const baseCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current
  }))

  // State to track if image is loaded
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const [showResetTooltip, setShowResetTooltip] = useState(false)
  const [hasShownTooltip, setHasShownTooltip] = useState(false)
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sequential tooltip states
  const [showThicknessTooltip, setShowThicknessTooltip] = useState(false)
  const [showUndoTooltip, setShowUndoTooltip] = useState(false)
  const [showDownloadTooltip, setShowDownloadTooltip] = useState(false)
  const [hasShownSequentialTooltips, setHasShownSequentialTooltips] = useState(false)
  const [lastConfirmedLineCenter, setLastConfirmedLineCenter] = useState<{ x: number; y: number } | null>(null)
  const sequentialTooltipTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

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
    
    const canvas = canvasRef.current
    const baseCanvas = baseCanvasRef.current
    if (!canvas || !baseCanvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Copy base canvas (image) to main canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(baseCanvas, 0, 0)
    
    // Draw only confirmed lines
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
  }, [lines, isImageLoaded])

  // Handle current line drawing (real-time)
  useEffect(() => {
    if (!currentLine || !isImageLoaded) return
    
    const canvas = canvasRef.current
    const baseCanvas = baseCanvasRef.current
    if (!canvas || !baseCanvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Redraw base + confirmed lines
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(baseCanvas, 0, 0)
    
    ctx.strokeStyle = 'black'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    // Draw confirmed lines
    lines.forEach(line => {
      ctx.lineWidth = line.thickness
      ctx.beginPath()
      ctx.moveTo(line.start.x, line.start.y)
      ctx.lineTo(line.end.x, line.end.y)
      ctx.stroke()
    })
    
    // Draw current line
    ctx.lineWidth = currentLine.thickness
    ctx.beginPath()
    ctx.moveTo(currentLine.start.x, currentLine.start.y)
    ctx.lineTo(currentLine.end.x, currentLine.end.y)
    ctx.stroke()
  }, [currentLine, lines, isImageLoaded])

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
    // Show tooltip when button becomes active for the first time
    if (!isAtInitialScale && !hasShownTooltip) {
      // Clear any existing timers
      if (tooltipTimerRef.current) {
        clearTimeout(tooltipTimerRef.current)
      }
      if (hideTooltipTimerRef.current) {
        clearTimeout(hideTooltipTimerRef.current)
      }

      // Show tooltip after 0.5 seconds
      tooltipTimerRef.current = setTimeout(() => {
        setShowResetTooltip(true)
        setHasShownTooltip(true)

        // Hide tooltip after 3 seconds
        hideTooltipTimerRef.current = setTimeout(() => {
          setShowResetTooltip(false)
        }, 3000)
      }, 500)
    }

    // Cleanup timers on unmount
    return () => {
      if (tooltipTimerRef.current) {
        clearTimeout(tooltipTimerRef.current)
      }
      if (hideTooltipTimerRef.current) {
        clearTimeout(hideTooltipTimerRef.current)
      }
    }
  }, [isAtInitialScale])

  // Handle sequential tooltip sequence when line is confirmed
  useEffect(() => {
    if (triggerTooltipSequence && lines.length > 0 && !hasShownSequentialTooltips) {
      const lastLine = lines[lines.length - 1]
      const lineCenter = {
        x: (lastLine.start.x + lastLine.end.x) / 2,
        y: (lastLine.start.y + lastLine.end.y) / 2
      }
      setLastConfirmedLineCenter(lineCenter)
      setHasShownSequentialTooltips(true)

      // Clear any existing timers
      sequentialTooltipTimersRef.current.forEach(timer => clearTimeout(timer))
      sequentialTooltipTimersRef.current = []

      // Sequence: thickness (200ms delay + 3000ms duration) -> undo (3000ms duration) -> download (3000ms duration)
      
      // 1. Show thickness tooltip after 200ms
      const timer1 = setTimeout(() => {
        setShowThicknessTooltip(true)
        
        // Hide thickness tooltip after 3000ms
        const timer2 = setTimeout(() => {
          setShowThicknessTooltip(false)
          
          // Show undo tooltip immediately after thickness disappears
          const timer3 = setTimeout(() => {
            setShowUndoTooltip(true)
            
            // Hide undo tooltip after 3000ms
            const timer4 = setTimeout(() => {
              setShowUndoTooltip(false)
              
              // Show download tooltip immediately after undo disappears
              const timer5 = setTimeout(() => {
                setShowDownloadTooltip(true)
                
                // Hide download tooltip after 3000ms
                const timer6 = setTimeout(() => {
                  setShowDownloadTooltip(false)
                }, 3000)
                
                sequentialTooltipTimersRef.current.push(timer6)
              }, 0)
              
              sequentialTooltipTimersRef.current.push(timer5)
            }, 3000)
            
            sequentialTooltipTimersRef.current.push(timer4)
          }, 0)
          
          sequentialTooltipTimersRef.current.push(timer3)
        }, 3000)
        
        sequentialTooltipTimersRef.current.push(timer2)
      }, 200)
      
      sequentialTooltipTimersRef.current.push(timer1)
    }

    // Cleanup function
    return () => {
      sequentialTooltipTimersRef.current.forEach(timer => clearTimeout(timer))
      sequentialTooltipTimersRef.current = []
    }
  }, [triggerTooltipSequence, lines])

  return (
    <div className="relative w-screen h-dvh overflow-hidden bg-gray-900">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-12 h-12 bg-gray-700 text-gray-300 rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors z-10"
        aria-label="閉じる"
      >
        <X size={24} />
      </button>
      
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
          <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-sm rounded-md whitespace-nowrap pointer-events-none transition-all duration-700 ease-out ${
            showUndoTooltip ? 'opacity-90 transform translate-y-0 scale-100' : 'opacity-0 transform translate-y-3 scale-95'
          }`}>
            元に戻す
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
              <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-gray-800"></div>
            </div>
          </div>
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
          <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-sm rounded-md whitespace-nowrap pointer-events-none transition-all duration-700 ease-out ${
            showDownloadTooltip ? 'opacity-90 transform translate-y-0 scale-100' : 'opacity-0 transform translate-y-3 scale-95'
          }`}>
            ダウンロード
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
              <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-gray-800"></div>
            </div>
          </div>
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
          <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-sm rounded-md whitespace-nowrap pointer-events-none transition-all duration-700 ease-out ${
            showResetTooltip ? 'opacity-90 transform translate-y-0 scale-100' : 'opacity-0 transform translate-y-3 scale-95'
          }`}>
            元の位置に戻す
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
              <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-gray-800"></div>
            </div>
          </div>
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
        {/* Thickness tooltip on line center */}
        {showThicknessTooltip && lastConfirmedLineCenter && (
          <div 
            className={`absolute px-3 py-1.5 bg-gray-800 text-white text-sm rounded-md whitespace-nowrap pointer-events-none transition-all duration-700 ease-out z-20 ${
              showThicknessTooltip ? 'opacity-90 transform translate-y-0 scale-100' : 'opacity-0 transform translate-y-3 scale-95'
            }`}
            style={{
              left: lastConfirmedLineCenter.x * scale + position.x,
              top: lastConfirmedLineCenter.y * scale + position.y - 40,
              transform: 'translate(-50%, -100%)'
            }}
          >
            タップで太さを変えられます
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
              <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-gray-800"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

CanvasEditor.displayName = 'CanvasEditor'

export default CanvasEditor