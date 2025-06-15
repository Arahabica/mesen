import React, { useEffect, useRef, useState } from 'react'
import { Position, DrawingMode, LoupeRelativePosition } from '@/types/editor'

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
  initialPosition?: Position  // Initial position when entering adjust mode
  relativePosition?: LoupeRelativePosition
}

const LOUPE_RADIUS = 50
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
  initialPosition,
  relativePosition
}: LoupeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [animationProgress, setAnimationProgress] = useState(0)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const [isFlashing, setIsFlashing] = useState(false)
  const prevModeRef = useRef<DrawingMode>(mode)

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

    // Draw center indicator
    ctx.beginPath()
    ctx.arc(LOUPE_RADIUS, LOUPE_RADIUS, lineThickness * effectiveMagnification / 2, 0, Math.PI * 2)
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
  }, [visible, position, mode, isStationary, sourceCanvas, lineThickness, scale, imagePosition, getCanvasCoordinates, animationProgress])

  // Handle flash effect when entering draw mode
  useEffect(() => {
    if (mode === 'draw' && prevModeRef.current === 'adjust') {
      setIsFlashing(true)
      const timer = setTimeout(() => {
        setIsFlashing(false)
      }, 100)
      return () => clearTimeout(timer)
    }
    prevModeRef.current = mode
  }, [mode])

  // Handle animation
  useEffect(() => {
    if (mode === 'adjust' && isStationary) {
      const startTime = Date.now()
      const delay = 500 // 0.5 seconds delay before starting
      const animationDuration = 500 // 0.5 seconds for the animation
      
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
    const distanceFromFinger = 30 // Fixed distance from finger to loupe edge
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const loupeSize = LOUPE_RADIUS * 2

    let loupeX: number
    let loupeY: number

    // If we have a stored relative position, use it
    if (relativePosition) {
      // Calculate total distance from finger center to loupe center
      const distanceToCenter = distanceFromFinger + LOUPE_RADIUS
      
      switch (relativePosition) {
        case 'top-left':
          // 225 degrees (down-left)
          loupeX = position.x + distanceToCenter * Math.cos(225 * Math.PI / 180) - LOUPE_RADIUS
          loupeY = position.y + distanceToCenter * Math.sin(225 * Math.PI / 180) - LOUPE_RADIUS
          break
        case 'top-left-top':
          // 202.5 degrees (between down-left and down)
          loupeX = position.x + distanceToCenter * Math.cos(202.5 * Math.PI / 180) - LOUPE_RADIUS
          loupeY = position.y + distanceToCenter * Math.sin(202.5 * Math.PI / 180) - LOUPE_RADIUS
          break
        case 'top':
          // 270 degrees (straight up)
          loupeX = position.x + distanceToCenter * Math.cos(270 * Math.PI / 180) - LOUPE_RADIUS
          loupeY = position.y + distanceToCenter * Math.sin(270 * Math.PI / 180) - LOUPE_RADIUS
          break
        case 'top-top-right':
          // 337.5 degrees (between up and up-right)
          loupeX = position.x + distanceToCenter * Math.cos(337.5 * Math.PI / 180) - LOUPE_RADIUS
          loupeY = position.y + distanceToCenter * Math.sin(337.5 * Math.PI / 180) - LOUPE_RADIUS
          break
        case 'top-right':
          // 315 degrees (up-right)
          loupeX = position.x + distanceToCenter * Math.cos(315 * Math.PI / 180) - LOUPE_RADIUS
          loupeY = position.y + distanceToCenter * Math.sin(315 * Math.PI / 180) - LOUPE_RADIUS
          break
        case 'bottom-right':
          // 45 degrees (down-right)
          loupeX = position.x + distanceToCenter * Math.cos(45 * Math.PI / 180) - LOUPE_RADIUS
          loupeY = position.y + distanceToCenter * Math.sin(45 * Math.PI / 180) - LOUPE_RADIUS
          break
        case 'bottom-left':
          // 135 degrees (down-left)
          loupeX = position.x + distanceToCenter * Math.cos(135 * Math.PI / 180) - LOUPE_RADIUS
          loupeY = position.y + distanceToCenter * Math.sin(135 * Math.PI / 180) - LOUPE_RADIUS
          break
      }
    } else {
      // Initial positioning logic (prefer top-left)
      const distanceToCenter = distanceFromFinger + LOUPE_RADIUS
      loupeX = position.x + distanceToCenter * Math.cos(225 * Math.PI / 180) - LOUPE_RADIUS
      loupeY = position.y + distanceToCenter * Math.sin(225 * Math.PI / 180) - LOUPE_RADIUS

      // If not enough space on left, try right
      if (loupeX < 0) {
        loupeX = position.x + distanceToCenter * Math.cos(315 * Math.PI / 180) - LOUPE_RADIUS
      }

      // If not enough space on top, try bottom
      if (loupeY < 0) {
        loupeY = position.y + distanceToCenter * Math.sin(45 * Math.PI / 180) - LOUPE_RADIUS
      }
    }

    // Ensure loupe stays within viewport
    if (loupeX + loupeSize > viewportWidth) {
      loupeX = viewportWidth - loupeSize - 10
    }
    if (loupeY + loupeSize > viewportHeight) {
      loupeY = viewportHeight - loupeSize - 10
    }
    if (loupeX < 10) {
      loupeX = 10
    }
    if (loupeY < 10) {
      loupeY = 10
    }

    return { x: loupeX, y: loupeY }
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
    </div>
  )
}