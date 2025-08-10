'use client'

import React, { useState, useRef, useCallback } from 'react'
import MozaicCanvasEditor, { MozaicCanvasEditorRef } from './MozaicCanvasEditor'
import InstructionTooltip from './InstructionTooltip'
import { useMozaicDrawing } from '@/hooks/useMozaicDrawing'
import { useZoomPan } from '@/hooks/useZoomPan'
import { useTouch } from '@/hooks/useTouch'
import { useInstructionTooltip } from '@/hooks/useInstructionTooltip'
import { ImageSize, ImageData } from '@/types/editor'
import { LONG_PRESS_DURATION } from '@/constants/editor'
import LandingPage from './LandingPage'
import { applyMosaicToArea } from '@/utils/mosaic'

export default function MozaicEditor() {
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [imageSize, setImageSize] = useState<ImageSize>({ width: 0, height: 0 })
  const [initialMousePos, setInitialMousePos] = useState<{ x: number; y: number } | null>(null)
  const [canvasOpacity, setCanvasOpacity] = useState(1)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasEditorRef = useRef<MozaicCanvasEditorRef>(null)
  const mouseStartTimeRef = useRef<number>(0)
  const mouseHasMovedRef = useRef<boolean>(false)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const initialTouchRef = useRef<{ x: number; y: number } | null>(null)
  
  const mozaicDrawing = useMozaicDrawing()
  const zoomPan = useZoomPan(imageSize, containerRef)
  const touch = useTouch()
  const { showInstructionTooltip, showInstruction, hideInstruction } = useInstructionTooltip()

  const handleImageSelect = useCallback((selectedImage: ImageData) => {
    setImageData(selectedImage)
    setCanvasOpacity(1)
  }, [])

  const handleReset = useCallback(() => {
    setImageData(null)
    mozaicDrawing.setAreas([])
    zoomPan.reset()
    setImageSize({ width: 0, height: 0 })
    setCanvasOpacity(0)
  }, [mozaicDrawing, zoomPan])


  const handleImageLoad = useCallback((width: number, height: number) => {
    setImageSize({ width, height })
    // Show instruction tooltip with localStorage-based control
    showInstruction()
  }, [showInstruction])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const { clientX, clientY } = e
    mouseStartTimeRef.current = Date.now()
    setInitialMousePos({ x: clientX, y: clientY })
    mouseHasMovedRef.current = false
    
    const coords = zoomPan.getCanvasCoordinates(clientX, clientY)
    const clickedAreaIndex = mozaicDrawing.findAreaAtPoint(coords)
    
    if (clickedAreaIndex !== -1) {
      // If clicked on an area, delete it
      mozaicDrawing.deleteArea(clickedAreaIndex)
    } else {
      longPressTimerRef.current = setTimeout(() => {
        if (!mouseHasMovedRef.current) {
          mozaicDrawing.startDrawing(coords)
        }
      }, LONG_PRESS_DURATION)
      
      // Only start dragging if we're in move mode
      if (mozaicDrawing.drawingMode === 'move') {
        zoomPan.startDragging(clientX, clientY)
      }
    }
  }, [mozaicDrawing, zoomPan])

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
    
    if (mozaicDrawing.isDrawing) {
      const coords = zoomPan.getCanvasCoordinates(e.clientX, e.clientY)
      mozaicDrawing.draw(coords)
    } else if (zoomPan.isDragging && !mozaicDrawing.isDrawing && mozaicDrawing.drawingMode === 'move') {
      zoomPan.drag(e.clientX, e.clientY)
    }
  }, [mozaicDrawing, zoomPan, initialMousePos])

  const handleMouseUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    
    mozaicDrawing.stopDrawing()
    zoomPan.stopDragging()
    setInitialMousePos(null)
    mouseHasMovedRef.current = false
  }, [mozaicDrawing, zoomPan])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    
    // Disable interactions during animation
    if (zoomPan.isAnimating) {
      return
    }
    
    // Clear any existing modes when starting new touch
    mozaicDrawing.resetMode()
    
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
      mozaicDrawing.startDrawing(coords)
    }
    
    const onAdjustMode = () => {
      // Don't enter adjust mode if in move mode
      if (touch.currentMode === 'move') return
      
      // Use screen coordinates for loupe display
      mozaicDrawing.startAdjustMode(touchCoords)
    }
    
    const onDrawMode = () => {
      // Don't enter draw mode if in move mode
      if (touch.currentMode === 'move') return
      
      const coords = zoomPan.getCanvasCoordinates(touchCoords.x, touchCoords.y)
      mozaicDrawing.startDrawMode()
      mozaicDrawing.startDrawing(coords)
    }
    
    
    const canvasCoords = zoomPan.getCanvasCoordinates(touchPoint.clientX, touchPoint.clientY)
    const touchedAreaIndex = mozaicDrawing.findAreaAtPoint(canvasCoords)
    
    if (touchedAreaIndex !== -1) {
      // If touching an area, delete it immediately
      mozaicDrawing.deleteArea(touchedAreaIndex)
    } else {
      // If not touching an area, start loupe mode or drag
      touch.startTouch(e.touches, onLongPress, onAdjustMode, onDrawMode)
      // Don't start dragging yet - let mode be determined first
    }
  }, [touch, mozaicDrawing, zoomPan])

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
      
      touch.moveTouch(e.touches)
      
      // Handle mode transitions
      if (touch.currentMode === 'move' && (mozaicDrawing.drawingMode === 'adjust' || mozaicDrawing.drawingMode === 'draw')) {
        // Switched from adjust/draw mode to move mode - hide loupe
        mozaicDrawing.resetMode()
      } else if (touch.currentMode === 'draw' && mozaicDrawing.drawingMode === 'adjust') {
        // Switched from adjust mode to draw mode
        const drawCoords = zoomPan.getCanvasCoordinates(touchPos.clientX, touchPos.clientY)
        mozaicDrawing.startDrawMode()
        mozaicDrawing.startDrawing(drawCoords)
      }
      
      // Update loupe position in adjust/draw modes
      if (touch.currentMode === 'adjust' || touch.currentMode === 'draw') {
        mozaicDrawing.updateLoupePosition({ x: touchPos.clientX, y: touchPos.clientY }, touch.isStationary)
      }
      
      if (mozaicDrawing.isDrawing) {
        mozaicDrawing.draw(coords)
      } else if (!mozaicDrawing.isDrawing) {
        // Only allow dragging in move mode
        if (touch.currentMode === 'move') {
          // Start dragging if not already started
          if (!zoomPan.isDragging && initialTouchRef.current) {
            // Use initial touch position for correct drag calculation
            zoomPan.startDragging(initialTouchRef.current.x, initialTouchRef.current.y)
          }
          if (zoomPan.isDragging) {
            zoomPan.drag(touchPos.clientX, touchPos.clientY)
          }
        }
      }
    }
  }, [touch, mozaicDrawing, zoomPan])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    touch.endTouch(e.touches)
    
    if (touch.isQuickTap() && e.changedTouches[0] && !touch.isPinching) {
      const tapX = e.changedTouches[0].clientX
      const tapY = e.changedTouches[0].clientY
      const coords = zoomPan.getCanvasCoordinates(tapX, tapY)
      const clickedAreaIndex = mozaicDrawing.findAreaAtPoint(coords)
      
      if (clickedAreaIndex !== -1) {
        // If tapped on an area, delete it
        mozaicDrawing.deleteArea(clickedAreaIndex)
      } else {
        // If not on any area, check for double tap for zoom
        if (touch.checkDoubleTap({ x: tapX, y: tapY })) {
          zoomPan.handleDoubleTap(tapX, tapY)
        }
      }
    }
    
    mozaicDrawing.stopDrawing()
    zoomPan.stopDragging()
    mozaicDrawing.resetMode()
    initialTouchRef.current = null
  }, [touch, mozaicDrawing, zoomPan])

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    zoomPan.handleWheel(e.deltaY, e.clientX, e.clientY)
  }, [zoomPan])

  const download = useCallback(() => {
    const canvas = canvasEditorRef.current?.getCanvas()
    if (!canvas || !imageData) return
    
    const img = new Image()
    img.onload = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      canvas.width = img.width
      canvas.height = img.height
      
      ctx.drawImage(img, 0, 0)
      
      // Apply mosaic effect to the drawn areas
      mozaicDrawing.areas.forEach(area => {
        applyMosaicToArea(ctx, area, img.width, img.height)
      })
      
      canvas.toBlob(blob => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          
          // Generate filename: {original_name}_mozaic.{extension}
          let downloadFilename = 'mozaic.png'
          if (imageData.filename) {
            const lastDotIndex = imageData.filename.lastIndexOf('.')
            if (lastDotIndex > 0) {
              const nameWithoutExt = imageData.filename.substring(0, lastDotIndex)
              const extension = imageData.filename.substring(lastDotIndex + 1).toLowerCase()
              // Use original extension if it's a valid image format, otherwise use png
              const validExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp']
              const finalExt = validExtensions.includes(extension) ? extension : 'png'
              downloadFilename = `${nameWithoutExt}_mozaic.${finalExt}`
            } else {
              // No extension in original filename
              downloadFilename = `${imageData.filename}_mozaic.png`
            }
          }
          
          a.download = downloadFilename
          a.click()
          URL.revokeObjectURL(url)
        }
      })
    }
    img.src = imageData.dataURL
  }, [imageData, mozaicDrawing.areas])

  const resetView = useCallback(() => {
    zoomPan.resetWithAnimation()
  }, [zoomPan])

  const closeImage = useCallback(() => {
    handleReset()
  }, [handleReset])

  React.useEffect(() => {
    const container = containerRef.current
    if (!container || !imageData) return
    
    container.addEventListener('wheel', handleWheel, { passive: false })
    
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel, imageData])

  if (!imageData) {
    return <LandingPage onImageSelect={handleImageSelect} />
  }

  return (
    <>
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
        <MozaicCanvasEditor
          ref={canvasEditorRef}
          image={imageData.dataURL}
          areas={mozaicDrawing.areas}
          currentArea={mozaicDrawing.currentArea}
          scale={zoomPan.scale}
          position={zoomPan.position}
          isDrawing={mozaicDrawing.isDrawing}
          drawingMode={mozaicDrawing.drawingMode}
          loupeState={mozaicDrawing.loupeState}
          isZoomInitialized={zoomPan.isInitialized}
          isAtInitialScale={!zoomPan.isInitialized || zoomPan.isAtInitialView}
          getCanvasCoordinates={zoomPan.getCanvasCoordinates}
          onImageLoad={handleImageLoad}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onUndo={mozaicDrawing.undo}
          onDownload={download}
          onClose={closeImage}
          onResetView={resetView}
        />
      </div>
      <InstructionTooltip
        visible={showInstructionTooltip}
        onHide={hideInstruction}
      />
    </>
  )
}


