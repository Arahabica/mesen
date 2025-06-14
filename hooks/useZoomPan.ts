import { useState, useCallback, useEffect, useRef } from 'react'
import { Position, ImageSize } from '@/types/editor'
import { MIN_SCALE, MAX_SCALE } from '@/constants/editor'

export function useZoomPan(imageSize: ImageSize, containerRef: React.RefObject<HTMLDivElement>) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 })
  const [isInitialized, setIsInitialized] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 })

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
    
    const scaleFactor = delta > 0 ? 0.9 : 1.1
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * scaleFactor))
    
    const rect = containerRef.current.getBoundingClientRect()
    const mouseX = clientX - rect.left
    const mouseY = clientY - rect.top
    
    // Calculate the position on the canvas before zoom
    const canvasX = (mouseX - position.x) / scale
    const canvasY = (mouseY - position.y) / scale
    
    // Calculate new position to keep the same canvas point under the mouse
    setPosition({
      x: mouseX - canvasX * newScale,
      y: mouseY - canvasY * newScale
    })
    
    setScale(newScale)
  }, [scale, position, containerRef])

  const handlePinchZoom = useCallback((newScale: number, centerX: number, centerY: number) => {
    if (!containerRef.current) return
    
    const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale))
    const rect = containerRef.current.getBoundingClientRect()
    const pinchX = centerX - rect.left
    const pinchY = centerY - rect.top
    
    // Calculate the position on the canvas before zoom
    const canvasX = (pinchX - position.x) / scale
    const canvasY = (pinchY - position.y) / scale
    
    // Calculate new position to keep the same canvas point under the pinch center
    setPosition({
      x: pinchX - canvasX * clampedScale,
      y: pinchY - canvasY * clampedScale
    })
    
    setScale(clampedScale)
  }, [scale, position, containerRef])

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