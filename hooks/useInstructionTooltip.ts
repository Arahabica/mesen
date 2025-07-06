import { useState, useCallback } from 'react'
import { INSTRUCTION_TOOLTIP_INTERVAL } from '@/constants/editor'

// localStorage key for instruction tooltip
const INSTRUCTION_LAST_SHOWN_KEY = 'mesen_instruction_last_shown'

// Check if instruction should be shown based on localStorage
const shouldShowInstruction = (): boolean => {
  try {
    const lastShown = localStorage.getItem(INSTRUCTION_LAST_SHOWN_KEY)
    if (!lastShown) return true
    
    const lastShownTime = parseInt(lastShown, 10)
    if (isNaN(lastShownTime)) return true
    
    const timeSinceLastShown = Date.now() - lastShownTime
    return timeSinceLastShown >= INSTRUCTION_TOOLTIP_INTERVAL
  } catch (error) {
    // localStorage is not available (e.g., incognito mode)
    return true
  }
}

// Mark instruction as shown in localStorage
const markInstructionAsShown = (): void => {
  try {
    localStorage.setItem(INSTRUCTION_LAST_SHOWN_KEY, Date.now().toString())
  } catch (error) {
    // localStorage is not available, silently fail
  }
}

export function useInstructionTooltip() {
  const [showInstructionTooltip, setShowInstructionTooltip] = useState(false)

  const showInstruction = useCallback(() => {
    if (shouldShowInstruction()) {
      setTimeout(() => {
        setShowInstructionTooltip(true)
        markInstructionAsShown()
      }, 400) // 0.4 seconds delay
    }
  }, [])

  const hideInstruction = useCallback(() => {
    setShowInstructionTooltip(false)
  }, [])

  return {
    showInstructionTooltip,
    showInstruction,
    hideInstruction
  }
}