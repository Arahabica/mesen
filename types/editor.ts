export interface Line {
  start: { x: number; y: number }
  end: { x: number; y: number }
  thickness: number
}

export interface Position {
  x: number
  y: number
}

export interface ImageSize {
  width: number
  height: number
}

export type DrawingMode = 'none' | 'move' | 'adjust' | 'draw' | 'moveLine'

export type LoupeRelativePosition = 'top-left' | 'top-left-top' | 'top' | 'top-top-right' | 'top-right' | 'bottom-right' | 'bottom-left'

export interface LoupeState {
  visible: boolean
  position: Position
  mode: DrawingMode
  isStationary?: boolean
  relativePosition?: LoupeRelativePosition
}

export interface ImageData {
  dataURL: string
  filename: string
}