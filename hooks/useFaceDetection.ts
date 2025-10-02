import { useState, useCallback, useRef } from 'react'
import type { Face } from '@/ai/types'
import type { Line } from '@/types/editor'
import { generateLinesForFaces, filterDuplicateLines } from '@/utils/faceLineGenerator'
import { FaceDetectorLazy } from '@/ai/FaceDetectorLazy'

interface UseFaceDetectionOptions {
  imageSize: { width: number; height: number }
  thicknessOptions: number[]
  existingLines: Line[]
  onLinesAdd: (lines: Line[]) => void
}

interface UseFaceDetectionReturn {
  isDetecting: boolean
  isScanning: boolean
  showError: boolean
  errorMessage: string
  showNoFace: boolean
  animatingLine: Line | null
  animationProgress: number
  greenLines: Line[]
  colorTransitionProgress: number
  isAiDetectionLine: boolean
  detectFaces: (imageDataURL: string, filename: string) => Promise<void>
  hideError: () => void
  hideNoFace: () => void
  setIsAiDetectionLine: (value: boolean) => void
}

export function useFaceDetection(options: UseFaceDetectionOptions): UseFaceDetectionReturn {
  const { imageSize, thicknessOptions, existingLines, onLinesAdd } = options

  const [isDetecting, setIsDetecting] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [showError, setShowError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showNoFace, setShowNoFace] = useState(false)
  const [animatingLine, setAnimatingLine] = useState<Line | null>(null)
  const [animationProgress, setAnimationProgress] = useState(0)
  const [greenLines, setGreenLines] = useState<Line[]>([])
  const [colorTransitionProgress, setColorTransitionProgress] = useState(0)
  const [isAiDetectionLine, setIsAiDetectionLine] = useState(false)

  const detectorRef = useRef<FaceDetectorLazy | null>(null)

  // Initialize detector on first use
  const getDetector = useCallback(() => {
    if (!detectorRef.current) {
      detectorRef.current = new FaceDetectorLazy({
        maxFaces: 50,
        minDetectionConfidence: 0.35,
        minFaceAreaRatio: 0.00003,
        mergeIoUThreshold: 0.4,
        additionalScales: [1.5, 2],
        maxUpscaleFactor: 2.4,
        upscaleTargetDimension: 1800,
        modelBasePath: '/face-api',
        debug: true
      })
    }
    return detectorRef.current
  }, [])

  const logFaces = useCallback((faces: Face[], filename: string) => {
    const prefix = '[FaceDetector]'

    if (faces.length === 0) {
      console.log(`${prefix} ${filename}: no faces detected`)
      return
    }

    console.log(`${prefix} ${filename}: detected ${faces.length} face(s)`)

    faces.forEach((face, index) => {
      console.log(
        `${prefix} Face ${index + 1} bounds -> x: ${face.x}, y: ${face.y}, width: ${face.width}, height: ${face.height}`
      )

      face.eyes.forEach((eye, eyeIndex) => {
        const label = eyeIndex === 0 ? 'leftEye' : 'rightEye'
        console.log(`${prefix} Face ${index + 1} ${label} -> x: ${eye.x}, y: ${eye.y}`)
      })
    })
  }, [])

  const animateLines = useCallback(async (uniqueLines: Line[]) => {
    const animationDuration = 180 // AI検出の目線を引くアニメーション時間 0.18 seconds
    const frameRate = 60 // 60fps
    const frameInterval = 1000 / frameRate
    const tempGreenLines: Line[] = []

    for (let i = 0; i < uniqueLines.length; i++) {
      const line = uniqueLines[i]

      // Show green animating line
      setAnimatingLine(line)

      // Animate from 0 to 1 over animationDuration
      const startTime = Date.now()

      while (true) {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / animationDuration, 1)

        setAnimationProgress(progress)

        if (progress >= 1) break

        await new Promise(resolve => setTimeout(resolve, frameInterval))
      }

      // Clear animating line first
      setAnimatingLine(null)
      setAnimationProgress(0)

      // Add to green lines (temporary)
      tempGreenLines.push(line)
      setGreenLines([...tempGreenLines])

      // Small delay before next line
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    // Animate color transition from green to black over 700ms
    const colorTransitionDuration = 700
    const colorStartTime = Date.now()

    while (true) {
      const elapsed = Date.now() - colorStartTime
      const progress = Math.min(elapsed / colorTransitionDuration, 1)

      setColorTransitionProgress(progress)

      if (progress >= 1) break

      await new Promise(resolve => setTimeout(resolve, frameInterval))
    }

    // Convert all green lines to black
    onLinesAdd(tempGreenLines)
    setGreenLines([])
    setColorTransitionProgress(0)
  }, [onLinesAdd])

  const detectFaces = useCallback(async (imageDataURL: string, filename: string) => {
    // Setup unhandled rejection handler for this detection session
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[FaceDetector] Unhandled rejection:', event.reason)
      setErrorMessage('AI検出でエラーが発生しました')
      setShowError(true)
      setIsScanning(false)
      setIsDetecting(false)
      event.preventDefault()
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    try {
      setIsScanning(true)
      setIsDetecting(true)

      const detector = getDetector()
      if (!detector) {
        console.warn('[FaceDetector] Detector not initialized')
        setErrorMessage('AI検出の初期化に失敗しました')
        setShowError(true)
        setIsScanning(false)
        window.removeEventListener('unhandledrejection', handleUnhandledRejection)
        return
      }

      const response = await fetch(imageDataURL)
      const blob = await response.blob()
      const faces = await detector.detect(blob)
      logFaces(faces, filename)

      if (faces.length === 0) {
        setShowNoFace(true)
        setIsScanning(false)
        setIsDetecting(false)
        window.removeEventListener('unhandledrejection', handleUnhandledRejection)
        return
      }

      if (imageSize.width === 0 || imageSize.height === 0) {
        console.warn('[FaceDetector] Image size unavailable; skipping auto eye lines')
        return
      }

      const filteredThicknessOptions = thicknessOptions.filter(option => option > 0)
      if (filteredThicknessOptions.length === 0) {
        console.warn('[FaceDetector] No valid thickness options; skipping auto eye lines')
        return
      }

      const eyeLines = generateLinesForFaces(faces, filteredThicknessOptions)

      if (eyeLines.length === 0) {
        return
      }

      // Mark as AI detection line for tooltip display
      setIsAiDetectionLine(true)

      // Filter out duplicate lines
      const uniqueLines = filterDuplicateLines(eyeLines, existingLines)

      if (uniqueLines.length === 0) {
        // Remove handler after completion
        window.removeEventListener('unhandledrejection', handleUnhandledRejection)
        setIsScanning(false)
        setIsDetecting(false)
        return
      }

      // Remove handler after successful completion
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)

      // Stop scanning immediately after detection completes
      setIsScanning(false)
      setIsDetecting(false)

      // Animate lines one by one
      await animateLines(uniqueLines)
    } catch (error) {
      console.error('[FaceDetector] Detection failed', error)
      setErrorMessage('AI検出でエラーが発生しました')
      setShowError(true)
      setIsScanning(false)
      setIsDetecting(false)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [imageSize, thicknessOptions, existingLines, getDetector, logFaces, animateLines])

  const hideError = useCallback(() => {
    setShowError(false)
  }, [])

  const hideNoFace = useCallback(() => {
    setShowNoFace(false)
  }, [])

  return {
    isDetecting,
    isScanning,
    showError,
    errorMessage,
    showNoFace,
    animatingLine,
    animationProgress,
    greenLines,
    colorTransitionProgress,
    isAiDetectionLine,
    detectFaces,
    hideError,
    hideNoFace,
    setIsAiDetectionLine
  }
}
