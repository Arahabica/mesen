import React, { useEffect, useRef, useState } from 'react'
import { Pen } from 'lucide-react'
import { Position, DrawingMode, LoupeRelativePosition } from '@/types/editor'
import { calculateLoupeTopLeftPosition, LOUPE_RADIUS } from '@/utils/loupePosition'

interface LoupeProps {
  visible: boolean
  position: Position  // Screen coordinates
  mode: DrawingMode
  isStationary?: boolean
  sourceCanvas: HTMLCanvasElement | null
  lineThickness: number
  scale: number
  imagePosition: Position
  getCanvasCoordinates: (screenX: number, screenY: number) => Position
  relativePosition?: LoupeRelativePosition
}

const MAGNIFICATION_FACTOR = 1.5

export default function Loupe({
  visible,
  position,
  mode,
  isStationary = false,
  sourceCanvas,
  lineThickness,
  scale,
  imagePosition,
  getCanvasCoordinates,
  relativePosition
}: LoupeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [animationProgress, setAnimationProgress] = useState(0)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const [isFlashing, setIsFlashing] = useState(false)
  const [showPenIcon, setShowPenIcon] = useState(false)
  const [penIconAnimationType, setPenIconAnimationType] = useState<'show' | 'hide'>('show')
  const prevModeRef = useRef<DrawingMode>(mode)
  const drawModeStartPositionRef = useRef<Position | null>(null)
  const positionRef = useRef<Position>(position)
  const [circleScale, setCircleScale] = useState(1)
  const circleAnimationRef = useRef<number | undefined>(undefined)

  // Update position ref
  useEffect(() => {
    positionRef.current = position
  }, [position])

  useEffect(() => {
    if (!visible || !sourceCanvas || !canvasRef.current) return

    const loupeCanvas = canvasRef.current
    const ctx = loupeCanvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, LOUPE_RADIUS * 2, LOUPE_RADIUS * 2)

    // Create circular clipping path
    ctx.save()
    ctx.beginPath()
    ctx.arc(LOUPE_RADIUS, LOUPE_RADIUS, LOUPE_RADIUS, 0, Math.PI * 2)
    ctx.clip()

    // Convert screen coordinates to canvas coordinates
    const canvasCoords = getCanvasCoordinates(position.x, position.y)
    const sourceX = canvasCoords.x
    const sourceY = canvasCoords.y

    // Draw magnified portion
    // The effective magnification is the current zoom scale * additional magnification factor
    const effectiveMagnification = scale * MAGNIFICATION_FACTOR
    const sourceSize = LOUPE_RADIUS / effectiveMagnification
    ctx.drawImage(
      sourceCanvas,
      sourceX - sourceSize,
      sourceY - sourceSize,
      sourceSize * 2,
      sourceSize * 2,
      0,
      0,
      LOUPE_RADIUS * 2,
      LOUPE_RADIUS * 2
    )

    // Draw center indicator with scale animation
    ctx.beginPath()
    ctx.arc(LOUPE_RADIUS, LOUPE_RADIUS, lineThickness * effectiveMagnification * 0.5 * circleScale, 0, Math.PI * 2)
    ctx.fillStyle = mode === 'draw' ? 'rgba(0, 0, 0, 1)' : 'rgba(0, 0, 0, 0.5)'
    ctx.fill()

    // Draw border
    ctx.restore()
    
    // Draw animated white border when stationary in adjust mode
    if (mode === 'adjust' && isStationary) {
      const progress = animationProgress
      
      // Draw partial white border (clockwise from top)
      ctx.beginPath()
      const startAngle = -Math.PI / 2  // Start from top
      const endAngle = startAngle + (progress * Math.PI * 2)
      ctx.arc(LOUPE_RADIUS, LOUPE_RADIUS, LOUPE_RADIUS - 1, startAngle, endAngle)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.lineWidth = 3
      ctx.stroke()
      
      // Draw remaining black border
      if (progress < 1) {
        ctx.beginPath()
        ctx.arc(LOUPE_RADIUS, LOUPE_RADIUS, LOUPE_RADIUS - 1, endAngle, startAngle + Math.PI * 2)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    } else {
      // Normal black border
      ctx.beginPath()
      ctx.arc(LOUPE_RADIUS, LOUPE_RADIUS, LOUPE_RADIUS - 1, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }, [visible, position, mode, isStationary, sourceCanvas, lineThickness, scale, imagePosition, getCanvasCoordinates, animationProgress, circleScale])

  // Handle flash effect, pen icon, and circle scale animation when entering draw mode
  useEffect(() => {
    if (mode === 'draw' && prevModeRef.current === 'adjust') {
      // Flash effect
      setIsFlashing(true)
      setShowPenIcon(true)
      setPenIconAnimationType('show')
      drawModeStartPositionRef.current = positionRef.current
      
      const flashTimer = setTimeout(() => {
        setIsFlashing(false)
      }, 100)
      
      // Circle scale animation
      const startTime = Date.now()
      const duration = 500 // 500ms animation
      
      const animateCircle = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        
        // Ease-out animation: scale up to 1.5x then back to 1x
        if (progress < 0.5) {
          // Scale up phase (0 to 0.5 progress)
          const scaleProgress = progress * 2 // 0 to 1
          setCircleScale(1 + scaleProgress) // 1 to 2
        } else {
          // Scale down phase (0.5 to 1 progress)
          const scaleProgress = (progress - 0.5) * 2 // 0 to 1
          setCircleScale(2 - scaleProgress) // 2 to 1
        }
        
        if (progress < 1) {
          circleAnimationRef.current = requestAnimationFrame(animateCircle)
        } else {
          setCircleScale(1)
        }
      }
      
      circleAnimationRef.current = requestAnimationFrame(animateCircle)
      
      return () => {
        clearTimeout(flashTimer)
        if (circleAnimationRef.current) {
          cancelAnimationFrame(circleAnimationRef.current)
        }
      }
    } else if (mode !== 'draw') {
      // Reset pen icon when leaving draw mode
      setShowPenIcon(false)
      drawModeStartPositionRef.current = null
    }
    prevModeRef.current = mode
  }, [mode])

  // Handle pen icon visibility based on movement in draw mode
  useEffect(() => {
    if (mode === 'draw' && showPenIcon && drawModeStartPositionRef.current) {
      let isActive = true
      
      const checkMovement = () => {
        if (!isActive || !drawModeStartPositionRef.current) return
        
        const startPos = drawModeStartPositionRef.current
        const currentPos = positionRef.current
        
        // Calculate distance moved
        const distanceMoved = Math.sqrt(
          Math.pow(currentPos.x - startPos.x, 2) + Math.pow(currentPos.y - startPos.y, 2)
        )
        
        // Hide pen icon if moved more than 5px
        if (distanceMoved > 5) {
          setPenIconAnimationType('hide')
          setTimeout(() => {
            if (isActive) {
              setShowPenIcon(false)
            }
          }, 200) // Wait for hide animation to complete
        } else {
          requestAnimationFrame(checkMovement)
        }
      }
      
      requestAnimationFrame(checkMovement)
      
      return () => {
        isActive = false
      }
    }
  }, [mode, showPenIcon])

  // Handle animation
  useEffect(() => {
    if (mode === 'adjust' && isStationary) {
      const startTime = Date.now()
      const delay = 350 // 0.35 seconds delay before starting
      const animationDuration = 650 // 0.65 seconds for the animation
      
      const animate = () => {
        const elapsed = Date.now() - startTime
        
        if (elapsed < delay) {
          // Still in delay period
          setAnimationProgress(0)
        } else {
          // Animation period
          const animationElapsed = elapsed - delay
          const progress = Math.min(animationElapsed / animationDuration, 1)
          setAnimationProgress(progress)
        }
        
        if (elapsed < delay + animationDuration) {
          animationFrameRef.current = requestAnimationFrame(animate)
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(animate)
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
      }
    } else {
      // Reset animation when not stationary
      setAnimationProgress(0)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [mode, isStationary])

  if (!visible) return null

  // Calculate loupe position
  const getLoupePosition = () => {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const loupeSize = LOUPE_RADIUS * 2

    let loupePosition: Position

    // Use the stored relative position or default to top-left
    const effectiveRelativePosition = relativePosition || 'top-left'
    loupePosition = calculateLoupeTopLeftPosition(position, effectiveRelativePosition)

    // Ensure loupe stays within viewport
    if (loupePosition.x + loupeSize > viewportWidth) {
      loupePosition.x = viewportWidth - loupeSize - 10
    }
    if (loupePosition.y + loupeSize > viewportHeight) {
      loupePosition.y = viewportHeight - loupeSize - 10
    }
    if (loupePosition.x < 10) {
      loupePosition.x = 10
    }
    if (loupePosition.y < 10) {
      loupePosition.y = 10
    }

    return loupePosition
  }

  const loupePosition = getLoupePosition()

  return (
    <div
      className="absolute pointer-events-none z-20"
      style={{
        left: `${loupePosition.x}px`,
        top: `${loupePosition.y}px`,
        width: LOUPE_RADIUS * 2,
        height: LOUPE_RADIUS * 2,
        borderRadius: '50%'
      }}
    >
      <canvas
        ref={canvasRef}
        width={LOUPE_RADIUS * 2}
        height={LOUPE_RADIUS * 2}
        style={{
          borderRadius: '50%',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
        }}
      />
      {isFlashing && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
            borderRadius: '50%',
            animation: 'flash 100ms ease-out'
          }}
        />
      )}
      {showPenIcon && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            animation: penIconAnimationType === 'show' 
              ? 'penIconShow 300ms ease-out forwards' 
              : 'penIconHide 200ms ease-out forwards'
          }}
        >
          <Pen
            size={24}
            className="text-black drop-shadow-sm"
            style={{
              filter: 'drop-shadow(0 0 2px rgba(255, 255, 255, 0.8))',
              transform: 'translate(12px, -12px)'
            }}
          />
        </div>
      )}
    </div>
  )
}