import { useState, useRef, useCallback } from 'react'
import { Position } from '@/types/editor'
import { LONG_PRESS_DURATION, CLICK_DISTANCE_THRESHOLD, ADJUST_MODE_DELAY, DRAW_MODE_DELAY, PINCH_DISTANCE_THRESHOLD, PINCH_CENTER_THRESHOLD } from '@/constants/editor'

export function useTouch() {
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null)
  const [initialTouchPos, setInitialTouchPos] = useState<Position | null>(null)
  const [hasMoved, setHasMoved] = useState(false)
  const longPressTimerRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const isPinchingRef = useRef(false)
  const touchStartTimeRef = useRef<number>(0)
  const adjustModeTimerRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const drawModeTimerRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const lastTouchPositionRef = useRef<Position | null>(null)
  const isInAdjustModeRef = useRef(false)
  const lastPinchCenterRef = useRef<Position | null>(null)
  const isStationaryRef = useRef(false)
  const stationaryStartPosRef = useRef<Position | null>(null)
  const gestureTypeRef = useRef<'none' | 'pinch' | 'pan'>('none')
  const initialPinchDistanceRef = useRef<number | null>(null)
  const initialPinchCenterRef = useRef<Position | null>(null)

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
      initialPinchDistanceRef.current = distance
      // Set initial pinch center
      const center = {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
      }
      lastPinchCenterRef.current = center
      initialPinchCenterRef.current = center
      // Reset gesture type - will be determined on first move
      gestureTypeRef.current = 'none'
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
      
      // Start adjust mode after 0.2s
      adjustModeTimerRef.current = setTimeout(() => {
        if (!hasMovedRef.current && onAdjustMode && !isPinchingRef.current) {
          onAdjustMode()
          isInAdjustModeRef.current = true
          // Initialize as non-stationary when entering adjust mode
          isStationaryRef.current = false
          lastTouchPositionRef.current = { x: touch.clientX, y: touch.clientY }
        }
      }, ADJUST_MODE_DELAY)
      
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
      if (isInAdjustModeRef.current) {
        if (lastTouchPositionRef.current) {
          const frameDistance = Math.sqrt(
            Math.pow(currentPos.x - lastTouchPositionRef.current.x, 2) + 
            Math.pow(currentPos.y - lastTouchPositionRef.current.y, 2)
          )
          
          // Check movement from stationary start position
          let totalDistance = 0
          if (stationaryStartPosRef.current) {
            totalDistance = Math.sqrt(
              Math.pow(currentPos.x - stationaryStartPosRef.current.x, 2) + 
              Math.pow(currentPos.y - stationaryStartPosRef.current.y, 2)
            )
          }
          
          // Clear timer if moving (check both frame and total distance)
          if (frameDistance > 1 || totalDistance > 3) {
            isStationaryRef.current = false
            stationaryStartPosRef.current = null
            if (drawModeTimerRef.current) {
              clearTimeout(drawModeTimerRef.current)
              drawModeTimerRef.current = undefined
            }
          } else if (frameDistance <= 1 && !drawModeTimerRef.current && onDrawMode) {
            // Start new timer if finger stopped
            if (!stationaryStartPosRef.current) {
              stationaryStartPosRef.current = currentPos
            }
            isStationaryRef.current = true
            drawModeTimerRef.current = setTimeout(() => {
              if (isInAdjustModeRef.current && onDrawMode && !isPinchingRef.current) {
                onDrawMode()
              }
            }, DRAW_MODE_DELAY)
          }
        } else {
          // First position in adjust mode - don't start timer immediately
          lastTouchPositionRef.current = currentPos
          isStationaryRef.current = false
          stationaryStartPosRef.current = null
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
      gestureTypeRef.current = 'none'
      initialPinchDistanceRef.current = null
      initialPinchCenterRef.current = null
      
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
      isStationaryRef.current = false
      stationaryStartPosRef.current = null
    } else if (touches.length === 1 && isPinchingRef.current) {
      // Keep pinch state active if one finger is still down
      setLastTouchDistance(null)
      lastPinchCenterRef.current = null
    }
  }, [])

  const getPinchScale = useCallback((touches: React.TouchList) => {
    if (touches.length === 2 && lastTouchDistance !== null && isPinchingRef.current) {
      const currentDistance = getTouchDistance(touches[0], touches[1])
      
      // Determine gesture type on first significant movement
      if (gestureTypeRef.current === 'none' && initialPinchDistanceRef.current && initialPinchCenterRef.current) {
        const distanceChange = Math.abs(currentDistance - initialPinchDistanceRef.current)
        const currentCenter = {
          x: (touches[0].clientX + touches[1].clientX) / 2,
          y: (touches[0].clientY + touches[1].clientY) / 2
        }
        const centerChange = Math.sqrt(
          Math.pow(currentCenter.x - initialPinchCenterRef.current.x, 2) +
          Math.pow(currentCenter.y - initialPinchCenterRef.current.y, 2)
        )
        
        // If distance changed more than center moved, it's a pinch
        // Use a threshold to avoid false detection
        if (distanceChange > PINCH_DISTANCE_THRESHOLD || centerChange > PINCH_CENTER_THRESHOLD) {
          gestureTypeRef.current = distanceChange > centerChange * 1.5 ? 'pinch' : 'pan'
        }
      }
      
      // Only return scale if gesture is pinch
      if (gestureTypeRef.current === 'pinch') {
        const scale = currentDistance / lastTouchDistance
        setLastTouchDistance(currentDistance)
        return scale
      } else {
        // Keep updating distance for potential gesture type change
        setLastTouchDistance(currentDistance)
      }
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
      
      // Determine gesture type on first significant movement if not yet determined
      if (gestureTypeRef.current === 'none' && initialPinchDistanceRef.current && initialPinchCenterRef.current) {
        const currentDistance = getTouchDistance(touches[0], touches[1])
        const distanceChange = Math.abs(currentDistance - initialPinchDistanceRef.current)
        const centerChange = Math.sqrt(
          Math.pow(currentCenter.x - initialPinchCenterRef.current.x, 2) +
          Math.pow(currentCenter.y - initialPinchCenterRef.current.y, 2)
        )
        
        if (distanceChange > PINCH_DISTANCE_THRESHOLD || centerChange > PINCH_CENTER_THRESHOLD) {
          gestureTypeRef.current = distanceChange > centerChange * 1.5 ? 'pinch' : 'pan'
        }
      }
      
      // Only return delta if gesture is pan
      if (gestureTypeRef.current === 'pan') {
        const delta = {
          x: currentCenter.x - lastPinchCenterRef.current.x,
          y: currentCenter.y - lastPinchCenterRef.current.y
        }
        lastPinchCenterRef.current = currentCenter
        return delta
      } else {
        // Keep updating center for potential gesture type change
        lastPinchCenterRef.current = currentCenter
      }
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
    gestureType: gestureTypeRef.current,
    hasMoved,
    isStationary: isStationaryRef.current,
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