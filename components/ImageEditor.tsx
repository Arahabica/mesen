'use client'

import React, { useState, useRef, useCallback } from 'react'
import CanvasEditor, { CanvasEditorRef } from './CanvasEditor'
import InstructionTooltip from './InstructionTooltip'
import ErrorDialog from './ErrorDialog'
import NoFaceDialog from './NoFaceDialog'
import ScanningOverlay from './ScanningOverlay'
import { useDrawing } from '@/hooks/useDrawing'
import { useZoomPan } from '@/hooks/useZoomPan'
import { useTouch } from '@/hooks/useTouch'
import { useInstructionTooltip } from '@/hooks/useInstructionTooltip'
import { useFaceDetection } from '@/hooks/useFaceDetection'
import { ImageSize, ImageData } from '@/types/editor'
import { LONG_PRESS_DURATION, getDynamicThickness, getDefaultThickness, getThicknessOptions, AUTO_THICKNESS_SCREEN_RATIO, LINE_ZOOM_EXCLUSION_RADIUS } from '@/constants/editor'

interface ImageEditorProps {
  initialImage: ImageData
  onReset: () => void
}

export default function ImageEditor({ initialImage, onReset }: ImageEditorProps) {
  const [imageData, setImageData] = useState<ImageData | null>(initialImage)
  const [lineThickness, setLineThickness] = useState(10)
  const [imageSize, setImageSize] = useState<ImageSize>({ width: 0, height: 0 })
  const [initialMousePos, setInitialMousePos] = useState<{ x: number; y: number } | null>(null)
  const [canvasOpacity, setCanvasOpacity] = useState(1)

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasEditorRef = useRef<CanvasEditorRef>(null)
  const mouseStartTimeRef = useRef<number>(0)
  const mouseHasMovedRef = useRef<boolean>(false)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const initialTouchRef = useRef<{ x: number; y: number } | null>(null)

  const drawing = useDrawing(lineThickness, imageSize.width, imageSize.height)
  const setDrawingLines = drawing.setLines
  const zoomPan = useZoomPan(imageSize, containerRef)
  const touch = useTouch()
  const { showInstructionTooltip, showInstruction, hideInstruction } = useInstructionTooltip()
  const [showAiTooltip, setShowAiTooltip] = useState(false)

  const faceDetection = useFaceDetection({
    imageSize,
    thicknessOptions: getThicknessOptions(imageSize.width, imageSize.height).filter(option => option > 0),
    existingLines: drawing.lines,
    onLinesAdd: (lines) => setDrawingLines(prev => [...prev, ...lines])
  })

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
    // Show instruction tooltip with localStorage-based control
    showInstruction()
  }, [showInstruction])

  const handleDetectFaces = useCallback(async () => {
    if (!imageData) {
      console.warn('[FaceDetector] No image loaded')
      return
    }

    faceDetection.setIsAiDetectionLine(true)
    await faceDetection.detectFaces(imageData.dataURL, imageData.filename)
  }, [imageData, faceDetection])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const { clientX, clientY } = e
    mouseStartTimeRef.current = Date.now()
    setInitialMousePos({ x: clientX, y: clientY })
    mouseHasMovedRef.current = false

    // Reset AI detection flag when user draws manually
    faceDetection.setIsAiDetectionLine(false)

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
    } else if (zoomPan.isDragging && !drawing.isDrawing && drawing.drawingMode === 'move') {
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

    // Reset AI detection flag when user draws manually
    faceDetection.setIsAiDetectionLine(false)

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
      // Don't enter adjust mode if in move mode
      if (touch.currentMode === 'move') return
      
      // Calculate dynamic thickness when entering adjust mode
      const dynamicThickness = calculateDynamicThickness()
      setLineThickness(dynamicThickness)
      // Use screen coordinates for loupe display
      drawing.startAdjustMode(touchCoords)
    }
    
    const onDrawMode = () => {
      // Don't enter draw mode if in move mode
      if (touch.currentMode === 'move') return
      
      const coords = zoomPan.getCanvasCoordinates(touchCoords.x, touchCoords.y)
      // Calculate dynamic thickness based on current viewport
      const dynamicThickness = calculateDynamicThickness()
      setLineThickness(dynamicThickness)
      drawing.startDrawMode()
      drawing.startDrawing(coords, dynamicThickness)
    }
    
    const onMoveLineMode = () => {
      // Line move mode - show loupe
      drawing.setDrawingMode('moveLine')
      drawing.setLoupeState({
        visible: true,
        position: { x: touchPoint.clientX, y: touchPoint.clientY },
        mode: 'moveLine',
        isStationary: false
      })
    }
    
    const canvasCoords = zoomPan.getCanvasCoordinates(touchPoint.clientX, touchPoint.clientY)
    const touchedLineIndex = drawing.findLineAtPoint(canvasCoords)
    
    if (touchedLineIndex !== -1) {
      // If touching a line, select it and wait for moveLine mode
      drawing.selectLine(touchedLineIndex, canvasCoords)
      touch.startTouch(e.touches, onLongPress, undefined, undefined, onMoveLineMode)
    } else {
      // If not touching a line, start loupe mode or drag
      touch.startTouch(e.touches, onLongPress, onAdjustMode, onDrawMode)
      // Don't start dragging yet - let mode be determined first
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
      
      touch.moveTouch(e.touches)
      
      // Handle mode transitions
      if (touch.currentMode === 'move' && (drawing.drawingMode === 'adjust' || drawing.drawingMode === 'draw')) {
        // Switched from adjust/draw mode to move mode - hide loupe
        drawing.resetMode()
      } else if (touch.currentMode === 'draw' && drawing.drawingMode === 'adjust') {
        // Switched from adjust mode to draw mode
        const drawCoords = zoomPan.getCanvasCoordinates(touchPos.clientX, touchPos.clientY)
        const dynamicThickness = calculateDynamicThickness()
        setLineThickness(dynamicThickness)
        drawing.startDrawMode()
        drawing.startDrawing(drawCoords, dynamicThickness)
      }
      
      // Update loupe position in adjust/draw/moveLine modes
      if (touch.currentMode === 'adjust' || touch.currentMode === 'draw' || touch.currentMode === 'moveLine') {
        drawing.updateLoupePosition({ x: touchPos.clientX, y: touchPos.clientY }, touch.isStationary)
      }
      
      if (drawing.isDrawing) {
        drawing.draw(coords)
      } else if (touch.currentMode === 'moveLine' && drawing.selectedLineIndex !== null && touch.hasMoved) {
        // Move line in moveLine mode
        drawing.dragLine(coords)
      } else if (!drawing.isDrawing && touch.currentMode !== 'moveLine') {
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
  }, [touch, drawing, zoomPan, imageSize.width, imageSize.height])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    touch.endTouch(e.touches)
    
    if (touch.isQuickTap() && e.changedTouches[0] && !touch.isPinching) {
      const tapX = e.changedTouches[0].clientX
      const tapY = e.changedTouches[0].clientY
      const coords = zoomPan.getCanvasCoordinates(tapX, tapY)
      const clickedLineIndex = drawing.findLineAtPoint(coords)
      
      if (clickedLineIndex !== -1) {
        // If tapped on a line, change thickness (no double tap zoom)
        drawing.changeLineThickness(clickedLineIndex)
      } else if (drawing.isNearLine(coords, LINE_ZOOM_EXCLUSION_RADIUS)) {
        // If near a line (within exclusion radius), do nothing (no zoom, no thickness change)
      } else {
        // If not near any line, check for double tap for zoom
        if (touch.checkDoubleTap({ x: tapX, y: tapY })) {
          zoomPan.handleDoubleTap(tapX, tapY)
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
    if (!canvas || !imageData) return
    
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
          
          // Generate filename: {original_name}_mesen.{extension}
          let downloadFilename = 'mesen.png'
          if (imageData.filename) {
            const lastDotIndex = imageData.filename.lastIndexOf('.')
            if (lastDotIndex > 0) {
              const nameWithoutExt = imageData.filename.substring(0, lastDotIndex)
              const extension = imageData.filename.substring(lastDotIndex + 1).toLowerCase()
              // Use original extension if it's a valid image format, otherwise use png
              const validExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp']
              const finalExt = validExtensions.includes(extension) ? extension : 'png'
              downloadFilename = `${nameWithoutExt}_mesen.${finalExt}`
            } else {
              // No extension in original filename
              downloadFilename = `${imageData.filename}_mesen.png`
            }
          }
          
          a.download = downloadFilename
          a.click()
          URL.revokeObjectURL(url)
        }
      })
    }
    img.src = imageData.dataURL
  }, [imageData, drawing.lines])

  const resetView = useCallback(() => {
    zoomPan.resetWithAnimation()
  }, [zoomPan])

  const closeImage = useCallback(() => {
    setImageData(null)
    drawing.setLines([])
    zoomPan.reset()
    setImageSize({ width: 0, height: 0 })
    setCanvasOpacity(0)
    onReset()
  }, [drawing, zoomPan, onReset])

  React.useEffect(() => {
    const container = containerRef.current
    if (!container || !imageData) return
    
    container.addEventListener('wheel', handleWheel, { passive: false })
    
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel, imageData])

  return (
    <>
      {imageData && (
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
            image={imageData.dataURL}
            lines={drawing.lines}
            currentLine={drawing.currentLine}
            animatingLine={faceDetection.animatingLine}
            animationProgress={faceDetection.animationProgress}
            greenLines={faceDetection.greenLines}
            colorTransitionProgress={faceDetection.colorTransitionProgress}
            scale={zoomPan.scale}
            position={zoomPan.position}
            lineThickness={lineThickness}
            isDrawing={drawing.isDrawing}
            drawingMode={drawing.drawingMode}
            loupeState={drawing.loupeState}
            isZoomInitialized={zoomPan.isInitialized}
            isAtInitialScale={!zoomPan.isInitialized || zoomPan.isAtInitialView}
            showAiTooltipTrigger={showAiTooltip}
            isAiDetectionLine={faceDetection.isAiDetectionLine}
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
            onResetView={resetView}
            onDetectFaces={handleDetectFaces}
            isDetectingFaces={faceDetection.isDetecting}
          />
        </div>
      )}
      <InstructionTooltip
        visible={showInstructionTooltip}
        onHide={() => {
          hideInstruction()
          setShowAiTooltip(true)
        }}
      />
      <ScanningOverlay visible={faceDetection.isScanning} />
      <NoFaceDialog
        visible={faceDetection.showNoFace}
        onHide={faceDetection.hideNoFace}
      />
      <ErrorDialog
        visible={faceDetection.showError}
        message={faceDetection.errorMessage}
        onHide={faceDetection.hideError}
      />
    </>
  )
}
