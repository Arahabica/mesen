import { useState, useRef, useCallback } from 'react'
import { Position } from '@/types/editor'
import { LONG_PRESS_DURATION, CLICK_DISTANCE_THRESHOLD, ADJUST_MODE_DELAY, DRAW_MODE_DELAY, PINCH_DISTANCE_THRESHOLD, PINCH_CENTER_THRESHOLD } from '@/constants/editor'

type TouchMode = 'none' | 'move' | 'adjust' | 'draw'

export function useTouch() {
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null)
  const [hasMoved, setHasMoved] = useState(false)
  
  // Use ref for initial touch position to ensure timer has access to current value
  const initialTouchPosRef = useRef<Position | null>(null)
  
  // Mode management
  const currentModeRef = useRef<TouchMode>('none')
  const modeCheckTimerRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const adjustToDrawTimerRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const adjustModeStartTimeRef = useRef<number>(0)
  
  // Touch tracking
  const touchStartTimeRef = useRef<number>(0)
  const lastTouchPositionRef = useRef<Position | null>(null)
  const isStationaryRef = useRef(false)
  
  // Pinch tracking
  const isPinchingRef = useRef(false)
  const lastPinchCenterRef = useRef<Position | null>(null)
  const gestureTypeRef = useRef<'none' | 'pinch' | 'pan'>('none')
  const initialPinchDistanceRef = useRef<number | null>(null)
  const initialPinchCenterRef = useRef<Position | null>(null)
  
  // Double-tap detection
  const lastTapTimeRef = useRef<number>(0)
  const lastTapPositionRef = useRef<Position | null>(null)
  const doubleTapTimerRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const getTouchDistance = (touch1: React.Touch, touch2: React.Touch) => {
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    )
  }


  const startTouch = useCallback((touches: React.TouchList, onLongPress: () => void, onAdjustMode?: () => void, onDrawMode?: () => void) => {
    // Clear any existing timers
    if (modeCheckTimerRef.current) clearTimeout(modeCheckTimerRef.current)
    if (adjustToDrawTimerRef.current) clearTimeout(adjustToDrawTimerRef.current)
    
    if (touches.length >= 2) {
      // Pinch gesture
      isPinchingRef.current = true
      currentModeRef.current = 'move'
      const distance = getTouchDistance(touches[0], touches[1])
      setLastTouchDistance(distance)
      initialPinchDistanceRef.current = distance
      const center = {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
      }
      lastPinchCenterRef.current = center
      initialPinchCenterRef.current = center
      gestureTypeRef.current = 'none'
    } else if (touches.length === 1 && !isPinchingRef.current) {
      // Single touch
      const touch = touches[0]
      touchStartTimeRef.current = Date.now()
      initialTouchPosRef.current = { x: touch.clientX, y: touch.clientY }
      setHasMoved(false)
      currentModeRef.current = 'none'
      lastTouchPositionRef.current = { x: touch.clientX, y: touch.clientY }
      isStationaryRef.current = false
      
      // Check movement after 50ms to determine mode
      modeCheckTimerRef.current = setTimeout(() => {
        if (currentModeRef.current === 'none' && !isPinchingRef.current && initialTouchPosRef.current) {
          // Check movement distance after 100ms
          if (lastTouchPositionRef.current) {
            const distance = Math.sqrt(
              Math.pow(lastTouchPositionRef.current.x - initialTouchPosRef.current.x, 2) + 
              Math.pow(lastTouchPositionRef.current.y - initialTouchPosRef.current.y, 2)
            )
            
            if (distance > CLICK_DISTANCE_THRESHOLD) {
              // Movement detected - enter move mode
              currentModeRef.current = 'move'
              setHasMoved(true)
            } else {
              // No significant movement - enter adjust mode
              currentModeRef.current = 'adjust'
              adjustModeStartTimeRef.current = Date.now()
              if (onAdjustMode) {
                onAdjustMode()
                isStationaryRef.current = true
                
                // Start timer for draw mode transition
                adjustToDrawTimerRef.current = setTimeout(() => {
                  if (currentModeRef.current === 'adjust' && isStationaryRef.current && onDrawMode) {
                    currentModeRef.current = 'draw'
                    onDrawMode()
                  }
                }, DRAW_MODE_DELAY)
              }
            }
          } else {
            // No movement data - enter adjust mode
            currentModeRef.current = 'adjust'
            adjustModeStartTimeRef.current = Date.now()
            if (onAdjustMode) {
              onAdjustMode()
              isStationaryRef.current = true
              
              // Start timer for draw mode transition
              adjustToDrawTimerRef.current = setTimeout(() => {
                if (currentModeRef.current === 'adjust' && isStationaryRef.current && onDrawMode) {
                  currentModeRef.current = 'draw'
                  onDrawMode()
                }
              }, DRAW_MODE_DELAY)
            }
          }
        }
      }, 100)
    }
  }, [])

  const moveTouch = useCallback((touches: React.TouchList) => {
    if (isPinchingRef.current || touches.length >= 2) return
    
    if (touches.length === 1) {
      const touch = touches[0]
      const currentPos = { x: touch.clientX, y: touch.clientY }
      
      // Early move mode detection: if in adjust mode but just entered (within 200ms), 
      // allow switching to move mode on significant movement
      if (currentModeRef.current === 'adjust' && adjustModeStartTimeRef.current > 0) {
        const timeSinceAdjustMode = Date.now() - adjustModeStartTimeRef.current
        if (timeSinceAdjustMode < 200 && initialTouchPosRef.current) {
          const totalDistance = Math.sqrt(
            Math.pow(currentPos.x - initialTouchPosRef.current.x, 2) + 
            Math.pow(currentPos.y - initialTouchPosRef.current.y, 2)
          )
          
          if (totalDistance > CLICK_DISTANCE_THRESHOLD * 2) { // 6px threshold for early movement detection
            currentModeRef.current = 'move'
            setHasMoved(true)
            
            // Clear adjust mode timers
            if (adjustToDrawTimerRef.current) {
              clearTimeout(adjustToDrawTimerRef.current)
              adjustToDrawTimerRef.current = undefined
            }
            
            // Update position and return early
            lastTouchPositionRef.current = currentPos
            return
          }
        }
      }
      
      // In adjust mode, check if finger is stationary for draw mode transition
      if (currentModeRef.current === 'adjust') {
        const prevPos = lastTouchPositionRef.current
        if (prevPos) {
          const moveDistance = Math.sqrt(
            Math.pow(currentPos.x - prevPos.x, 2) + 
            Math.pow(currentPos.y - prevPos.y, 2)
          )
          
          // Update stationary state
          const wasStationary = isStationaryRef.current
          isStationaryRef.current = moveDistance <= 1
          
          // Restart draw mode timer if finger stopped moving
          if (!wasStationary && isStationaryRef.current && !adjustToDrawTimerRef.current) {
            adjustToDrawTimerRef.current = setTimeout(() => {
              if (currentModeRef.current === 'adjust' && isStationaryRef.current) {
                currentModeRef.current = 'draw'
                // Note: onDrawMode callback will be handled in ImageEditor
              }
            }, DRAW_MODE_DELAY)
          }
          
          // Clear draw mode timer if moving
          if (wasStationary && !isStationaryRef.current && adjustToDrawTimerRef.current) {
            clearTimeout(adjustToDrawTimerRef.current)
            adjustToDrawTimerRef.current = undefined
          }
        }
      }
      
      // Update current position for next frame
      lastTouchPositionRef.current = currentPos
    }
  }, [])

  const endTouch = useCallback((touches: React.TouchList) => {
    if (touches.length === 0) {
      // All fingers lifted - reset everything
      isPinchingRef.current = false
      setLastTouchDistance(null)
      lastPinchCenterRef.current = null
      gestureTypeRef.current = 'none'
      initialPinchDistanceRef.current = null
      initialPinchCenterRef.current = null
      
      // Clear timers
      if (modeCheckTimerRef.current) clearTimeout(modeCheckTimerRef.current)
      if (adjustToDrawTimerRef.current) clearTimeout(adjustToDrawTimerRef.current)
      
      // Reset states
      currentModeRef.current = 'none'
      initialTouchPosRef.current = null
      setHasMoved(false)
      lastTouchPositionRef.current = null
      isStationaryRef.current = false
      adjustModeStartTimeRef.current = 0
    } else if (touches.length === 1 && isPinchingRef.current) {
      // One finger still down after pinch
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

  const checkDoubleTap = useCallback((position: Position) => {
    const now = Date.now()
    const timeDiff = now - lastTapTimeRef.current
    
    // Check if this is a potential double tap (within 300ms of last tap)
    if (lastTapPositionRef.current && timeDiff < 300) {
      const distance = Math.sqrt(
        Math.pow(position.x - lastTapPositionRef.current.x, 2) +
        Math.pow(position.y - lastTapPositionRef.current.y, 2)
      )
      
      // If taps are close enough, it's a double tap
      if (distance < 30) {
        // Clear the timer to prevent single tap callback
        if (doubleTapTimerRef.current) {
          clearTimeout(doubleTapTimerRef.current)
          doubleTapTimerRef.current = undefined
        }
        lastTapTimeRef.current = 0
        lastTapPositionRef.current = null
        return true
      }
    }
    
    // Record this tap for next time
    lastTapTimeRef.current = now
    lastTapPositionRef.current = position
    return false
  }, [])

  const cleanup = useCallback(() => {
    if (modeCheckTimerRef.current) clearTimeout(modeCheckTimerRef.current)
    if (adjustToDrawTimerRef.current) clearTimeout(adjustToDrawTimerRef.current)
    if (doubleTapTimerRef.current) clearTimeout(doubleTapTimerRef.current)
  }, [])

  return {
    currentMode: currentModeRef.current,
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
    checkDoubleTap,
    cleanup
  }
}