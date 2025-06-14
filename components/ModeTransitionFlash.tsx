import React, { useEffect, useState } from 'react'

interface ModeTransitionFlashProps {
  trigger: string | number
}

export default function ModeTransitionFlash({ trigger }: ModeTransitionFlashProps) {
  const [isFlashing, setIsFlashing] = useState(false)

  useEffect(() => {
    if (trigger) {
      setIsFlashing(true)
      const timer = setTimeout(() => {
        setIsFlashing(false)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [trigger])

  if (!isFlashing) return null

  return (
    <div
      className="fixed inset-0 pointer-events-none z-50"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        animation: 'flash 100ms ease-out'
      }}
    />
  )
}