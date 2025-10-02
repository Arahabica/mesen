import React from 'react'
import { Trash2 } from 'lucide-react'
import { DELETE_ZONE_HEIGHT } from '@/constants/editor'

interface DeleteZoneProps {
  visible: boolean
  position: 'top' | 'bottom'
  isNearby: boolean
}

export default function DeleteZone({ visible, position, isNearby }: DeleteZoneProps) {
  if (!visible) return null

  const positionStyles = position === 'top'
    ? { top: 0 }
    : { bottom: 0 }

  return (
    <div
      className="fixed left-0 right-0 z-20 pointer-events-none"
      style={{
        ...positionStyles,
        height: `${DELETE_ZONE_HEIGHT}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease-out'
      }}
    >
      <div
        className={`flex items-center justify-center rounded-full transition-all duration-200 ${
          isNearby
            ? 'bg-red-500 w-16 h-16 shadow-lg shadow-red-500/50'
            : 'bg-gray-700 w-12 h-12'
        }`}
        style={{
          transform: isNearby ? 'scale(1.2)' : 'scale(1)',
        }}
      >
        <Trash2
          size={isNearby ? 28 : 24}
          className={`transition-colors duration-200 ${
            isNearby ? 'text-white' : 'text-gray-300'
          }`}
        />
      </div>
    </div>
  )
}
