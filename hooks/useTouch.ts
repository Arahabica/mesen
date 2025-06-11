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

  const getTouchDistance = (touch1: React.Touch, touch2: React.Touch) => {
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    )
  }

  const startTouch = useCallback((touches: React.TouchList, onLongPress: () => void) => {
    if (touches.length === 2) {
      isPinchingRef.current = true
      const distance = getTouchDistance(touches[0], touches[1])
      setLastTouchDistance(distance)
    } else if (touches.length === 1) {
      const touch = touches[0]
      touchStartTimeRef.current = Date.now()
      setInitialTouchPos({ x: touch.clientX, y: touch.clientY })
      setHasMoved(false)
      
      longPressTimerRef.current = setTimeout(() => {
        if (!hasMoved) {
          onLongPress()
        }
      }, LONG_PRESS_DURATION)
    }
  }, [hasMoved])

  const moveTouch = useCallback((touches: React.TouchList) => {
    if (touches.length === 1 && initialTouchPos && !hasMoved) {
      const touch = touches[0]
      const distance = Math.sqrt(
        Math.pow(touch.clientX - initialTouchPos.x, 2) + 
        Math.pow(touch.clientY - initialTouchPos.y, 2)
      )
      if (distance > CLICK_DISTANCE_THRESHOLD) {
        setHasMoved(true)
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current)
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