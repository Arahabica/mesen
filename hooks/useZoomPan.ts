import { useState, useCallback, useEffect, useRef } from 'react'
import { Position, ImageSize } from '@/types/editor'
import { MIN_SCALE, MAX_SCALE } from '@/constants/editor'

export function useZoomPan(imageSize: ImageSize, containerRef: React.RefObject<HTMLDivElement>) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 })
  const [isInitialized, setIsInitialized] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 })
  
  // Use refs to access current values in callbacks
  const scaleRef = useRef(scale)
  const positionRef = useRef(position)
  
  useEffect(() => {
    scaleRef.current = scale
  }, [scale])
  
  useEffect(() => {
    positionRef.current = position
  }, [position])

  const getCanvasCoordinates = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 }
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: (clientX - rect.left - position.x) / scale,
      y: (clientY - rect.top - position.y) / scale
    }
  }, [scale, position, containerRef])

  const startDragging = useCallback((clientX: number, clientY: number) => {
    setDragStart({ x: clientX - position.x, y: clientY - position.y })
    setIsDragging(true)
  }, [position])

  const drag = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return
    requestAnimationFrame(() => {
      setPosition({
        x: clientX - dragStart.x,
        y: clientY - dragStart.y
      })
    })
  }, [isDragging, dragStart])

  const stopDragging = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleWheel = useCallback((delta: number, clientX: number, clientY: number) => {
    if (!containerRef.current) return
    
    // Adjust zoom speed based on delta magnitude
    const zoomSpeed = Math.min(Math.abs(delta) * 0.001, 0.1)
    const scaleFactor = delta > 0 ? 1 - zoomSpeed : 1 + zoomSpeed
    
    const rect = containerRef.current.getBoundingClientRect()
    const mouseX = clientX - rect.left
    const mouseY = clientY - rect.top
    
    requestAnimationFrame(() => {
      const currentScale = scaleRef.current
      const currentPosition = positionRef.current
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, currentScale * scaleFactor))
      
      // Calculate the position on the canvas before zoom
      const canvasX = (mouseX - currentPosition.x) / currentScale
      const canvasY = (mouseY - currentPosition.y) / currentScale
      
      // Calculate new position to keep the same canvas point under the mouse
      const newPosition = {
        x: mouseX - canvasX * newScale,
        y: mouseY - canvasY * newScale
      }
      
      setScale(newScale)
      setPosition(newPosition)
    })
  }, [containerRef])

  const handlePinchZoom = useCallback((newScale: number, centerX: number, centerY: number) => {
    if (!containerRef.current) return
    
    requestAnimationFrame(() => {
      const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale))
      const rect = containerRef.current!.getBoundingClientRect()
      const pinchX = centerX - rect.left
      const pinchY = centerY - rect.top
      
      const currentScale = scaleRef.current
      const currentPosition = positionRef.current
      
      // Calculate the position on the canvas before zoom
      const canvasX = (pinchX - currentPosition.x) / currentScale
      const canvasY = (pinchY - currentPosition.y) / currentScale
      
      // Calculate new position to keep the same canvas point under the pinch center
      const newPosition = {
        x: pinchX - canvasX * clampedScale,
        y: pinchY - canvasY * clampedScale
      }
      
      setScale(clampedScale)
      setPosition(newPosition)
    })
  }, [containerRef])

  // Initialize zoom to fit image
  useEffect(() => {
    if (imageSize.width > 0 && containerRef.current && !isInitialized) {
      const containerRect = containerRef.current.getBoundingClientRect()
      const imgAspect = imageSize.width / imageSize.height
      const containerAspect = containerRect.width / containerRect.height
      
      let initialScale = 1
      if (imgAspect > containerAspect) {
        initialScale = containerRect.width / imageSize.width
      } else {
        initialScale = containerRect.height / imageSize.height
      }
      
      setScale(initialScale)
      setPosition({
        x: (containerRect.width - imageSize.width * initialScale) / 2,
        y: (containerRect.height - imageSize.height * initialScale) / 2
      })
      setIsInitialized(true)
    }
  }, [imageSize, containerRef, isInitialized])

  const reset = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
    setIsInitialized(false)
  }, [])

  return {
    scale,
    position,
    isDragging,
    getCanvasCoordinates,
    startDragging,
    drag,
    stopDragging,
    handleWheel,
    handlePinchZoom,
    reset
  }
}