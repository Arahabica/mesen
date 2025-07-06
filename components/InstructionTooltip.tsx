import React, { useEffect, useState } from 'react'

interface InstructionTooltipProps {
  visible: boolean
  onHide: () => void
}

export default function InstructionTooltip({ visible, onHide }: InstructionTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isFadingIn, setIsFadingIn] = useState(false)

  const fadeOut = () => {
    setIsAnimating(true)
    // Wait for animation to complete before hiding
    setTimeout(() => {
      setIsVisible(false)
      setIsAnimating(false)
      onHide()
    }, 300) // Match the animation duration
  }

  useEffect(() => {
    if (visible) {
      setIsVisible(true)
      setIsAnimating(false)
      setIsFadingIn(true)
      
      // Start fade in animation
      const fadeInTimer = setTimeout(() => {
        setIsFadingIn(false)
      }, 350) // Match the animation duration
      
      // Auto hide after 3 seconds
      const autoHideTimer = setTimeout(() => {
        fadeOut()
      }, 3000)

      return () => {
        clearTimeout(fadeInTimer)
        clearTimeout(autoHideTimer)
      }
    }
  }, [visible, onHide])

  const handleTouch = () => {
    if (visible && !isAnimating) {
      // Hide after 200ms when touched
      setTimeout(() => {
        fadeOut()
      }, 700)
    }
  }

  if (!isVisible) return null

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-50 transition-opacity duration-300 pointer-events-none ${
        isAnimating ? 'opacity-0' : isFadingIn ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div 
        className="bg-gray-800 bg-opacity-80 rounded-2xl px-8 py-6 shadow-lg backdrop-blur-sm pointer-events-auto"
        onTouchStart={handleTouch}
        onClick={handleTouch}
      >
        <div className="flex flex-col items-center space-y-4">
          <div className="w-32 h-32 flex items-center justify-center">
            <img 
              src="/long_touch.svg" 
              alt="長押しアイコン" 
              className="w-28 h-28"
            />
          </div>
          <p className="text-white text-lg font-medium text-center">
            長押しで目線が引けます
          </p>
        </div>
      </div>
    </div>
  )
}