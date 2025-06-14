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

  const getTouchDistance = (touch1: React.Touch, touch2: React.Touch) => {
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    )
  }

  const hasMovedRef = useRef(false)

  const startTouch = useCallback((touches: React.TouchList, onLongPress: () => void, onAdjustMode?: () => void, onDrawMode?: () => void) => {
    if (touches.length === 2) {
      isPinchingRef.current = true
      const distance = getTouchDistance(touches[0], touches[1])
      setLastTouchDistance(distance)
    } else if (touches.length === 1) {
      const touch = touches[0]
      touchStartTimeRef.current = Date.now()
      setInitialTouchPos({ x: touch.clientX, y: touch.clientY })
      setHasMoved(false)
      hasMovedRef.current = false
      
      // Start adjust mode after 0.5s
      adjustModeTimerRef.current = setTimeout(() => {
        if (!hasMovedRef.current && onAdjustMode) {
          onAdjustMode()
          
          // Start draw mode after another 0.5s
          drawModeTimerRef.current = setTimeout(() => {
            if (!hasMovedRef.current && onDrawMode) {
              onDrawMode()
            }
          }, LONG_PRESS_DURATION)
        }
      }, LONG_PRESS_DURATION)
      
      // Legacy long press for line selection - disabled when using loupe mode
      if (!onAdjustMode) {
        longPressTimerRef.current = setTimeout(() => {
          if (!hasMovedRef.current) {
            onLongPress()
          }
        }, LONG_PRESS_DURATION)
      }
    }
  }, [])

  const moveTouch = useCallback((touches: React.TouchList) => {
    if (touches.length === 1 && initialTouchPos && !hasMoved) {
      const touch = touches[0]
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
  }, [initialTouchPos, hasMoved])

  const endTouch = useCallback((touches: React.TouchList) => {
    if (touches.length === 0) {
      isPinchingRef.current = false
      setLastTouchDistance(null)
    }
    
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
    }
    if (adjustModeTimerRef.current) {
      clearTimeout(adjustModeTimerRef.current)
    }
    if (drawModeTimerRef.current) {
      clearTimeout(drawModeTimerRef.current)
    }
    
    setInitialTouchPos(null)
    setHasMoved(false)
  }, [])

  const getPinchScale = useCallback((touches: React.TouchList) => {
    if (touches.length === 2 && lastTouchDistance !== null) {
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
    isQuickTap,
    cleanup
  }
}