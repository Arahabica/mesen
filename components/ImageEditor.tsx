'use client'

import React, { useState, useRef, useCallback } from 'react'
import LandingPage from './LandingPage'
import CanvasEditor, { CanvasEditorRef } from './CanvasEditor'
import { useDrawing } from '@/hooks/useDrawing'
import { useZoomPan } from '@/hooks/useZoomPan'
import { useTouch } from '@/hooks/useTouch'
import { ImageSize } from '@/types/editor'
import { LONG_PRESS_DURATION, getDynamicThickness, getDefaultThickness, AUTO_THICKNESS_SCREEN_RATIO } from '@/constants/editor'

export default function ImageEditor() {
  const [image, setImage] = useState<string | null>(null)
  const [lineThickness, setLineThickness] = useState(10)
  const [imageSize, setImageSize] = useState<ImageSize>({ width: 0, height: 0 })
  const [initialMousePos, setInitialMousePos] = useState<{ x: number; y: number } | null>(null)
  const [showLanding, setShowLanding] = useState(true)
  const [canvasOpacity, setCanvasOpacity] = useState(0)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasEditorRef = useRef<CanvasEditorRef>(null)
  const mouseStartTimeRef = useRef<number>(0)
  const mouseHasMovedRef = useRef<boolean>(false)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const initialTouchRef = useRef<{ x: number; y: number } | null>(null)
  
  const drawing = useDrawing(lineThickness, imageSize.width, imageSize.height)
  
  const zoomPan = useZoomPan(imageSize, containerRef)
  const touch = useTouch()

  const handleImageSelect = (selectedImage: string) => {
    setImage(selectedImage)
    // Start fade-in animation
    requestAnimationFrame(() => {
      setCanvasOpacity(1)
    })
    // Remove landing page after animation
    setTimeout(() => {
      setShowLanding(false)
    }, 200)
  }

  // Calculate dynamic thickness based on current viewport and zoom
  const calculateDynamicThickness = useCallback(() => {
    if (imageSize.width === 0) return lineThickness
    
    const container = containerRef.current
    if (!container) return lineThickness
    
    const screenWidth = container.clientWidth
    const targetScreenThickness = screenWidth * AUTO_THICKNESS_SCREEN_RATIO
    // Convert screen thickness to image coordinates (smaller when zoomed in)
    const targetImageThickness = targetScreenThickness / zoomPan.scale
    return getDynamicThickness(imageSize.width, imageSize.height, targetImageThickness)
  }, [imageSize.width, imageSize.height, zoomPan.scale, lineThickness])

  const handleImageLoad = useCallback((width: number, height: number) => {
    setImageSize({ width, height })
    // Set default thickness based on image dimensions
    const defaultThickness = getDefaultThickness(width, height)
    setLineThickness(defaultThickness)
  }, [])

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
          // Calculate dynamic thickness based on current viewport
          const dynamicThickness = calculateDynamicThickness()
          setLineThickness(dynamicThickness)
          drawing.startDrawing(coords, dynamicThickness)
        }
      }, LONG_PRESS_DURATION)
      
      // Only start dragging if we're in move mode
      if (drawing.drawingMode === 'move') {
        zoomPan.startDragging(clientX, clientY)
      }
    }
  }, [drawing, zoomPan, imageSize.width, imageSize.height])

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
    
    // Disable interactions during animation
    if (zoomPan.isAnimating) {
      return
    }
    
    // Clear any existing modes when starting new touch
    drawing.resetMode()
    
    // Multi-touch (2+ fingers) - zoom mode only
    if (e.touches.length >= 2) {
      touch.startTouch(e.touches, () => {})
      return
    }
    
    // Single touch handling
    const touchPoint = e.touches[0]
    const touchCoords = {
      x: touchPoint.clientX,
      y: touchPoint.clientY
    }
    
    // Store initial touch position for dragging
    initialTouchRef.current = touchCoords
    
    const onLongPress = () => {
      const coords = zoomPan.getCanvasCoordinates(touchCoords.x, touchCoords.y)
      // Calculate dynamic thickness for long press
      const dynamicThickness = calculateDynamicThickness()
      setLineThickness(dynamicThickness)
      drawing.startDrawing(coords, dynamicThickness)
    }
    
    const onAdjustMode = () => {
      // Calculate dynamic thickness when entering adjust mode
      const dynamicThickness = calculateDynamicThickness()
      setLineThickness(dynamicThickness)
      // Use screen coordinates for loupe display
      drawing.startAdjustMode(touchCoords)
    }
    
    const onDrawMode = () => {
      const coords = zoomPan.getCanvasCoordinates(touchCoords.x, touchCoords.y)
      // Calculate dynamic thickness based on current viewport
      const dynamicThickness = calculateDynamicThickness()
      setLineThickness(dynamicThickness)
      drawing.startDrawMode()
      drawing.startDrawing(coords, dynamicThickness)
    }
    
    const canvasCoords = zoomPan.getCanvasCoordinates(touchPoint.clientX, touchPoint.clientY)
    const touchedLineIndex = drawing.findLineAtPoint(canvasCoords)
    
    if (touchedLineIndex !== -1) {
      // If touching a line, select it
      drawing.selectLine(touchedLineIndex, canvasCoords)
      touch.startTouch(e.touches, onLongPress)
    } else {
      // If not touching a line, start loupe mode or drag
      touch.startTouch(e.touches, onLongPress, onAdjustMode, onDrawMode)
      // Start dragging immediately for smooth panning
      zoomPan.startDragging(touchPoint.clientX, touchPoint.clientY)
    }
  }, [touch, drawing, zoomPan, imageSize.width, imageSize.height, lineThickness])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // e.preventDefault()
    
    // Disable interactions during animation
    if (zoomPan.isAnimating) {
      return
    }
    
    // Handle pinch zoom and pan - this takes priority
    if (touch.isPinching) {
      // Only handle zoom if gesture type is pinch
      const pinchScale = touch.getPinchScale(e.touches)
      if (pinchScale) {
        const center = touch.getPinchCenter(e.touches)
        if (center) {
          zoomPan.handlePinchZoom(zoomPan.scale * pinchScale, center.x, center.y)
        }
      }
      
      // Only handle pan if gesture type is pan
      const pinchDelta = touch.getPinchCenterDelta(e.touches)
      if (pinchDelta) {
        zoomPan.pan(pinchDelta.x, pinchDelta.y)
      }
      
      // Don't process any other touch logic during two-finger gestures
      return
    }
    
    // Only process single touch if not pinching
    if (e.touches.length === 1 && !touch.isPinching) {
      const touchPos = e.touches[0]
      const coords = zoomPan.getCanvasCoordinates(touchPos.clientX, touchPos.clientY)
      
      // Handle mode transition in adjust mode
      const onDrawModeTransition = () => {
        if (drawing.drawingMode === 'adjust') {
          // Calculate dynamic thickness based on current viewport
          const dynamicThickness = calculateDynamicThickness()
          setLineThickness(dynamicThickness)
          drawing.startDrawMode()
          drawing.startDrawing(coords, dynamicThickness)
        }
      }
      
      touch.moveTouch(e.touches, onDrawModeTransition)
      
      // Update loupe position in adjust/draw modes (use screen coordinates)
      if (drawing.drawingMode === 'adjust' || drawing.drawingMode === 'draw') {
        drawing.updateLoupePosition({ x: touchPos.clientX, y: touchPos.clientY }, touch.isStationary)
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
  }, [touch, drawing, zoomPan, imageSize.width, imageSize.height])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    touch.endTouch(e.touches)
    
    if (touch.isQuickTap() && e.changedTouches[0] && !touch.isPinching) {
      const tapX = e.changedTouches[0].clientX
      const tapY = e.changedTouches[0].clientY
      
      // Check for double tap
      if (touch.checkDoubleTap({ x: tapX, y: tapY })) {
        zoomPan.handleDoubleTap(tapX, tapY)
      } else {
        // Single tap logic
        const coords = zoomPan.getCanvasCoordinates(tapX, tapY)
        const clickedLineIndex = drawing.findLineAtPoint(coords)
        
        if (clickedLineIndex !== -1) {
          drawing.changeLineThickness(clickedLineIndex)
        }
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
    setCanvasOpacity(0)
    setShowLanding(true)
  }, [drawing, zoomPan])

  React.useEffect(() => {
    const container = containerRef.current
    if (!container || !image) return
    
    container.addEventListener('wheel', handleWheel, { passive: false })
    
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel, image])

  return (
    <>
      {showLanding && (
        <LandingPage onImageSelect={handleImageSelect} />
      )}
      {image && (
        <div 
          ref={containerRef}
          style={{
            opacity: canvasOpacity,
            transition: 'opacity 0.2s ease-in-out',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
          }}
        >
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
            isZoomInitialized={zoomPan.isInitialized}
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
      )}
    </>
  )
}