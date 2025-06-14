'use client'

import React, { useState, useRef, useCallback } from 'react'
import LandingPage from './LandingPage'
import CanvasEditor, { CanvasEditorRef } from './CanvasEditor'
import { useDrawing } from '@/hooks/useDrawing'
import { useZoomPan } from '@/hooks/useZoomPan'
import { useTouch } from '@/hooks/useTouch'
import { ImageSize } from '@/types/editor'
import { LONG_PRESS_DURATION } from '@/constants/editor'

export default function ImageEditor() {
  const [image, setImage] = useState<string | null>(null)
  const [lineThickness] = useState(10)
  const [imageSize, setImageSize] = useState<ImageSize>({ width: 0, height: 0 })
  const [initialMousePos, setInitialMousePos] = useState<{ x: number; y: number } | null>(null)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasEditorRef = useRef<CanvasEditorRef>(null)
  const mouseStartTimeRef = useRef<number>(0)
  const mouseHasMovedRef = useRef<boolean>(false)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const initialTouchRef = useRef<{ x: number; y: number } | null>(null)
  
  const drawing = useDrawing(lineThickness)
  const zoomPan = useZoomPan(imageSize, containerRef)
  const touch = useTouch()

  const handleImageSelect = (selectedImage: string) => {
    setImage(selectedImage)
  }

  const handleImageLoad = (width: number, height: number) => {
    setImageSize({ width, height })
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const { clientX, clientY } = e
    mouseStartTimeRef.current = Date.now()
    setInitialMousePos({ x: clientX, y: clientY })
    mouseHasMovedRef.current = false
    
    const coords = zoomPan.getCanvasCoordinates(clientX, clientY)
    const clickedLineIndex = drawing.findLineAtPoint(coords)
    
    if (clickedLineIndex !== -1) {
      drawing.selectLine(clickedLineIndex, coords)
    } else {
      longPressTimerRef.current = setTimeout(() => {
        if (!mouseHasMovedRef.current) {
          drawing.startDrawing(coords)
        }
      }, LONG_PRESS_DURATION)
      
      // Only start dragging if we're in move mode
      if (drawing.drawingMode === 'move') {
        zoomPan.startDragging(clientX, clientY)
      }
    }
  }, [drawing, zoomPan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    
    if (initialMousePos && !mouseHasMovedRef.current) {
      const distance = Math.sqrt(
        Math.pow(e.clientX - initialMousePos.x, 2) + 
        Math.pow(e.clientY - initialMousePos.y, 2)
      )
      if (distance > 5) {
        mouseHasMovedRef.current = true
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current)
          longPressTimerRef.current = null
        }
      }
    }
    
    if (drawing.isDrawing) {
      const coords = zoomPan.getCanvasCoordinates(e.clientX, e.clientY)
      drawing.draw(coords)
    } else if (drawing.selectedLineIndex !== null) {
      const coords = zoomPan.getCanvasCoordinates(e.clientX, e.clientY)
      drawing.dragLine(coords)
    } else if (zoomPan.isDragging && !drawing.isDrawing && !drawing.isDraggingLine && drawing.drawingMode === 'move') {
      zoomPan.drag(e.clientX, e.clientY)
    }
  }, [drawing, zoomPan, initialMousePos])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    
    if (Date.now() - mouseStartTimeRef.current < LONG_PRESS_DURATION && !drawing.isDrawing && !mouseHasMovedRef.current) {
      const coords = zoomPan.getCanvasCoordinates(e.clientX, e.clientY)
      const clickedLineIndex = drawing.findLineAtPoint(coords)
      
      if (clickedLineIndex !== -1) {
        drawing.changeLineThickness(clickedLineIndex)
      }
    }
    
    drawing.stopDrawing()
    drawing.stopDraggingLine()
    zoomPan.stopDragging()
    setInitialMousePos(null)
    mouseHasMovedRef.current = false
  }, [drawing, zoomPan])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    
    if (e.touches.length !== 1) {
      touch.startTouch(e.touches, () => {})
      return
    }
    
    const touchPoint = e.touches[0]
    const touchCoords = {
      x: touchPoint.clientX,
      y: touchPoint.clientY
    }
    
    // Store initial touch position for dragging
    initialTouchRef.current = touchCoords
    
    const onLongPress = () => {
      const coords = zoomPan.getCanvasCoordinates(touchCoords.x, touchCoords.y)
      drawing.startDrawing(coords)
    }
    
    const onAdjustMode = () => {
      // Use screen coordinates for loupe display
      drawing.startAdjustMode(touchCoords)
    }
    
    const onDrawMode = () => {
      const coords = zoomPan.getCanvasCoordinates(touchCoords.x, touchCoords.y)
      drawing.startDrawMode()
      drawing.startDrawing(coords)
    }
    
    if (e.touches.length === 1) {
      const touchCoords = zoomPan.getCanvasCoordinates(e.touches[0].clientX, e.touches[0].clientY)
      const touchedLineIndex = drawing.findLineAtPoint(touchCoords)
      
      if (touchedLineIndex !== -1) {
        // If touching a line, select it
        drawing.selectLine(touchedLineIndex, touchCoords)
        touch.startTouch(e.touches, onLongPress)
      } else {
        // If not touching a line, start loupe mode or drag
        touch.startTouch(e.touches, onLongPress, onAdjustMode, onDrawMode)
        // Start dragging immediately for smooth panning
        zoomPan.startDragging(e.touches[0].clientX, e.touches[0].clientY)
      }
    } else {
      // Multi-touch for pinch zoom
      touch.startTouch(e.touches, onLongPress)
    }
  }, [touch, drawing, zoomPan])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // e.preventDefault()
    touch.moveTouch(e.touches)
    
    const pinchScale = touch.getPinchScale(e.touches)
    if (pinchScale) {
      const center = touch.getPinchCenter(e.touches)
      if (center) {
        zoomPan.handlePinchZoom(zoomPan.scale * pinchScale, center.x, center.y)
      }
    } else if (e.touches.length === 1 && !touch.isPinching) {
      const touchPos = e.touches[0]
      const coords = zoomPan.getCanvasCoordinates(touchPos.clientX, touchPos.clientY)
      
      // Update loupe position in adjust/draw modes (use screen coordinates)
      if (drawing.drawingMode === 'adjust' || drawing.drawingMode === 'draw') {
        drawing.updateLoupePosition({ x: touchPos.clientX, y: touchPos.clientY })
      }
      
      if (drawing.isDrawing) {
        drawing.draw(coords)
      } else if (drawing.selectedLineIndex !== null && touch.hasMoved) {
        drawing.dragLine(coords)
      } else if (!drawing.isDrawing && !drawing.isDraggingLine) {
        // Allow dragging regardless of mode for smooth panning
        if (drawing.drawingMode === 'move' && zoomPan.isDragging) {
          zoomPan.drag(touchPos.clientX, touchPos.clientY)
        }
      }
    }
  }, [touch, drawing, zoomPan])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    touch.endTouch(e.touches)
    
    if (touch.isQuickTap() && e.changedTouches[0] && !touch.isPinching) {
      const coords = zoomPan.getCanvasCoordinates(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
      const clickedLineIndex = drawing.findLineAtPoint(coords)
      
      if (clickedLineIndex !== -1) {
        drawing.changeLineThickness(clickedLineIndex)
      }
    }
    
    drawing.stopDrawing()
    drawing.stopDraggingLine()
    zoomPan.stopDragging()
    drawing.resetMode()
    initialTouchRef.current = null
  }, [touch, drawing, zoomPan])

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    zoomPan.handleWheel(e.deltaY, e.clientX, e.clientY)
  }, [zoomPan])

  const download = useCallback(() => {
    const canvas = canvasEditorRef.current?.getCanvas()
    if (!canvas || !image) return
    
    const img = new Image()
    img.onload = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      canvas.width = img.width
      canvas.height = img.height
      
      ctx.drawImage(img, 0, 0)
      
      ctx.strokeStyle = 'black'
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      
      drawing.lines.forEach(line => {
        ctx.lineWidth = line.thickness
        ctx.beginPath()
        ctx.moveTo(line.start.x, line.start.y)
        ctx.lineTo(line.end.x, line.end.y)
        ctx.stroke()
      })
      
      canvas.toBlob(blob => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'censored-image.png'
          a.click()
          URL.revokeObjectURL(url)
        }
      })
    }
    img.src = image
  }, [image, drawing.lines])

  const closeImage = useCallback(() => {
    setImage(null)
    drawing.setLines([])
    zoomPan.reset()
    setImageSize({ width: 0, height: 0 })
  }, [drawing, zoomPan])

  React.useEffect(() => {
    const container = containerRef.current
    if (!container || !image) return
    
    container.addEventListener('wheel', handleWheel, { passive: false })
    
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel, image])

  if (!image) {
    return <LandingPage onImageSelect={handleImageSelect} />
  }

  return (
    <div ref={containerRef}>
      <CanvasEditor
        ref={canvasEditorRef}
        image={image}
        lines={drawing.lines}
        currentLine={drawing.currentLine}
        scale={zoomPan.scale}
        position={zoomPan.position}
        lineThickness={lineThickness}
        isDrawing={drawing.isDrawing}
        drawingMode={drawing.drawingMode}
        loupeState={drawing.loupeState}
        getCanvasCoordinates={zoomPan.getCanvasCoordinates}
        onImageLoad={handleImageLoad}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onUndo={drawing.undo}
        onDownload={download}
        onClose={closeImage}
      />
    </div>
  )
}