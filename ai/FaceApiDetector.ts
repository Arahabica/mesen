import type { Face, FaceDetector as FaceDetectorContract, FaceDetectorOptions, Eye } from './types'
import * as faceapi from 'face-api.js'

type DetectionWithLandmarks = faceapi.WithFaceLandmarks<faceapi.WithFaceDetection<{}>>

export type FaceApiDetectorOptions = FaceDetectorOptions & {
  minFaceAreaRatio?: number
  mergeIoUThreshold?: number
}

export class FaceApiDetector implements FaceDetectorContract {
  private modelsLoaded = false
  private readonly loadPromise: Promise<void>
  private readonly options: {
    maxFaces: number
    minDetectionConfidence: number
    modelBasePath: string
    minFaceAreaRatio: number
    mergeIoUThreshold: number
    debug: boolean
  }

  constructor(options: FaceApiDetectorOptions = {}) {
    const {
      maxFaces = 12,
      minDetectionConfidence = 0.45,
      modelBasePath = '/face-api',
      minFaceAreaRatio = 0.00008,
      mergeIoUThreshold = 0.35,
      debug = false
    } = options

    this.options = {
      maxFaces,
      minDetectionConfidence,
      modelBasePath,
      minFaceAreaRatio,
      mergeIoUThreshold,
      debug
    }

    this.loadPromise = this.loadModels()
  }

  private async loadModels(): Promise<void> {
    if (this.modelsLoaded) {
      return
    }

    const basePath = this.options.modelBasePath ?? '/face-api'

    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(basePath),
      faceapi.nets.faceLandmark68Net.loadFromUri(basePath)
    ])

    this.modelsLoaded = true
  }

  private clamp(value: number, min: number, max: number): number {
    if (value < min) {
      return min
    }
    if (value > max) {
      return max
    }
    return value
  }

  private toEye(points: faceapi.Point[], imageWidth: number, imageHeight: number): Eye {
    const count = points.length
    if (count === 0) {
      return { x: 0, y: 0 }
    }

    const sum = points.reduce(
      (acc, point) => ({
        x: acc.x + point.x,
        y: acc.y + point.y
      }),
      { x: 0, y: 0 }
    )

    const avgX = this.clamp(sum.x / count, 0, imageWidth)
    const avgY = this.clamp(sum.y / count, 0, imageHeight)

    return {
      x: Math.round(avgX),
      y: Math.round(avgY)
    }
  }

  private toFace(result: DetectionWithLandmarks): Face | null {
    const { detection, landmarks } = result
    const { imageWidth, imageHeight } = detection

    const box = detection.box
    const x = this.clamp(box.x, 0, imageWidth)
    const y = this.clamp(box.y, 0, imageHeight)
    const width = Math.min(this.clamp(box.width, 0, imageWidth), imageWidth - x)
    const height = Math.min(this.clamp(box.height, 0, imageHeight), imageHeight - y)

    if (width <= 0 || height <= 0) {
      return null
    }

    const leftEyePoints = landmarks.getLeftEye()
    const rightEyePoints = landmarks.getRightEye()

    if (!leftEyePoints.length || !rightEyePoints.length) {
      return null
    }

    const landmarkPoints = landmarks.positions ?? []

    return {
      eyes: [
        this.toEye(leftEyePoints, imageWidth, imageHeight),
        this.toEye(rightEyePoints, imageWidth, imageHeight)
      ],
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
      landmarks: landmarkPoints.map(point => ({
        x: this.clamp(point.x, 0, imageWidth),
        y: this.clamp(point.y, 0, imageHeight)
      }))
    }
  }

  private computeIoU(boxA: faceapi.Box, boxB: faceapi.Box): number {
    const xA = Math.max(boxA.x, boxB.x)
    const yA = Math.max(boxA.y, boxB.y)
    const xB = Math.min(boxA.right, boxB.right)
    const yB = Math.min(boxA.bottom, boxB.bottom)

    const intersectWidth = Math.max(0, xB - xA)
    const intersectHeight = Math.max(0, yB - yA)
    const intersectionArea = intersectWidth * intersectHeight

    if (intersectionArea <= 0) {
      return 0
    }

    const boxAArea = boxA.width * boxA.height
    const boxBArea = boxB.width * boxB.height
    const unionArea = boxAArea + boxBArea - intersectionArea

    if (unionArea <= 0) {
      return 0
    }

    return intersectionArea / unionArea
  }

  async detect(blob: Blob): Promise<Face[]> {
    await this.loadPromise

    const image = await faceapi.bufferToImage(blob)
    const imageArea = image.width * image.height
    const minFaceArea = imageArea * this.options.minFaceAreaRatio

    const detectorOptions = new faceapi.SsdMobilenetv1Options({
      minConfidence: this.options.minDetectionConfidence
    })

    const detections = await faceapi
      .detectAllFaces(image, detectorOptions)
      .withFaceLandmarks()

    const sorted = detections
      .slice()
      .sort((a, b) => (b.detection.score ?? 0) - (a.detection.score ?? 0))

    const selected: DetectionWithLandmarks[] = []

    for (const detection of sorted) {
      const box = detection.detection.box
      const area = box.width * box.height
      if (area < minFaceArea) {
        if (this.options.debug) {
          const score = detection.detection.score ?? 0
          console.log('[FaceDetector] Skip small detection', {
            score: score.toFixed(3),
            width: box.width,
            height: box.height
          })
        }
        continue
      }

      let overlaps = false
      for (const existing of selected) {
        const iou = this.computeIoU(existing.detection.box, box)
        if (iou >= this.options.mergeIoUThreshold) {
          overlaps = true
          break
        }
      }

      if (!overlaps) {
        selected.push(detection)
      }
    }

    const limited = this.options.maxFaces > 0
      ? selected.slice(0, this.options.maxFaces)
      : selected

    const faces = limited
      .map((detection, index) => {
        const face = this.toFace(detection)
        if (face && this.options.debug) {
          const score = detection.detection.score ?? 0
          console.log(
            `[FaceDetector] Face ${index + 1} detected (score=${score.toFixed(3)})`,
            face
          )
        }
        return face
      })
      .filter((face): face is Face => face !== null)

    return faces
  }

  async dispose(): Promise<void> {
    faceapi.nets.ssdMobilenetv1.dispose()
    faceapi.nets.faceLandmark68Net.dispose()
    this.modelsLoaded = false
  }
}
