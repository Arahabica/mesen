import { useState, useCallback } from 'react'
import { MozaicArea, Rectangle } from '@/types/mozaic'
import { DrawingMode, LoupeState } from '@/types/editor'

export function useMozaicDrawing() {
  const [areas, setAreas] = useState<MozaicArea[]>([])
  const [currentArea, setCurrentArea] = useState<Rectangle | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [selectedAreaIndex, setSelectedAreaIndex] = useState<number | null>(null)
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('none')
  const [loupeState, setLoupeState] = useState<LoupeState>({
    visible: false,
    position: { x: 0, y: 0 },
    mode: 'none',
    isStationary: false
  })

  const startDrawing = useCallback((coords: { x: number; y: number }) => {
    setIsDrawing(true)
    setCurrentArea({
      start: coords,
      end: coords
    })
  }, [])

  const draw = useCallback((coords: { x: number; y: number }) => {
    if (!isDrawing || !currentArea) return
    
    setCurrentArea({
      ...currentArea,
      end: coords
    })
  }, [isDrawing, currentArea])

  const stopDrawing = useCallback(() => {
    if (currentArea && isDrawing) {
      // Only add area if it has some size
      const width = Math.abs(currentArea.end.x - currentArea.start.x)
      const height = Math.abs(currentArea.end.y - currentArea.start.y)
      
      if (width > 5 && height > 5) {
        const newArea: MozaicArea = {
          ...currentArea,
          id: Date.now().toString()
        }
        setAreas(prev => [...prev, newArea])
      }
    }
    
    setIsDrawing(false)
    setCurrentArea(null)
  }, [currentArea, isDrawing])

  const findAreaAtPoint = useCallback((point: { x: number; y: number }): number => {
    for (let i = areas.length - 1; i >= 0; i--) {
      const area = areas[i]
      const minX = Math.min(area.start.x, area.end.x)
      const maxX = Math.max(area.start.x, area.end.x)
      const minY = Math.min(area.start.y, area.end.y)
      const maxY = Math.max(area.start.y, area.end.y)
      
      if (point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) {
        return i
      }
    }
    return -1
  }, [areas])

  const deleteArea = useCallback((index: number) => {
    setAreas(prev => prev.filter((_, i) => i !== index))
  }, [])

  const undo = useCallback(() => {
    setAreas(prev => prev.slice(0, -1))
  }, [])

  const resetMode = useCallback(() => {
    setDrawingMode('none')
    setLoupeState({
      visible: false,
      position: { x: 0, y: 0 },
      mode: 'none',
      isStationary: false
    })
  }, [])

  const startAdjustMode = useCallback((position: { x: number; y: number }) => {
    setDrawingMode('adjust')
    setLoupeState({
      visible: true,
      position,
      mode: 'adjust',
      isStationary: false
    })
  }, [])

  const startDrawMode = useCallback(() => {
    setDrawingMode('draw')
    setLoupeState(prev => ({
      ...prev,
      mode: 'draw'
    }))
  }, [])

  const updateLoupePosition = useCallback((position: { x: number; y: number }, isStationary: boolean) => {
    setLoupeState(prev => ({
      ...prev,
      position,
      isStationary
    }))
  }, [])

  return {
    areas,
    setAreas,
    currentArea,
    isDrawing,
    selectedAreaIndex,
    drawingMode,
    loupeState,
    setLoupeState,
    setDrawingMode,
    startDrawing,
    draw,
    stopDrawing,
    findAreaAtPoint,
    deleteArea,
    undo,
    resetMode,
    startAdjustMode,
    startDrawMode,
    updateLoupePosition
  }
}