import {
  FaceDetector,
  FilesetResolver,
  Detection,
  NormalizedKeypoint,
  BoundingBox
} from '@mediapipe/tasks-vision'
import type {
  Face,
  FaceDetector as FaceDetectorContract,
  FaceDetectorOptions,
  Eye
} from './types'

interface DetectorRunResult {
  detections: Detection[]
  label: 'short-range' | 'full-range'
}

export class MediaPipeFaceDetector implements FaceDetectorContract {
  private shortRangeDetector: FaceDetector | null = null
  private fullRangeDetector: FaceDetector | null = null
  private readonly initialized: Promise<void>
  private readonly options: Required<FaceDetectorOptions>

  private readonly LOCAL_WASM_PATH = '/mediapipe/wasm'
  private readonly SHORT_RANGE_MODEL_PATH = '/models/face_detection_short_range.task'
  private readonly FULL_RANGE_MODEL_PATH = '/models/face_detection_full_range.task'

  constructor(options: FaceDetectorOptions = {}) {
    this.options = {
      maxFaces: 12,
      minDetectionConfidence: 0.2,
      debug: false,
      ...options
    }

    this.initialized = this.initialize()
  }

  private async initialize(): Promise<void> {
    const wasmFileset = await this.resolveVisionWasm()

    this.shortRangeDetector = await this.createDetector(
      wasmFileset,
      this.SHORT_RANGE_MODEL_PATH,
      'short-range',
      true
    )

    this.fullRangeDetector = await this.createDetector(
      wasmFileset,
      this.FULL_RANGE_MODEL_PATH,
      'full-range',
      false
    )
  }

  private async resolveVisionWasm() {
    try {
      return await FilesetResolver.forVisionTasks(this.LOCAL_WASM_PATH)
    } catch (error) {
      throw new Error(
        `Failed to load MediaPipe WASM bundle from ${this.LOCAL_WASM_PATH}. ` +
          'Run `npm run setup` to copy wasm assets. ' +
          `Original error: ${error}`
      )
    }
  }

  private async createDetector(
    wasmFileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
    modelPath: string,
    label: 'short-range' | 'full-range',
    required: boolean
  ): Promise<FaceDetector | null> {
    const modelBuffer = await this.loadModelAsset(modelPath, label, required)
    if (!modelBuffer) {
      return null
    }

    try {
      const detector = await FaceDetector.createFromModelBuffer(wasmFileset, modelBuffer)

      await this.configureDetector(detector, 'GPU')

      if (this.options.debug) {
        console.log(`MediaPipe FaceDetector (${label}) initialized using model: ${modelPath}`)
      }

      return detector
    } catch (error) {
      if (required) {
        throw error
      }

      if (this.options.debug) {
        console.warn(
          `Optional FaceDetector (${label}) failed to initialize (GPU). Retrying on CPU...`,
          error
        )
      }

      try {
        const cpuDetector = await FaceDetector.createFromModelBuffer(
          wasmFileset,
          modelBuffer
        )

        await this.configureDetector(cpuDetector, 'CPU')

        if (this.options.debug) {
          console.log(
            `MediaPipe FaceDetector (${label}) initialized on CPU using model: ${modelPath}`
          )
        }

        return cpuDetector
      } catch (cpuError) {
        if (required) {
          throw new Error(
            `Failed to initialize FaceDetector (${label}). Ensure ${modelPath} exists under public/models. ` +
              'Run `npm run setup` to download MediaPipe assets. ' +
              `Original error: ${cpuError}`
          )
        }

        if (this.options.debug) {
          console.warn(
            `Optional FaceDetector (${label}) could not be created on CPU. Continuing without it.`,
            cpuError
          )
        }

        return null
      }
    }
  }

  private async configureDetector(detector: FaceDetector, delegate: 'GPU' | 'CPU') {
    await detector.setOptions({
      baseOptions: {
        delegate
      },
      runningMode: 'IMAGE',
      minDetectionConfidence: this.options.minDetectionConfidence
    })
  }

  private async loadModelAsset(
    modelPath: string,
    label: 'short-range' | 'full-range',
    required: boolean
  ): Promise<Uint8Array | null> {
    try {
      const response = await fetch(modelPath, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const buffer = await response.arrayBuffer()
      if (buffer.byteLength === 0) {
        throw new Error('Model file is empty')
      }

      return new Uint8Array(buffer)
    } catch (error) {
      if (required) {
        throw new Error(
          `Failed to load face detector model (${label}) from ${modelPath}. ` +
            'Verify the file exists under public/models or rerun `npm run setup`. ' +
            `Original error: ${error}`
        )
      }

      if (this.options.debug) {
        console.warn(
          `Optional face detector model (${label}) could not be loaded from ${modelPath}.`,
          error
        )
      }

      return null
    }
  }

  async detect(blob: Blob): Promise<Face[]> {
    await this.initialized

    if (!this.shortRangeDetector) {
      throw new Error('FaceDetector not initialized')
    }

    const image = await this.createImageFromBlob(blob)

    try {
      const shortRange = await this.runDetector(
        this.shortRangeDetector,
        image,
        'short-range'
      )

      let mergedDetections = shortRange.detections
      const usedModels: Array<'short-range' | 'full-range'> = []

      if (mergedDetections.length > 0) {
        usedModels.push(shortRange.label)
      }

      if (this.fullRangeDetector && mergedDetections.length < this.options.maxFaces) {
        const fullRange = await this.runDetector(
          this.fullRangeDetector,
          image,
          'full-range'
        )

        if (fullRange.detections.length > 0) {
          mergedDetections = this.mergeDetections(mergedDetections, fullRange.detections)
          usedModels.push(fullRange.label)
        }
      }

      const limitedDetections = this.limitDetectionsToMaxFaces(mergedDetections)
      const faces = this.convertDetections(limitedDetections, image.width, image.height)

      if (this.options.debug) {
        console.log('[FaceDetector] Models used for detection:', usedModels)
        console.log(`[FaceDetector] detected ${faces.length} face(s)`) // eslint-disable-line no-console
      }

      return faces
    } finally {
      if (image instanceof ImageBitmap) {
        image.close()
      }
    }
  }

  private async runDetector(
    detector: FaceDetector,
    image: ImageBitmap | HTMLImageElement,
    label: 'short-range' | 'full-range'
  ): Promise<DetectorRunResult> {
    const result = detector.detect(image)
    return {
      detections: result.detections ?? [],
      label
    }
  }

  private mergeDetections(base: Detection[], fallback: Detection[]): Detection[] {
    const merged = [...base]

    fallback.forEach((candidate) => {
      const candidateBox = candidate.boundingBox
      if (!candidateBox) {
        return
      }

      const overlapping = merged.some((existing) => {
        const existingBox = existing.boundingBox
        if (!existingBox) {
          return false
        }
        return this.computeIoU(existingBox, candidateBox) > 0.3
      })

      if (!overlapping) {
        merged.push(candidate)
      }
    })

    return merged
  }

  private limitDetectionsToMaxFaces(detections: Detection[]): Detection[] {
    if (this.options.maxFaces <= 0) {
      return detections
    }

    const sorted = [...detections].sort((a, b) => {
      const scoreA = a.categories?.[0]?.score ?? 0
      const scoreB = b.categories?.[0]?.score ?? 0
      return scoreB - scoreA
    })

    return sorted.slice(0, this.options.maxFaces)
  }

  private convertDetections(
    detections: Detection[],
    imageWidth: number,
    imageHeight: number
  ): Face[] {
    return detections.map((detection, index) => {
      const boundingBox = detection.boundingBox

      const face: Face = {
        eyes: this.extractEyes(detection, imageWidth, imageHeight),
        x: boundingBox ? Math.round(boundingBox.originX) : 0,
        y: boundingBox ? Math.round(boundingBox.originY) : 0,
        width: boundingBox ? Math.round(boundingBox.width) : 0,
        height: boundingBox ? Math.round(boundingBox.height) : 0
      }

      if (this.options.debug) {
        const primaryScore = detection.categories?.[0]?.score ?? 0
        console.log(`Face ${index + 1} detected (score=${primaryScore.toFixed(3)})`, face)
      }

      return face
    })
  }

  private extractEyes(
    detection: Detection,
    imageWidth: number,
    imageHeight: number
  ): [Eye, Eye] {
    const keypoints = detection.keypoints ?? []
    const boundingBox = detection.boundingBox

    const rightEyeKeypoint = this.findKeypoint(
      keypoints,
      ['right_eye', 'rightEye', 'eye_right'],
      0
    )
    const leftEyeKeypoint = this.findKeypoint(
      keypoints,
      ['left_eye', 'leftEye', 'eye_left'],
      1
    )

    const rightEye = rightEyeKeypoint
      ? this.toEye(rightEyeKeypoint, imageWidth, imageHeight)
      : this.estimateEyeFromBox(boundingBox, 'right')

    const leftEye = leftEyeKeypoint
      ? this.toEye(leftEyeKeypoint, imageWidth, imageHeight)
      : this.estimateEyeFromBox(boundingBox, 'left')

    return [leftEye, rightEye]
  }

  private findKeypoint(
    keypoints: NormalizedKeypoint[],
    targetLabels: string[],
    fallbackIndex: number
  ): NormalizedKeypoint | undefined {
    const labeled = keypoints.find(
      (keypoint) => keypoint.label && targetLabels.includes(keypoint.label)
    )

    if (labeled) {
      return labeled
    }

    return keypoints[fallbackIndex]
  }

  private toEye(
    keypoint: NormalizedKeypoint,
    imageWidth: number,
    imageHeight: number
  ): Eye {
    return {
      x: Math.round(keypoint.x * imageWidth),
      y: Math.round(keypoint.y * imageHeight)
    }
  }

  private estimateEyeFromBox(
    boundingBox: BoundingBox | undefined,
    side: 'left' | 'right'
  ): Eye {
    if (!boundingBox) {
      return { x: 0, y: 0 }
    }

    const centerX = boundingBox.originX + boundingBox.width / 2
    const offsetX = boundingBox.width * 0.18
    const eyeY = boundingBox.originY + boundingBox.height * 0.32

    return {
      x: Math.round(side === 'left' ? centerX - offsetX : centerX + offsetX),
      y: Math.round(eyeY)
    }
  }

  private computeIoU(a: BoundingBox, b: BoundingBox): number {
    const xA = Math.max(a.originX, b.originX)
    const yA = Math.max(a.originY, b.originY)
    const xB = Math.min(a.originX + a.width, b.originX + b.width)
    const yB = Math.min(a.originY + a.height, b.originY + b.height)

    const intersection = Math.max(0, xB - xA) * Math.max(0, yB - yA)
    const areaA = a.width * a.height
    const areaB = b.width * b.height
    const union = areaA + areaB - intersection

    if (union <= 0) {
      return 0
    }

    return intersection / union
  }

  private async createImageFromBlob(
    blob: Blob
  ): Promise<ImageBitmap | HTMLImageElement> {
    if (typeof createImageBitmap !== 'undefined') {
      return await createImageBitmap(blob)
    }

    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(blob)

      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(img)
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load image from blob'))
      }

      img.src = url
    })
  }

  async dispose(): Promise<void> {
    if (this.shortRangeDetector) {
      this.shortRangeDetector.close()
      this.shortRangeDetector = null
    }

    if (this.fullRangeDetector) {
      this.fullRangeDetector.close()
      this.fullRangeDetector = null
    }
  }
}
