'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'

interface Line {
  start: { x: number; y: number }
  end: { x: number; y: number }
  thickness: number
}

const THICKNESS_OPTIONS = [2, 5, 10, 20, 40, 60]

export default function ImageEditor() {
  const [image, setImage] = useState<string | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [currentLine, setCurrentLine] = useState<Line | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [lineThickness, setLineThickness] = useState(10)
  const [drawStartPoint, setDrawStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [isInitialized, setIsInitialized] = useState(false)
  const [initialMousePos, setInitialMousePos] = useState<{ x: number; y: number } | null>(null)
  const [hasMoved, setHasMoved] = useState(false)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const longPressTimerRef = useRef<NodeJS.Timeout>()
  const drawStartTimeRef = useRef<number>(0)
  const isPinchingRef = useRef(false)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImage(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const getCanvasCoordinates = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current || !containerRef.current) return { x: 0, y: 0 }
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: (clientX - rect.left - position.x) / scale,
      y: (clientY - rect.top - position.y) / scale
    }
  }, [scale, position])
  
  const distanceToLineSegment = (point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) => {
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

  const startDrawing = useCallback((clientX: number, clientY: number) => {
    const coords = getCanvasCoordinates(clientX, clientY)
    setIsDrawing(true)
    setDrawStartPoint(coords)
    setCurrentLine({
      start: coords,
      end: coords,
      thickness: lineThickness
    })
  }, [getCanvasCoordinates, lineThickness])

  const draw = useCallback((clientX: number, clientY: number) => {
    if (!isDrawing || !drawStartPoint) return
    const coords = getCanvasCoordinates(clientX, clientY)
    setCurrentLine({
      start: drawStartPoint,
      end: coords,
      thickness: lineThickness
    })
  }, [isDrawing, drawStartPoint, getCanvasCoordinates, lineThickness])

  const stopDrawing = useCallback(() => {
    if (isDrawing && currentLine && drawStartPoint) {
      const distance = Math.sqrt(
        Math.pow(currentLine.end.x - currentLine.start.x, 2) + 
        Math.pow(currentLine.end.y - currentLine.start.y, 2)
      )
      if (distance > 5) {
        setLines([...lines, currentLine])
      }
    }
    setIsDrawing(false)
    setCurrentLine(null)
    setDrawStartPoint(null)
  }, [isDrawing, currentLine, lines, drawStartPoint])

  const handleMouseDown = (e: React.MouseEvent) => {
    const { clientX, clientY } = e
    drawStartTimeRef.current = Date.now()
    setInitialMousePos({ x: clientX, y: clientY })
    setHasMoved(false)
    
    longPressTimerRef.current = setTimeout(() => {
      if (!hasMoved) {
        startDrawing(clientX, clientY)
      }
    }, 500)
    
    setDragStart({ x: clientX - position.x, y: clientY - position.y })
    setIsDragging(true)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    e.preventDefault()
    
    if (initialMousePos && !hasMoved) {
      const distance = Math.sqrt(
        Math.pow(e.clientX - initialMousePos.x, 2) + 
        Math.pow(e.clientY - initialMousePos.y, 2)
      )
      if (distance > 5) {
        setHasMoved(true)
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current)
        }
      }
    }
    
    if (isDrawing) {
      draw(e.clientX, e.clientY)
    } else if (isDragging && !isDrawing) {
      requestAnimationFrame(() => {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        })
      })
    }
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
    }
    
    if (Date.now() - drawStartTimeRef.current < 500 && !isDrawing && !hasMoved) {
      const coords = getCanvasCoordinates(e.clientX, e.clientY)
      const clickedLineIndex = lines.findIndex(line => {
        const distToLine = distanceToLineSegment(coords, line.start, line.end)
        return distToLine < line.thickness / 2 + 5
      })
      
      if (clickedLineIndex !== -1) {
        const newLines = [...lines]
        const currentThickness = newLines[clickedLineIndex].thickness
        const currentIndex = THICKNESS_OPTIONS.indexOf(currentThickness)
        const nextIndex = (currentIndex + 1) % THICKNESS_OPTIONS.length
        newLines[clickedLineIndex].thickness = THICKNESS_OPTIONS[nextIndex]
        setLines(newLines)
      }
    }
    
    stopDrawing()
    setIsDragging(false)
    setInitialMousePos(null)
    setHasMoved(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 2) {
      isPinchingRef.current = true
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      )
      setLastTouchDistance(distance)
    } else if (e.touches.length === 1) {
      const touch = e.touches[0]
      drawStartTimeRef.current = Date.now()
      setInitialMousePos({ x: touch.clientX, y: touch.clientY })
      setHasMoved(false)
      
      longPressTimerRef.current = setTimeout(() => {
        if (!hasMoved) {
          startDrawing(touch.clientX, touch.clientY)
        }
      }, 500)
      
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 2 && lastTouchDistance !== null) {
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      )
      
      const centerX = (touch1.clientX + touch2.clientX) / 2
      const centerY = (touch1.clientY + touch2.clientY) / 2
      
      const scaleFactor = currentDistance / lastTouchDistance
      const newScale = Math.max(0.1, Math.min(5, scale * scaleFactor))
      
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const offsetX = centerX - rect.left
        const offsetY = centerY - rect.top
        
        setPosition({
          x: offsetX - (offsetX - position.x) * (newScale / scale),
          y: offsetY - (offsetY - position.y) * (newScale / scale)
        })
      }
      
      setScale(newScale)
      setLastTouchDistance(currentDistance)
    } else if (e.touches.length === 1 && !isPinchingRef.current) {
      const touch = e.touches[0]
      
      if (initialMousePos && !hasMoved) {
        const distance = Math.sqrt(
          Math.pow(touch.clientX - initialMousePos.x, 2) + 
          Math.pow(touch.clientY - initialMousePos.y, 2)
        )
        if (distance > 5) {
          setHasMoved(true)
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current)
          }
        }
      }
      
      if (isDrawing) {
        draw(touch.clientX, touch.clientY)
      } else if (!isDrawing) {
        requestAnimationFrame(() => {
          setPosition({
            x: touch.clientX - dragStart.x,
            y: touch.clientY - dragStart.y
          })
        })
      }
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 0) {
      isPinchingRef.current = false
      setLastTouchDistance(null)
    }
    
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
    }
    
    if (Date.now() - drawStartTimeRef.current < 500 && !isDrawing && e.changedTouches[0] && !isPinchingRef.current && !hasMoved) {
      const coords = getCanvasCoordinates(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
      const clickedLineIndex = lines.findIndex(line => {
        const distToLine = distanceToLineSegment(coords, line.start, line.end)
        return distToLine < line.thickness / 2 + 5
      })
      
      if (clickedLineIndex !== -1) {
        const newLines = [...lines]
        const currentThickness = newLines[clickedLineIndex].thickness
        const currentIndex = THICKNESS_OPTIONS.indexOf(currentThickness)
        const nextIndex = (currentIndex + 1) % THICKNESS_OPTIONS.length
        newLines[clickedLineIndex].thickness = THICKNESS_OPTIONS[nextIndex]
        setLines(newLines)
      }
    }
    
    stopDrawing()
    setIsDragging(false)
    setInitialMousePos(null)
    setHasMoved(false)
  }


  const undo = () => {
    if (lines.length > 0) {
      setLines(lines.slice(0, -1))
    }
  }

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    
    const img = new Image()
    img.onload = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      canvas.width = img.width
      canvas.height = img.height
      
      ctx.drawImage(img, 0, 0)
      
      ctx.strokeStyle = 'black'
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      
      lines.forEach(line => {
        ctx.lineWidth = line.thickness
        ctx.beginPath()
        ctx.moveTo(line.start.x, line.start.y)
        ctx.lineTo(line.end.x, line.end.y)
        ctx.stroke()
      })
      
      canvas.toBlob(blob => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'censored-image.png'
          a.click()
          URL.revokeObjectURL(url)
        }
      })
    }
    img.src = image
  }

  const closeImage = () => {
    setImage(null)
    setLines([])
    setScale(1)
    setPosition({ x: 0, y: 0 })
    setIsInitialized(false)
    setImageSize({ width: 0, height: 0 })
  }

  useEffect(() => {
    const redrawCanvas = () => {
      const canvas = canvasRef.current
      if (!canvas || !image) return
      
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      const img = new Image()
      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        setImageSize({ width: img.width, height: img.height })
        
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        
        ctx.strokeStyle = 'black'
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        
        const allLines = currentLine ? [...lines, currentLine] : lines
        allLines.forEach(line => {
          ctx.lineWidth = line.thickness
          ctx.beginPath()
          ctx.moveTo(line.start.x, line.start.y)
          ctx.lineTo(line.end.x, line.end.y)
          ctx.stroke()
        })
      }
      img.src = image
    }
    
    redrawCanvas()
  }, [image, lines, currentLine])
  
  useEffect(() => {
    if (image && containerRef.current && imageSize.width > 0 && !isInitialized) {
      const containerRect = containerRef.current.getBoundingClientRect()
      const imgAspect = imageSize.width / imageSize.height
      const containerAspect = containerRect.width / containerRect.height
      
      let initialScale = 1
      if (imgAspect > containerAspect) {
        initialScale = containerRect.width / imageSize.width
      } else {
        initialScale = containerRect.height / imageSize.height
      }
      
      setScale(initialScale)
      setPosition({
        x: (containerRect.width - imageSize.width * initialScale) / 2,
        y: (containerRect.height - imageSize.height * initialScale) / 2
      })
      setIsInitialized(true)
    }
  }, [imageSize, image, isInitialized])
  
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newScale = Math.max(0.1, Math.min(5, scale * delta))
      
      const rect = container.getBoundingClientRect()
      const offsetX = e.clientX - rect.left
      const offsetY = e.clientY - rect.top
      
      setPosition(prev => ({
        x: offsetX - (offsetX - prev.x) * (newScale / scale),
        y: offsetY - (offsetY - prev.y) * (newScale / scale)
      }))
      
      setScale(newScale)
    }
    
    container.addEventListener('wheel', handleWheelEvent, { passive: false })
    
    return () => {
      container.removeEventListener('wheel', handleWheelEvent)
    }
  }, [scale])

  if (!image) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          画像を選択する
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />
      </div>
    )
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-900">
      <div className="absolute top-4 left-4 bg-black/50 text-white p-2 rounded z-10 pointer-events-none">
        <div>拡大率: {Math.round(scale * 100)}%</div>
        <div>線の太さ: {lineThickness}px</div>
      </div>
      
      <button
        onClick={closeImage}
        className="absolute top-4 right-4 w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 z-10"
      >
        ×
      </button>
      
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4 z-10">
        <button
          onClick={undo}
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          元に戻す
        </button>
        <button
          onClick={download}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          ダウンロード
        </button>
      </div>
      
      <div
        ref={containerRef}
        className="w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={stopDrawing}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          className="absolute"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'top left',
            cursor: isDrawing ? 'crosshair' : 'move',
            imageRendering: 'auto'
          }}
        />
      </div>
    </div>
  )
}