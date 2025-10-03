import { useState, useCallback } from 'react'
import { Line, Position, DrawingMode, LoupeState, DeleteZoneState } from '@/types/editor'
import { getThicknessOptions, CLICK_DISTANCE_THRESHOLD, LINE_HIT_EXPANSION } from '@/constants/editor'
import { findBestLoupePosition } from '@/utils/loupePosition'

export function useDrawing(lineThickness: number, imageWidth: number, imageHeight: number) {
  const [lines, setLines] = useState<Line[]>([])
  const [linesHistory, setLinesHistory] = useState<Line[][]>([[]])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [currentLine, setCurrentLine] = useState<Line | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStartPoint, setDrawStartPoint] = useState<Position | null>(null)
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null)
  const [lineDragOffset, setLineDragOffset] = useState<Position>({ x: 0, y: 0 })
  const [lineBeforeDrag, setLineBeforeDrag] = useState<Line | null>(null)
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('move')
  const [loupeState, setLoupeState] = useState<LoupeState>({
    visible: false,
    position: { x: 0, y: 0 },
    mode: 'move'
  })
  const [deleteZoneState, setDeleteZoneState] = useState<DeleteZoneState>({
    visible: false,
    position: 'bottom',
    isNearby: false
  })

  // Helper function to save current state to history
  const saveToHistory = useCallback((newLines: Line[]) => {
    setLinesHistory(prev => {
      // Remove any future history after current index
      const newHistory = prev.slice(0, historyIndex + 1)
      // Add new state with deep copy to prevent reference issues
      newHistory.push(newLines.map(line => ({
        start: { ...line.start },
        end: { ...line.end },
        thickness: line.thickness
      })))
      return newHistory
    })
    setHistoryIndex(prev => prev + 1)
    setLines(newLines)
  }, [historyIndex])

  // Public setter that saves to history
  const setLinesWithHistory = useCallback((updater: Line[] | ((prev: Line[]) => Line[])) => {
    if (typeof updater === 'function') {
      const newLines = updater(lines)
      saveToHistory(newLines)
    } else {
      saveToHistory(updater)
    }
  }, [lines, saveToHistory])

  // Reset lines and history (for closing image)
  const resetLines = useCallback(() => {
    setLines([])
    setLinesHistory([[]])
    setHistoryIndex(0)
  }, [])

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
    let closestLineIndex = -1
    let closestDistance = Infinity
    
    lines.forEach((line, index) => {
      const distToLine = distanceToLineSegment(point, line.start, line.end)
      const hitRadius = line.thickness / 2 + LINE_HIT_EXPANSION
      
      if (distToLine < hitRadius && distToLine < closestDistance) {
        closestDistance = distToLine
        closestLineIndex = index
      }
    })
    
    return closestLineIndex
  }, [lines])

  const isNearLine = useCallback((point: Position, threshold: number = 30) => {
    return lines.some(line => {
      const distToLine = distanceToLineSegment(point, line.start, line.end)
      return distToLine <= threshold
    })
  }, [lines])

  const startDrawing = useCallback((coords: Position, customThickness?: number) => {
    setIsDrawing(true)
    setDrawStartPoint(coords)
    setCurrentLine({
      start: coords,
      end: coords,
      thickness: customThickness ?? lineThickness
    })
  }, [lineThickness])

  const draw = useCallback((coords: Position) => {
    if (!isDrawing || !drawStartPoint || !currentLine) return
    setCurrentLine({
      start: drawStartPoint,
      end: coords,
      thickness: currentLine.thickness  // Use the thickness from currentLine
    })
  }, [isDrawing, drawStartPoint, currentLine])

  const stopDrawing = useCallback(() => {
    if (isDrawing && currentLine && drawStartPoint) {
      const distance = Math.sqrt(
        Math.pow(currentLine.end.x - currentLine.start.x, 2) +
        Math.pow(currentLine.end.y - currentLine.start.y, 2)
      )
      if (distance > CLICK_DISTANCE_THRESHOLD) {
        const newLines = [...lines, currentLine]
        saveToHistory(newLines)
      }
    }
    setIsDrawing(false)
    setCurrentLine(null)
    setDrawStartPoint(null)
  }, [isDrawing, currentLine, lines, drawStartPoint, saveToHistory])

  const selectLine = useCallback((index: number, coords: Position) => {
    setSelectedLineIndex(index)
    const line = lines[index]
    // Save the original line state before dragging
    setLineBeforeDrag({ ...line })
    setLineDragOffset({
      x: coords.x - (line.start.x + line.end.x) / 2,
      y: coords.y - (line.start.y + line.end.y) / 2
    })
  }, [lines])

  const dragLine = useCallback((coords: Position) => {
    if (selectedLineIndex === null) return
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
    const thicknessOptions = getThicknessOptions(imageWidth, imageHeight)
    const currentIndex = thicknessOptions.indexOf(currentThickness)
    const nextIndex = (currentIndex + 1) % thicknessOptions.length
    newLines[index] = {
      ...newLines[index],
      thickness: thicknessOptions[nextIndex]
    }
    saveToHistory(newLines)
  }, [lines, imageWidth, imageHeight, saveToHistory])

  const stopDraggingLine = useCallback(() => {
    // Save to history if line was actually moved
    if (selectedLineIndex !== null && lineBeforeDrag) {
      const currentLineState = lines[selectedLineIndex]
      // Check if line position changed
      if (currentLineState &&
          (currentLineState.start.x !== lineBeforeDrag.start.x ||
           currentLineState.start.y !== lineBeforeDrag.start.y ||
           currentLineState.end.x !== lineBeforeDrag.end.x ||
           currentLineState.end.y !== lineBeforeDrag.end.y)) {
        saveToHistory([...lines])
      }
    }
    setSelectedLineIndex(null)
    setLineBeforeDrag(null)
  }, [selectedLineIndex, lineBeforeDrag, lines, saveToHistory])

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      // Deep copy to prevent reference issues
      setLines(linesHistory[newIndex].map(line => ({
        start: { ...line.start },
        end: { ...line.end },
        thickness: line.thickness
      })))
    }
  }, [historyIndex, linesHistory])

  const getAllLines = useCallback(() => {
    return currentLine ? [...lines, currentLine] : lines
  }, [lines, currentLine])

  const startAdjustMode = useCallback((coords: Position) => {
    setDrawingMode('adjust')
    
    // Find the best loupe position
    const relativePos = findBestLoupePosition(
      coords,
      window.innerWidth,
      window.innerHeight
    )
    
    setLoupeState({
      visible: true,
      position: coords,
      mode: 'adjust',
      isStationary: true,  // Start with stationary to show countdown immediately
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
    setLoupeState(prev => {
      if (!prev.visible) return prev
      return {
        ...prev,
        position: coords,
        mode: drawingMode,  // Update mode based on current drawing mode
        isStationary: drawingMode === 'adjust' ? isStationary : false
      }
    })
  }, [drawingMode])

  const resetMode = useCallback(() => {
    setDrawingMode('move')
    setLoupeState({
      visible: false,
      position: { x: 0, y: 0 },
      mode: 'move',
    })
    setDeleteZoneState({
      visible: false,
      position: 'bottom',
      isNearby: false
    })
  }, [])

  const showDeleteZone = useCallback((lineScreenY: number, screenHeight: number) => {
    const position = lineScreenY < screenHeight / 2 ? 'bottom' : 'top'
    setDeleteZoneState({
      visible: true,
      position,
      isNearby: false
    })
  }, [])

  const updateDeleteZoneProximity = useCallback((isNear: boolean) => {
    setDeleteZoneState(prev => ({
      ...prev,
      isNearby: isNear
    }))
  }, [])

  const hideDeleteZone = useCallback(() => {
    setDeleteZoneState({
      visible: false,
      position: 'bottom',
      isNearby: false
    })
  }, [])

  const deleteLine = useCallback((index: number) => {
    const newLines = [...lines]
    newLines.splice(index, 1)
    saveToHistory(newLines)
  }, [lines, saveToHistory])

  // Add multiple lines individually to history (one history entry per line)
  const addLinesIndividually = useCallback((linesToAdd: Line[]) => {
    setLinesHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)
      let currentLines = newHistory[newHistory.length - 1] || []

      linesToAdd.forEach(line => {
        currentLines = [...currentLines, line]
        newHistory.push(currentLines.map(l => ({
          start: { ...l.start },
          end: { ...l.end },
          thickness: l.thickness
        })))
      })

      return newHistory
    })
    setHistoryIndex(prev => prev + linesToAdd.length)
    setLines(prev => [...prev, ...linesToAdd])
  }, [historyIndex])

  return {
    lines,
    setLines: setLinesWithHistory,
    addLinesIndividually,
    resetLines,
    currentLine,
    isDrawing,
    selectedLineIndex,
    drawingMode,
    loupeState,
    deleteZoneState,
    findLineAtPoint,
    isNearLine,
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
    resetMode,
    setDrawingMode,
    setLoupeState,
    showDeleteZone,
    updateDeleteZoneProximity,
    hideDeleteZone,
    deleteLine
  }
}