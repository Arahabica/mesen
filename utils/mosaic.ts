import { Rectangle } from '@/types/mozaic'
import { MOSAIC_SIZE_RATIO } from '@/constants/editor'

/**
 * Apply mosaic effect to a specific area
 */
export function applyMosaicToArea(
  ctx: CanvasRenderingContext2D,
  area: Rectangle,
  imageWidth: number,
  imageHeight: number
) {
  // Calculate mosaic size based on image dimensions
  const mosaicWidth = Math.min(imageWidth, imageHeight) * MOSAIC_SIZE_RATIO
  const mosaicHeight = mosaicWidth // Square mosaic blocks

  // Get actual rectangle boundaries
  const rectMinX = Math.min(area.start.x, area.end.x)
  const rectMaxX = Math.max(area.start.x, area.end.x)
  const rectMinY = Math.min(area.start.y, area.end.y)
  const rectMaxY = Math.max(area.start.y, area.end.y)

  // Calculate mosaic grid boundaries (extend to include partial blocks)
  const gridMinX = Math.floor(rectMinX / mosaicWidth) * mosaicWidth
  const gridMaxX = Math.ceil(rectMaxX / mosaicWidth) * mosaicWidth
  const gridMinY = Math.floor(rectMinY / mosaicHeight) * mosaicHeight
  const gridMaxY = Math.ceil(rectMaxY / mosaicHeight) * mosaicHeight

  // Apply mosaic effect
  for (let x = gridMinX; x < gridMaxX; x += mosaicWidth) {
    for (let y = gridMinY; y < gridMaxY; y += mosaicHeight) {
      // Calculate the intersection of mosaic block and selection rectangle
      const blockStartX = Math.max(x, rectMinX)
      const blockEndX = Math.min(x + mosaicWidth, rectMaxX)
      const blockStartY = Math.max(y, rectMinY)
      const blockEndY = Math.min(y + mosaicHeight, rectMaxY)

      // Skip if no intersection
      if (blockStartX >= blockEndX || blockStartY >= blockEndY) continue

      // Get the block dimensions
      const blockWidth = blockEndX - blockStartX
      const blockHeight = blockEndY - blockStartY

      // Sample from the center of the full mosaic block for color
      const sampleX = Math.min(x + mosaicWidth / 2, imageWidth - 1)
      const sampleY = Math.min(y + mosaicHeight / 2, imageHeight - 1)
      const sampleWidth = Math.min(1, imageWidth - sampleX)
      const sampleHeight = Math.min(1, imageHeight - sampleY)

      const imageData = ctx.getImageData(sampleX, sampleY, sampleWidth, sampleHeight)
      const avgColor = getAverageColor(imageData)

      // Fill only the intersection area
      ctx.fillStyle = `rgb(${avgColor.r},${avgColor.g},${avgColor.b})`
      ctx.fillRect(blockStartX, blockStartY, blockWidth, blockHeight)
    }
  }
}

/**
 * Get average color of image data
 */
export function getAverageColor(imageData: globalThis.ImageData): { r: number; g: number; b: number } {
  let r = 0, g = 0, b = 0
  let count = 0

  for (let i = 0; i < imageData.data.length; i += 4) {
    r += imageData.data[i]
    g += imageData.data[i + 1]
    b += imageData.data[i + 2]
    count++
  }

  return {
    r: Math.floor(r / count),
    g: Math.floor(g / count),
    b: Math.floor(b / count)
  }
}