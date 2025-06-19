import { useState, useCallback, useEffect, useRef } from 'react'
import { Position, ImageSize } from '@/types/editor'
import { MAX_SCALE, DOUBLE_TAP_ZOOM_FACTOR, DOUBLE_TAP_ANIMATION_DURATION } from '@/constants/editor'

const DEFAULT_MIN_SCALE = 0.1

// Easing function for smooth animation
const easeOutCubic = (t: number): number => {
  return 1 - Math.pow(1 - t, 3)
}

export function useZoomPan(imageSize: ImageSize, containerRef: React.RefObject<HTMLDivElement | null>) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 })
  const [isInitialized, setIsInitialized] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 })
  const [isAnimating, setIsAnimating] = useState(false)
  
  // Store initial scale and position for double-tap reset
  const initialScaleRef = useRef(1)
  const initialPositionRef = useRef<Position>({ x: 0, y: 0 })
  
  // Use refs to access current values in callbacks
  const scaleRef = useRef(scale)
  const positionRef = useRef(position)
  const animationRef = useRef<number | null>(null)
  
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
      const minScale = isInitialized ? initialScaleRef.current : DEFAULT_MIN_SCALE
      const newScale = Math.max(minScale, Math.min(MAX_SCALE, currentScale * scaleFactor))
      
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
  }, [containerRef, isInitialized])

  const handlePinchZoom = useCallback((newScale: number, centerX: number, centerY: number) => {
    if (!containerRef.current) return
    
    requestAnimationFrame(() => {
      const minScale = isInitialized ? initialScaleRef.current : DEFAULT_MIN_SCALE
      const clampedScale = Math.max(minScale, Math.min(MAX_SCALE, newScale))
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
  }, [containerRef, isInitialized])

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
      
      const initialPos = {
        x: (containerRect.width - imageSize.width * initialScale) / 2,
        y: (containerRect.height - imageSize.height * initialScale) / 2
      }
      
      // Store initial values for double-tap reset
      initialScaleRef.current = initialScale
      initialPositionRef.current = initialPos
      
      setScale(initialScale)
      setPosition(initialPos)
      setIsInitialized(true)
    }
  }, [imageSize, containerRef, isInitialized])

  const pan = useCallback((deltaX: number, deltaY: number) => {
    requestAnimationFrame(() => {
      setPosition(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }))
    })
  }, [])

  const reset = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    setScale(1)
    setPosition({ x: 0, y: 0 })
    setIsInitialized(false)
    setIsAnimating(false)
  }, [])

  const animateToTarget = useCallback((targetScale: number, targetPosition: Position) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    
    const startScale = scaleRef.current
    const startPosition = positionRef.current
    const startTime = Date.now()
    
    setIsAnimating(true)
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / DOUBLE_TAP_ANIMATION_DURATION, 1)
      const easedProgress = easeOutCubic(progress)
      
      const currentScale = startScale + (targetScale - startScale) * easedProgress
      const currentPosition = {
        x: startPosition.x + (targetPosition.x - startPosition.x) * easedProgress,
        y: startPosition.y + (targetPosition.y - startPosition.y) * easedProgress
      }
      
      setScale(currentScale)
      setPosition(currentPosition)
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setIsAnimating(false)
        animationRef.current = null
      }
    }
    
    animationRef.current = requestAnimationFrame(animate)
  }, [])

  const resetWithAnimation = useCallback(() => {
    if (isInitialized && !isAnimating) {
      // Animate to initial scale and position
      animateToTarget(initialScaleRef.current, initialPositionRef.current)
    }
  }, [isInitialized, isAnimating, animateToTarget])

  const handleDoubleTap = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current || isAnimating) return
    
    const currentScale = scaleRef.current
    const initialScale = initialScaleRef.current
    
    // Check if we're at initial scale (with small tolerance)
    const isAtInitialScale = Math.abs(currentScale - initialScale) < 0.01
    
    if (isAtInitialScale) {
      // Zoom in to DOUBLE_TAP_ZOOM_FACTOR x the initial scale
      const targetScale = initialScale * DOUBLE_TAP_ZOOM_FACTOR
      const rect = containerRef.current.getBoundingClientRect()
      const tapX = clientX - rect.left
      const tapY = clientY - rect.top
      
      // Calculate the position on the canvas before zoom
      const canvasX = (tapX - positionRef.current.x) / currentScale
      const canvasY = (tapY - positionRef.current.y) / currentScale
      
      // Calculate new position to keep the tap point at the center
      const targetPosition = {
        x: tapX - canvasX * targetScale,
        y: tapY - canvasY * targetScale
      }
      
      animateToTarget(targetScale, targetPosition)
    } else {
      // Reset to initial scale and position
      animateToTarget(initialScale, initialPositionRef.current)
    }
  }, [containerRef, isAnimating, animateToTarget])

  // Check if current scale is at initial scale
  const isAtInitialScale = isInitialized && Math.abs(scale - initialScaleRef.current) < 0.01

  return {
    scale,
    position,
    isDragging,
    isInitialized,
    isAnimating,
    isAtInitialScale,
    getCanvasCoordinates,
    startDragging,
    drag,
    stopDragging,
    handleWheel,
    handlePinchZoom,
    handleDoubleTap,
    pan,
    reset,
    resetWithAnimation
  }
}