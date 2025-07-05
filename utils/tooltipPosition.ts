import { Position } from '@/types/editor'

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

export interface TooltipDimensions {
  width: number
  height: number
}

export interface TooltipPositionResult {
  position: Position
  placement: TooltipPosition
}

const TOOLTIP_OFFSET = 10

/**
 * Calculate tooltip position for a given placement
 */
function calculateTooltipPosition(
  targetPosition: Position,
  tooltipDimensions: TooltipDimensions,
  placement: TooltipPosition
): Position {
  switch (placement) {
    case 'top':
      return {
        x: targetPosition.x - tooltipDimensions.width / 2,
        y: targetPosition.y - tooltipDimensions.height - TOOLTIP_OFFSET,
      }
    case 'bottom':
      return {
        x: targetPosition.x - tooltipDimensions.width / 2,
        y: targetPosition.y + TOOLTIP_OFFSET,
      }
    case 'left':
      return {
        x: targetPosition.x - tooltipDimensions.width - TOOLTIP_OFFSET,
        y: targetPosition.y - tooltipDimensions.height / 2,
      }
    case 'right':
      return {
        x: targetPosition.x + TOOLTIP_OFFSET,
        y: targetPosition.y - tooltipDimensions.height / 2,
      }
  }
}

/**
 * Check if tooltip fits within viewport bounds
 */
function checkTooltipFits(
  position: Position,
  dimensions: TooltipDimensions,
  viewportWidth: number,
  viewportHeight: number
): boolean {
  const fitsLeft = position.x >= 0
  const fitsRight = position.x + dimensions.width <= viewportWidth
  const fitsTop = position.y >= 0
  const fitsBottom = position.y + dimensions.height <= viewportHeight

  return fitsLeft && fitsRight && fitsTop && fitsBottom
}

/**
 * Find the best tooltip position that fits within viewport
 */
export function findBestTooltipPosition(
  targetPosition: Position,
  tooltipDimensions: TooltipDimensions,
  viewportWidth: number,
  viewportHeight: number,
  preferredPlacement: TooltipPosition = 'top'
): TooltipPositionResult {
  // Order of placements to try
  const placements: TooltipPosition[] = [
    preferredPlacement,
    ...(['top', 'bottom', 'left', 'right'] as TooltipPosition[])
      .filter(p => p !== preferredPlacement)
  ]

  // Try each placement in order
  for (const placement of placements) {
    const position = calculateTooltipPosition(targetPosition, tooltipDimensions, placement)
    if (checkTooltipFits(position, tooltipDimensions, viewportWidth, viewportHeight)) {
      return { position, placement }
    }
  }

  // If no placement fits perfectly, use the preferred one and clamp to viewport
  const position = calculateTooltipPosition(targetPosition, tooltipDimensions, preferredPlacement)
  const clampedPosition = {
    x: Math.max(0, Math.min(position.x, viewportWidth - tooltipDimensions.width)),
    y: Math.max(0, Math.min(position.y, viewportHeight - tooltipDimensions.height)),
  }

  return { position: clampedPosition, placement: preferredPlacement }
}

/**
 * Calculate tooltip position with automatic edge detection
 */
export function calculateAdaptiveTooltipPosition(
  targetPosition: Position,
  tooltipDimensions: TooltipDimensions,
  preferredPlacement: TooltipPosition = 'top'
): TooltipPositionResult {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  return findBestTooltipPosition(
    targetPosition,
    tooltipDimensions,
    viewportWidth,
    viewportHeight,
    preferredPlacement
  )
}