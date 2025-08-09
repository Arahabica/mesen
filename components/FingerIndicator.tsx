import React from 'react'
import { Position } from '@/types/editor'

interface FingerIndicatorProps {
  visible: boolean
  positions: Position[]  // Support multiple fingers
}

const FINGER_WIDTH = 50
const FINGER_HEIGHT = 50

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
            top: `${position.y - FINGER_HEIGHT + 20}px`, // Position so fingertip is at touch point
            width: FINGER_WIDTH,
            height: FINGER_HEIGHT,
            borderRadius: `25px 25px 0 0 / 22px 22px 0 0`,
            backgroundColor: '#F5C2A0',
            opacity: 0.9,
          }}
        />
      ))}
    </>
  )
}