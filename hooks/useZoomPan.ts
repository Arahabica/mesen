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
    
    const scaleDelta = delta > 0 ? 0.9 : 1.1
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * scaleDelta))
    
    const rect = containerRef.current.getBoundingClientRect()
    const offsetX = clientX - rect.left
    const offsetY = clientY - rect.top
    
    setPosition(prev => ({
      x: offsetX - (offsetX - prev.x) * (newScale / scale),
      y: offsetY - (offsetY - prev.y) * (newScale / scale)
    }))
    
    setScale(newScale)
  }, [scale, containerRef])

  const handlePinchZoom = useCallback((newScale: number, centerX: number, centerY: number) => {
    if (!containerRef.current) return
    
    const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale))
    const rect = containerRef.current.getBoundingClientRect()
    const offsetX = centerX - rect.left
    const offsetY = centerY - rect.top
    
    setPosition({
      x: offsetX - (offsetX - position.x) * (clampedScale / scale),
      y: offsetY - (offsetY - position.y) * (clampedScale / scale)
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