import { useState, useRef, useCallback } from 'react'
import { Position } from '@/types/editor'
import { LONG_PRESS_DURATION, CLICK_DISTANCE_THRESHOLD } from '@/constants/editor'

export function useTouch() {
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null)
  const [initialTouchPos, setInitialTouchPos] = useState<Position | null>(null)
  const [hasMoved, setHasMoved] = useState(false)
  const longPressTimerRef = useRef<NodeJS.Timeout>()
  const isPinchingRef = useRef(false)
  const touchStartTimeRef = useRef<number>(0)
  const adjustModeTimerRef = useRef<NodeJS.Timeout>()
  const drawModeTimerRef = useRef<NodeJS.Timeout>()
  const lastTouchPositionRef = useRef<Position | null>(null)
  const isInAdjustModeRef = useRef(false)
  const lastPinchCenterRef = useRef<Position | null>(null)

  const getTouchDistance = (touch1: React.Touch, touch2: React.Touch) => {
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    )
  }

  const hasMovedRef = useRef(false)

  const startTouch = useCallback((touches: React.TouchList, onLongPress: () => void, onAdjustMode?: () => void, onDrawMode?: () => void) => {
    if (touches.length >= 2) {
      isPinchingRef.current = true
      const distance = getTouchDistance(touches[0], touches[1])
      setLastTouchDistance(distance)
      // Set initial pinch center
      lastPinchCenterRef.current = {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
      }
      // Clear any timers when starting pinch
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
      if (adjustModeTimerRef.current) clearTimeout(adjustModeTimerRef.current)
      if (drawModeTimerRef.current) clearTimeout(drawModeTimerRef.current)
    } else if (touches.length === 1 && !isPinchingRef.current) {
      const touch = touches[0]
      touchStartTimeRef.current = Date.now()
      setInitialTouchPos({ x: touch.clientX, y: touch.clientY })
      setHasMoved(false)
      hasMovedRef.current = false
      
      // Start adjust mode after 0.5s
      adjustModeTimerRef.current = setTimeout(() => {
        if (!hasMovedRef.current && onAdjustMode && !isPinchingRef.current) {
          onAdjustMode()
          isInAdjustModeRef.current = true
        }
      }, LONG_PRESS_DURATION)
      
      // Legacy long press for line selection - disabled when using loupe mode
      if (!onAdjustMode) {
        longPressTimerRef.current = setTimeout(() => {
          if (!hasMovedRef.current && !isPinchingRef.current) {
            onLongPress()
          }
        }, LONG_PRESS_DURATION)
      }
    }
  }, [])

  const moveTouch = useCallback((touches: React.TouchList, onDrawMode?: () => void) => {
    // Don't process if pinching
    if (isPinchingRef.current || touches.length >= 2) return
    
    if (touches.length === 1) {
      const touch = touches[0]
      const currentPos = { x: touch.clientX, y: touch.clientY }
      
      // Check if moved from initial position
      if (initialTouchPos && !hasMoved) {
        const distance = Math.sqrt(
          Math.pow(touch.clientX - initialTouchPos.x, 2) + 
          Math.pow(touch.clientY - initialTouchPos.y, 2)
        )
        if (distance > CLICK_DISTANCE_THRESHOLD) {
          setHasMoved(true)
          hasMovedRef.current = true
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current)
          }
          if (adjustModeTimerRef.current) {
            clearTimeout(adjustModeTimerRef.current)
          }
          if (drawModeTimerRef.current) {
            clearTimeout(drawModeTimerRef.current)
          }
        }
      }
      
      // In adjust mode, check if finger has stopped moving
      if (isInAdjustModeRef.current && lastTouchPositionRef.current) {
        const moveDistance = Math.sqrt(
          Math.pow(currentPos.x - lastTouchPositionRef.current.x, 2) + 
          Math.pow(currentPos.y - lastTouchPositionRef.current.y, 2)
        )
        
        // Clear existing timer if finger is moving
        if (moveDistance > 2 && drawModeTimerRef.current) {
          clearTimeout(drawModeTimerRef.current)
          drawModeTimerRef.current = undefined
        }
        
        // Start new timer if finger stopped
        if (moveDistance <= 2 && !drawModeTimerRef.current && onDrawMode) {
          drawModeTimerRef.current = setTimeout(() => {
            if (isInAdjustModeRef.current && onDrawMode && !isPinchingRef.current) {
              onDrawMode()
            }
          }, LONG_PRESS_DURATION)
        }
      }
      
      lastTouchPositionRef.current = currentPos
    }
  }, [initialTouchPos, hasMoved])

  const endTouch = useCallback((touches: React.TouchList) => {
    // Only reset pinch state when ALL fingers are lifted
    if (touches.length === 0) {
      isPinchingRef.current = false
      setLastTouchDistance(null)
      lastPinchCenterRef.current = null
      
      // Clear all timers
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
      }
      if (adjustModeTimerRef.current) {
        clearTimeout(adjustModeTimerRef.current)
      }
      if (drawModeTimerRef.current) {
        clearTimeout(drawModeTimerRef.current)
      }
      
      // Reset all states
      setInitialTouchPos(null)
      setHasMoved(false)
      isInAdjustModeRef.current = false
      lastTouchPositionRef.current = null
    } else if (touches.length === 1 && isPinchingRef.current) {
      // Keep pinch state active if one finger is still down
      setLastTouchDistance(null)
      lastPinchCenterRef.current = null
    }
  }, [])

  const getPinchScale = useCallback((touches: React.TouchList) => {
    if (touches.length === 2 && lastTouchDistance !== null && isPinchingRef.current) {
      const currentDistance = getTouchDistance(touches[0], touches[1])
      const scale = currentDistance / lastTouchDistance
      setLastTouchDistance(currentDistance)
      return scale
    }
    return null
  }, [lastTouchDistance])

  const getPinchCenter = (touches: React.TouchList) => {
    if (touches.length === 2) {
      return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
      }
    }
    return null
  }
  
  const getPinchCenterDelta = useCallback((touches: React.TouchList) => {
    if (touches.length === 2 && lastPinchCenterRef.current && isPinchingRef.current) {
      const currentCenter = {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
      }
      const delta = {
        x: currentCenter.x - lastPinchCenterRef.current.x,
        y: currentCenter.y - lastPinchCenterRef.current.y
      }
      lastPinchCenterRef.current = currentCenter
      return delta
    }
    return null
  }, [])

  const isQuickTap = useCallback(() => {
    return Date.now() - touchStartTimeRef.current < LONG_PRESS_DURATION && !hasMoved
  }, [hasMoved])

  const cleanup = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
    }
    if (adjustModeTimerRef.current) {
      clearTimeout(adjustModeTimerRef.current)
    }
    if (drawModeTimerRef.current) {
      clearTimeout(drawModeTimerRef.current)
    }
  }, [])

  return {
    isPinching: isPinchingRef.current,
    hasMoved,
    startTouch,
    moveTouch,
    endTouch,
    getPinchScale,
    getPinchCenter,
    getPinchCenterDelta,
    isQuickTap,
    cleanup
  }
}