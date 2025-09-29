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

export class MediaPipeFaceDetector implements FaceDetectorContract {
  private shortRangeDetector: FaceDetector | null = null
  private readonly initialized: Promise<void>
  private readonly options: Required<FaceDetectorOptions>
  private readonly modelCache = new Map<string, Uint8Array>()
  private gpuCanvas: HTMLCanvasElement | OffscreenCanvas | null = null

  private readonly LOCAL_WASM_PATH = '/mediapipe/wasm'
  private readonly SHORT_RANGE_MODEL_PATH = '/models/face_detection_short_range.task'

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
    label: 'short-range',
    required: boolean
  ): Promise<FaceDetector | null> {
    const modelBuffer = await this.loadModelAsset(modelPath, label, required)
    if (!modelBuffer) {
      return null
    }

    try {
      const gpuCanvas = this.getGpuCanvas()

      if (gpuCanvas) {
        try {
          const detector = await FaceDetector.createFromOptions(wasmFileset, {
            baseOptions: {
              modelAssetBuffer: modelBuffer,
              delegate: 'GPU'
            },
            runningMode: 'IMAGE',
            minDetectionConfidence: this.options.minDetectionConfidence,
            canvas: gpuCanvas
          })

          if (this.options.debug) {
            console.log(`MediaPipe FaceDetector (${label}) initialized (GPU) using model: ${modelPath}`)
          }

          return detector
        } catch (gpuError) {
          if (this.options.debug) {
            console.warn(
              `FaceDetector (${label}) could not initialize on GPU. Falling back to CPU.`,
              gpuError
            )
          }
        }
      } else if (this.options.debug) {
        console.warn('WebGL2 context unavailable. Using CPU delegate for FaceDetector.')
      }

      const cpuDetector = await FaceDetector.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetBuffer: modelBuffer,
          delegate: 'CPU'
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: this.options.minDetectionConfidence
      })

      if (this.options.debug) {
        console.log(`MediaPipe FaceDetector (${label}) initialized (CPU) using model: ${modelPath}`)
      }

      return cpuDetector
    } catch (error) {
      if (required) {
        throw new Error(
          `Failed to initialize FaceDetector (${label}). Ensure ${modelPath} exists under public/models. ` +
            'Run `npm run setup` to download MediaPipe assets. ' +
            `Original error: ${error}`
        )
      }

      if (this.options.debug) {
        console.warn(
          `Optional FaceDetector (${label}) could not be created. Continuing without it.`,
          error
        )
      }

      return null
    }
  }

  private getGpuCanvas(): HTMLCanvasElement | OffscreenCanvas | null {
    if (this.gpuCanvas) {
      return this.gpuCanvas
    }

    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        const offscreen = new OffscreenCanvas(4, 4)
        const gl = offscreen.getContext('webgl2') ?? offscreen.getContext('webgl')
        if (gl) {
          this.gpuCanvas = offscreen
          return this.gpuCanvas
        }
      }
    } catch (error) {
      if (this.options.debug) {
        console.warn('Failed to create OffscreenCanvas for GPU delegate.', error)
      }
    }

    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas')
      canvas.width = 4
      canvas.height = 4
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
      if (gl) {
        this.gpuCanvas = canvas
        return this.gpuCanvas
      }
    }

    return null
  }

  private async loadModelAsset(
    modelPath: string,
    label: 'short-range',
    required: boolean
  ): Promise<Uint8Array | null> {
    const cached = this.modelCache.get(modelPath)
    if (cached) {
      return cached
    }

    try {
      const response = await fetch(modelPath)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const buffer = await response.arrayBuffer()
      if (buffer.byteLength === 0) {
        throw new Error('Model file is empty')
      }
      const payload = new Uint8Array(buffer)
      this.modelCache.set(modelPath, payload)
      return payload
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
      const result = this.shortRangeDetector.detect(image)
      const detections = result.detections ?? []
      const limitedDetections = this.limitDetectionsToMaxFaces(detections)
      const faces = this.convertDetections(limitedDetections, image.width, image.height)

      if (this.options.debug) {
        console.log(`[FaceDetector] detected ${faces.length} face(s)`) // eslint-disable-line no-console
      }

      return faces
    } finally {
      if (image instanceof ImageBitmap) {
        image.close()
      }
    }
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
  }
}
