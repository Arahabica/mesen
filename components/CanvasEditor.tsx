import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { X, RotateCcw, Download } from 'lucide-react'
import { Line } from '@/types/editor'

interface CanvasEditorProps {
  image: string
  lines: Line[]
  currentLine: Line | null
  scale: number
  position: { x: number; y: number }
  lineThickness: number
  isDrawing: boolean
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
  onImageLoad,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onUndo,
  onDownload,
  onClose
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current
  }))

  useEffect(() => {
    const redrawCanvas = () => {
      const canvas = canvasRef.current
      if (!canvas || !image) return
      
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      const img = new Image()
      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        onImageLoad(img.width, img.height)
        
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        
        ctx.strokeStyle = 'black'
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        
        const allLines = currentLine ? [...lines, currentLine] : lines
        allLines.forEach(line => {
          ctx.lineWidth = line.thickness
          ctx.beginPath()
          ctx.moveTo(line.start.x, line.start.y)
          ctx.lineTo(line.end.x, line.end.y)
          ctx.stroke()
        })
      }
      img.src = image
    }
    
    redrawCanvas()
  }, [image, lines, currentLine, onImageLoad])

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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-900">
      <div className="absolute top-4 left-4 bg-black/50 text-white p-2 rounded z-10 pointer-events-none">
        <div>拡大率: {Math.round(scale * 100)}%</div>
        <div>線の太さ: {lineThickness}px</div>
      </div>
      
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-12 h-12 bg-gray-700 text-gray-300 rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors z-10"
        aria-label="閉じる"
      >
        <X size={24} />
      </button>
      
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4 z-10">
        <button
          onClick={onUndo}
          className="w-12 h-12 bg-gray-700 text-gray-300 rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors"
          aria-label="元に戻す"
        >
          <RotateCcw size={24} />
        </button>
        <button
          onClick={onDownload}
          className="w-12 h-12 bg-gray-700 text-gray-300 rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors"
          aria-label="ダウンロード"
        >
          <Download size={24} />
        </button>
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
            imageRendering: 'auto'
          }}
        />
      </div>
    </div>
  )
})

CanvasEditor.displayName = 'CanvasEditor'

export default CanvasEditor