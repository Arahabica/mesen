import { useState, useCallback } from 'react'
import { Line, Position, DrawingMode, LoupeState, LoupeRelativePosition } from '@/types/editor'
import { THICKNESS_OPTIONS, CLICK_DISTANCE_THRESHOLD } from '@/constants/editor'

export function useDrawing(lineThickness: number) {
  const [lines, setLines] = useState<Line[]>([])
  const [currentLine, setCurrentLine] = useState<Line | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStartPoint, setDrawStartPoint] = useState<Position | null>(null)
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null)
  const [isDraggingLine, setIsDraggingLine] = useState(false)
  const [lineDragOffset, setLineDragOffset] = useState<Position>({ x: 0, y: 0 })
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('move')
  const [loupeState, setLoupeState] = useState<LoupeState>({
    visible: false,
    position: { x: 0, y: 0 },
    mode: 'move'
  })

  const distanceToLineSegment = (point: Position, start: Position, end: Position) => {
    const A = point.x - start.x
    const B = point.y - start.y
    const C = end.x - start.x
    const D = end.y - start.y
    
    const dot = A * C + B * D
    const lenSq = C * C + D * D
    let param = -1
    
    if (lenSq !== 0) {
      param = dot / lenSq
    }
    
    let xx, yy
    
    if (param < 0) {
      xx = start.x
      yy = start.y
    } else if (param > 1) {
      xx = end.x
      yy = end.y
    } else {
      xx = start.x + param * C
      yy = start.y + param * D
    }
    
    const dx = point.x - xx
    const dy = point.y - yy
    
    return Math.sqrt(dx * dx + dy * dy)
  }

  const findLineAtPoint = useCallback((point: Position) => {
    return lines.findIndex(line => {
      const distToLine = distanceToLineSegment(point, line.start, line.end)
      return distToLine < line.thickness / 2 + 5
    })
  }, [lines])

  const startDrawing = useCallback((coords: Position) => {
    setIsDrawing(true)
    setDrawStartPoint(coords)
    setCurrentLine({
      start: coords,
      end: coords,
      thickness: lineThickness
    })
  }, [lineThickness])

  const draw = useCallback((coords: Position) => {
    if (!isDrawing || !drawStartPoint) return
    setCurrentLine({
      start: drawStartPoint,
      end: coords,
      thickness: lineThickness
    })
  }, [isDrawing, drawStartPoint, lineThickness])

  const stopDrawing = useCallback(() => {
    if (isDrawing && currentLine && drawStartPoint) {
      const distance = Math.sqrt(
        Math.pow(currentLine.end.x - currentLine.start.x, 2) + 
        Math.pow(currentLine.end.y - currentLine.start.y, 2)
      )
      if (distance > CLICK_DISTANCE_THRESHOLD) {
        setLines([...lines, currentLine])
      }
    }
    setIsDrawing(false)
    setCurrentLine(null)
    setDrawStartPoint(null)
  }, [isDrawing, currentLine, lines, drawStartPoint])

  const selectLine = useCallback((index: number, coords: Position) => {
    setSelectedLineIndex(index)
    const line = lines[index]
    setLineDragOffset({
      x: coords.x - (line.start.x + line.end.x) / 2,
      y: coords.y - (line.start.y + line.end.y) / 2
    })
  }, [lines])

  const dragLine = useCallback((coords: Position) => {
    if (selectedLineIndex === null) return
    
    setIsDraggingLine(true)
    const line = lines[selectedLineIndex]
    const dx = line.end.x - line.start.x
    const dy = line.end.y - line.start.y
    const centerX = coords.x - lineDragOffset.x
    const centerY = coords.y - lineDragOffset.y
    
    const newLines = [...lines]
    newLines[selectedLineIndex] = {
      ...line,
      start: { x: centerX - dx / 2, y: centerY - dy / 2 },
      end: { x: centerX + dx / 2, y: centerY + dy / 2 }
    }
    setLines(newLines)
  }, [selectedLineIndex, lines, lineDragOffset])

  const changeLineThickness = useCallback((index: number) => {
    const newLines = [...lines]
    const currentThickness = newLines[index].thickness
    const currentIndex = THICKNESS_OPTIONS.indexOf(currentThickness)
    const nextIndex = (currentIndex + 1) % THICKNESS_OPTIONS.length
    newLines[index].thickness = THICKNESS_OPTIONS[nextIndex]
    setLines(newLines)
  }, [lines])

  const stopDraggingLine = useCallback(() => {
    setIsDraggingLine(false)
    setSelectedLineIndex(null)
  }, [])

  const undo = useCallback(() => {
    if (lines.length > 0) {
      setLines(lines.slice(0, -1))
    }
  }, [lines])

  const getAllLines = useCallback(() => {
    return currentLine ? [...lines, currentLine] : lines
  }, [lines, currentLine])

  const startAdjustMode = useCallback((coords: Position) => {
    setDrawingMode('adjust')
    
    // Determine relative position based on priority order
    const distanceFromFinger = 30 // Fixed distance from finger to loupe edge
    const loupeRadius = 50 // LOUPE_RADIUS
    const loupeSize = loupeRadius * 2
    const distanceToCenter = distanceFromFinger + loupeRadius
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    let relativePos: LoupeRelativePosition = 'top-left'
    
    // Check if each position would fit in viewport
    const checkPositionFits = (pos: LoupeRelativePosition): boolean => {
      let loupeCenterX: number
      let loupeCenterY: number
      
      switch (pos) {
        case 'top-left':
          // 225 degrees (down-left)
          loupeCenterX = coords.x + distanceToCenter * Math.cos(225 * Math.PI / 180)
          loupeCenterY = coords.y + distanceToCenter * Math.sin(225 * Math.PI / 180)
          return loupeCenterX - loupeRadius >= 0 && loupeCenterY - loupeRadius >= 0
        case 'top-left-top':
          // 202.5 degrees (between down-left and down)
          loupeCenterX = coords.x + distanceToCenter * Math.cos(202.5 * Math.PI / 180)
          loupeCenterY = coords.y + distanceToCenter * Math.sin(202.5 * Math.PI / 180)
          return loupeCenterX - loupeRadius >= 0 && loupeCenterY - loupeRadius >= 0
        case 'top':
          // 270 degrees (straight up)
          loupeCenterX = coords.x + distanceToCenter * Math.cos(270 * Math.PI / 180)
          loupeCenterY = coords.y + distanceToCenter * Math.sin(270 * Math.PI / 180)
          return loupeCenterX - loupeRadius >= 0 && loupeCenterX + loupeRadius <= viewportWidth && loupeCenterY - loupeRadius >= 0
        case 'top-top-right':
          // 337.5 degrees (between up and up-right)
          loupeCenterX = coords.x + distanceToCenter * Math.cos(337.5 * Math.PI / 180)
          loupeCenterY = coords.y + distanceToCenter * Math.sin(337.5 * Math.PI / 180)
          return loupeCenterX + loupeRadius <= viewportWidth && loupeCenterY - loupeRadius >= 0
        case 'top-right':
          // 315 degrees (up-right)
          loupeCenterX = coords.x + distanceToCenter * Math.cos(315 * Math.PI / 180)
          loupeCenterY = coords.y + distanceToCenter * Math.sin(315 * Math.PI / 180)
          return loupeCenterX + loupeRadius <= viewportWidth && loupeCenterY - loupeRadius >= 0
        case 'bottom-right':
          // 45 degrees (down-right)
          loupeCenterX = coords.x + distanceToCenter * Math.cos(45 * Math.PI / 180)
          loupeCenterY = coords.y + distanceToCenter * Math.sin(45 * Math.PI / 180)
          return loupeCenterX + loupeRadius <= viewportWidth && loupeCenterY + loupeRadius <= viewportHeight
        case 'bottom-left':
          // 135 degrees (down-left)
          loupeCenterX = coords.x + distanceToCenter * Math.cos(135 * Math.PI / 180)
          loupeCenterY = coords.y + distanceToCenter * Math.sin(135 * Math.PI / 180)
          return loupeCenterX - loupeRadius >= 0 && loupeCenterY + loupeRadius <= viewportHeight
      }
    }
    
    // Priority order: top-left, top-left-top, top, top-top-right, top-right, bottom-right, bottom-left
    const positions: LoupeRelativePosition[] = ['top-left', 'top-left-top', 'top', 'top-top-right', 'top-right', 'bottom-right', 'bottom-left']
    
    // Find the first position that fits
    for (const pos of positions) {
      if (checkPositionFits(pos)) {
        relativePos = pos
        break
      }
    }
    
    setLoupeState({
      visible: true,
      position: coords,
      mode: 'adjust',
      isStationary: false,  // Start with non-stationary
      initialPosition: coords,  // Store the initial position
      relativePosition: relativePos  // Store the relative position
    })
  }, [])

  const startDrawMode = useCallback(() => {
    setDrawingMode('draw')
    setLoupeState(prev => ({
      ...prev,
      mode: 'draw'
    }))
  }, [])

  const updateLoupePosition = useCallback((coords: Position, isStationary?: boolean) => {
    if (loupeState.visible) {
      setLoupeState(prev => ({
        ...prev,
        position: coords,
        isStationary: drawingMode === 'adjust' ? isStationary : false
      }))
    }
  }, [loupeState.visible, drawingMode])

  const resetMode = useCallback(() => {
    setDrawingMode('move')
    setLoupeState({
      visible: false,
      position: { x: 0, y: 0 },
      mode: 'move',
      initialPosition: undefined
    })
  }, [])

  return {
    lines,
    setLines,
    currentLine,
    isDrawing,
    selectedLineIndex,
    isDraggingLine,
    drawingMode,
    loupeState,
    findLineAtPoint,
    startDrawing,
    draw,
    stopDrawing,
    selectLine,
    dragLine,
    changeLineThickness,
    stopDraggingLine,
    undo,
    getAllLines,
    startAdjustMode,
    startDrawMode,
    updateLoupePosition,
    resetMode
  }
}