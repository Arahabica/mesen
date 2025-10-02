import type { Face, FaceDetector as FaceDetectorContract } from './types'
import type { FaceApiDetectorOptions } from './FaceApiDetector'

export class FaceDetectorLazy implements FaceDetectorContract {
  private detector: FaceDetectorContract | null = null
  private loadPromise: Promise<FaceDetectorContract> | null = null

  constructor(private readonly options: FaceApiDetectorOptions = {}) {}

  private async ensureDetector(): Promise<FaceDetectorContract> {
    if (this.detector) {
      return this.detector
    }

    if (!this.loadPromise) {
      this.loadPromise = import('./FaceApiDetector')
        .then(({ FaceApiDetector }) => {
          const detector = new FaceApiDetector(this.options)
          this.detector = detector
          return detector
        })
        .catch((error) => {
          this.loadPromise = null
          throw error
        })
    }

    return this.loadPromise
  }

  async detect(blob: Blob): Promise<Face[]> {
    const detector = await this.ensureDetector()
    return detector.detect(blob)
  }

  async dispose(): Promise<void> {
    if (this.detector) {
      await this.detector.dispose()
      this.detector = null
    }
    this.loadPromise = null
  }
}
