import { LoupeRelativePosition, Position } from '@/types/editor'

export const DISTANCE_FROM_FINGER = 30
export const LOUPE_RADIUS = 50

const POSITION_ANGLES: Record<LoupeRelativePosition, number> = {
  'top-left': 225,
  'top-left-top': 247.5,
  'top': 270,
  'top-top-right': 292.5,
  'top-right': 315,
  'bottom-right': 45,
  'bottom-left': 135,
}

/**
 * Calculate loupe center position based on finger position and relative position
 */
export function calculateLoupeCenterPosition(
  fingerPosition: Position,
  relativePosition: LoupeRelativePosition
): Position {
  const distanceToCenter = DISTANCE_FROM_FINGER + LOUPE_RADIUS
  const angle = POSITION_ANGLES[relativePosition]
  const angleRad = angle * Math.PI / 180

  return {
    x: fingerPosition.x + distanceToCenter * Math.cos(angleRad),
    y: fingerPosition.y + distanceToCenter * Math.sin(angleRad),
  }
}

/**
 * Calculate loupe top-left position for rendering
 */
export function calculateLoupeTopLeftPosition(
  fingerPosition: Position,
  relativePosition: LoupeRelativePosition
): Position {
  const centerPosition = calculateLoupeCenterPosition(fingerPosition, relativePosition)
  return {
    x: centerPosition.x - LOUPE_RADIUS,
    y: centerPosition.y - LOUPE_RADIUS,
  }
}

/**
 * Check if loupe position fits within viewport
 */
export function checkLoupePositionFits(
  fingerPosition: Position,
  relativePosition: LoupeRelativePosition,
  viewportWidth: number,
  viewportHeight: number
): boolean {
  const centerPosition = calculateLoupeCenterPosition(fingerPosition, relativePosition)
  
  // Check boundaries
  const left = centerPosition.x - LOUPE_RADIUS >= 0
  const right = centerPosition.x + LOUPE_RADIUS <= viewportWidth
  const top = centerPosition.y - LOUPE_RADIUS >= 0
  const bottom = centerPosition.y + LOUPE_RADIUS <= viewportHeight

  // Different positions have different requirements
  switch (relativePosition) {
    case 'top-left':
    case 'top-left-top':
      return left && top
    case 'top':
      return left && right && top
    case 'top-top-right':
    case 'top-right':
      return right && top
    case 'bottom-right':
      return right && bottom
    case 'bottom-left':
      return left && bottom
    default:
      return left && right && top && bottom
  }
}

/**
 * Find the best loupe position based on priority order
 */
export function findBestLoupePosition(
  fingerPosition: Position,
  viewportWidth: number,
  viewportHeight: number
): LoupeRelativePosition {
  const positions: LoupeRelativePosition[] = [
    'top-left',
    'top-left-top',
    'top',
    'top-top-right',
    'top-right',
    'bottom-right',
    'bottom-left',
  ]

  for (const position of positions) {
    if (checkLoupePositionFits(fingerPosition, position, viewportWidth, viewportHeight)) {
      return position
    }
  }

  // Fallback to top-left if no position fits
  return 'top-left'
}