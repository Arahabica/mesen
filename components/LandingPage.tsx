import React, { useRef } from 'react'
import { ImageData } from '@/types/editor'
import LandingImage from './LandingImage'

interface LandingPageProps {
  onImageSelect: (imageData: ImageData) => void
  isVisible?: boolean
}

export default function LandingPage({ onImageSelect, isVisible = true }: LandingPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
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
              <div className="flex items-start space-x-2">
                <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-sm">✓</span>
                </div>
                <p className="text-gray-700">背景に写り込んだ通行人の顔を隠したい</p>
              </div>
              <div className="flex items-start space-x-2">
                <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-sm">✓</span>
                </div>
                <p className="text-gray-700">お店や観光地で他の人が写ってしまった</p>
              </div>
              <div className="flex items-start space-x-2">
                <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-sm">✓</span>
                </div>
                <p className="text-gray-700">スタンプやモザイクより自然に隠したい</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-lg font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
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