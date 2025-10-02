import type { Face } from '@/ai/types'
import type { Line } from '@/types/editor'

/**
 * Creates a censoring line for a detected face
 * @param face - Detected face with landmarks
 * @param thicknessOptions - Available thickness options to choose from
 * @returns Line object or null if line cannot be created
 */
export function createLineForFace(face: Face, thicknessOptions: number[]): Line | null {
  if (!face.landmarks || face.landmarks.length < 48) {
    return null
  }

  const leftCorner = face.landmarks[36]
  const rightCorner = face.landmarks[45]

  if (!leftCorner || !rightCorner) {
    return null
  }

  const dx = rightCorner.x - leftCorner.x
  const dy = rightCorner.y - leftCorner.y
  const length = Math.hypot(dx, dy)

  if (!Number.isFinite(length) || length < 2) {
    return null
  }

  const extension = length * 0.2
  const angle = Math.atan2(dy, dx)

  const startX = leftCorner.x - extension * Math.cos(angle)
  const startY = leftCorner.y - extension * Math.sin(angle)
  const endX = rightCorner.x + extension * Math.cos(angle)
  const endY = rightCorner.y + extension * Math.sin(angle)

  const lineA = dy
  const lineB = leftCorner.x - rightCorner.x
  const lineC = rightCorner.x * leftCorner.y - leftCorner.x * rightCorner.y
  const denom = Math.hypot(lineA, lineB) || 1

  const eyeContourIndices = [37, 38, 39, 40, 41, 42, 43, 44, 46, 47]
  let maxDistance = 0

  eyeContourIndices.forEach(index => {
    const point = face.landmarks?.[index]
    if (!point) return
    const distance = Math.abs(lineA * point.x + lineB * point.y + lineC) / denom
    if (distance > maxDistance) {
      maxDistance = distance
    }
  })

  const baseThickness = Math.max(maxDistance * 4, 2)
  const selectedThickness = thicknessOptions.find(option => option >= baseThickness) ?? thicknessOptions[thicknessOptions.length - 1]

  return {
    start: { x: Math.round(startX), y: Math.round(startY) },
    end: { x: Math.round(endX), y: Math.round(endY) },
    thickness: selectedThickness
  }
}

/**
 * Creates a unique key for a line
 * @param line - Line object
 * @returns Unique string key
 */
export function getLineKey(line: Line): string {
  return `${line.start.x}:${line.start.y}:${line.end.x}:${line.end.y}:${line.thickness}`
}

/**
 * Filters out duplicate lines based on existing lines
 * @param newLines - New lines to filter
 * @param existingLines - Existing lines to check against
 * @returns Array of unique lines
 */
export function filterDuplicateLines(newLines: Line[], existingLines: Line[]): Line[] {
  const existingKeys = new Set(existingLines.map(getLineKey))
  return newLines.filter(line => !existingKeys.has(getLineKey(line)))
}

/**
 * Generates censoring lines for all detected faces
 * @param faces - Array of detected faces
 * @param thicknessOptions - Available thickness options
 * @returns Array of lines for all faces
 */
export function generateLinesForFaces(faces: Face[], thicknessOptions: number[]): Line[] {
  return faces
    .map(face => createLineForFace(face, thicknessOptions))
    .filter((line): line is Line => line !== null)
}
