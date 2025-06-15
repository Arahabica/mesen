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
    
    // Determine relative position based on initial coordinates
    const offset = 20
    const loupeSize = 100 // LOUPE_RADIUS * 2
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    let relativePos: LoupeRelativePosition = 'top-left'
    
    // Check if loupe would fit in top-left
    if (coords.x - loupeSize - offset >= 0 && coords.y - loupeSize - offset >= 0) {
      relativePos = 'top-left'
    }
    // Check if loupe would fit in top-right
    else if (coords.x + offset + loupeSize <= viewportWidth && coords.y - loupeSize - offset >= 0) {
      relativePos = 'top-right'
    }
    // Check if loupe would fit in bottom-left
    else if (coords.x - loupeSize - offset >= 0 && coords.y + offset + loupeSize <= viewportHeight) {
      relativePos = 'bottom-left'
    }
    // Default to bottom-right
    else {
      relativePos = 'bottom-right'
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