import React, { useEffect, useRef } from 'react'
import { ImageData } from '@/types/editor'
import LandingImage from './LandingImage'
import { MediaPipeFaceDetector } from '@/ai/MediaPipeFaceDetector'
import type { Face } from '@/ai/types'

interface LandingPageProps {
  onImageSelect: (imageData: ImageData) => void
  isVisible?: boolean
}

export default function LandingPage({ onImageSelect, isVisible = true }: LandingPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const faceDetectorRef = useRef<MediaPipeFaceDetector | null>(null)

  useEffect(() => {
    faceDetectorRef.current = new MediaPipeFaceDetector({
      maxFaces: 12,
      minDetectionConfidence: 0.08,
      debug: true
    })

    return () => {
      faceDetectorRef.current?.dispose().catch((error) => {
        console.warn('Failed to dispose FaceDetector', error)
      })
      faceDetectorRef.current = null
    }
  }, [])

  const logFaces = (faces: Face[], filename: string) => {
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
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const file = input.files?.[0]
    input.value = ''

    if (file) {
      const detector = faceDetectorRef.current

      if (detector) {
        detector
          .detect(file)
          .then((faces) => logFaces(faces, file.name))
          .catch((error) => {
            console.error('[FaceDetector] Detection failed', error)
          })
      } else {
        console.warn('[FaceDetector] Detector not initialized')
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        onImageSelect({
          dataURL: e.target?.result as string,
          filename: file.name
        })
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="h-dvh bg-white flex flex-col overflow-hidden" style={{ display: isVisible ? 'flex' : 'none' }}>
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 max-w-sm mx-auto">
          <LandingImage />
          <div className="text-center mb-4">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">目線入れ</h1>
            <p className="text-lg text-gray-600">
              余計な機能なしの<br />
              究極シンプル目線入れアプリ
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-3 text-center">こんな時に</h2>
            <div className="space-y-4">
              <div className="flex items-start space-x-1">
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  <span className="text-gray-600 text-sm">✓</span>
                </div>
                <p className="text-gray-700">背景に写り込んだ通行人の顔を隠したい</p>
              </div>
              <div className="flex items-start space-x-1">
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  <span className="text-gray-600 text-sm">✓</span>
                </div>
                <p className="text-gray-700">お店や観光地で他の人が写ってしまった</p>
              </div>
              <div className="flex items-start space-x-1">
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  <span className="text-gray-600 text-sm">✓</span>
                </div>
                <p className="text-gray-700">スタンプやモザイクより自然に隠したい</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-2xl font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            画像を選択
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
        </div>
      </div>

      <footer className="flex-shrink-0 bg-gray-100 py-4 text-center">
        <a
          href="https://x.com/Arahabica1"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-600 hover:text-gray-800 transition-colors duration-200"
        >
          開発者: @Arahabica1
        </a>
      </footer>
    </div>
  )
}
