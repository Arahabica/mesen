import React from 'react'
import { Position } from '@/types/editor'

interface FingerIndicatorProps {
  visible: boolean
  positions: Position[]  // Support multiple fingers
}

const FINGER_WIDTH = 50
const FINGER_HEIGHT = 60

export default function FingerIndicator({ visible, positions }: FingerIndicatorProps) {
  if (!visible || positions.length === 0) return null

  return (
    <>
      {positions.map((position, index) => (
        <div
          key={index}
          className="absolute pointer-events-none z-30"
          style={{
            left: `${position.x - FINGER_WIDTH / 2}px`,
            top: `${position.y - FINGER_HEIGHT + 40}px`, // Position so fingertip is at touch point
            width: FINGER_WIDTH,
            height: FINGER_HEIGHT,
            borderRadius: `25px 25px 0 0 / 22px 22px 0 0`,
            background: `linear-gradient(to bottom, 
              #F5C2A0 0%, 
              #F5C2A0 50%, 
              rgba(245, 194, 160, 0.7) 70%, 
              rgba(245, 194, 160, 0.3) 80%, 
              rgba(245, 194, 160, 0.1) 90%, 
              transparent 100%)`,
            opacity: 0.8,
          }}
        />
      ))}
    </>
  )
}