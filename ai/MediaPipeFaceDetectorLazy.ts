import type { Face, FaceDetector as FaceDetectorContract, FaceDetectorOptions } from './types'
import type { MediaPipeFaceDetector as MediaPipeFaceDetectorType } from './MediaPipeFaceDetector'

/**
 * Lazily loads the heavy MediaPipe implementation the first time detection is requested.
 */
export class MediaPipeFaceDetectorLazy implements FaceDetectorContract {
  private detector: MediaPipeFaceDetectorType | null = null
  private loadPromise: Promise<MediaPipeFaceDetectorType> | null = null

  constructor(private readonly options: FaceDetectorOptions = {}) {}

  private async ensureDetector(): Promise<MediaPipeFaceDetectorType> {
    if (this.detector) {
      return this.detector
    }

    if (!this.loadPromise) {
      this.loadPromise = import('./MediaPipeFaceDetector')
        .then(({ MediaPipeFaceDetector }) => {
          const detector = new MediaPipeFaceDetector(this.options)
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
