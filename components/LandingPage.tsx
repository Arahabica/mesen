import React, { useRef } from 'react'

interface LandingPageProps {
  onImageSelect: (image: string) => void
}

export default function LandingPage({ onImageSelect }: LandingPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        onImageSelect(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="min-h-screen bg-white px-4 py-8">
      <div className="max-w-sm mx-auto">
        <div className="text-center mb-8">
          <img 
            src="/ogp.png" 
            alt="目線入れ" 
            className="w-16 h-16 mx-auto mb-4 rounded-lg shadow-md"
          />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">目線入れ</h1>
          <p className="text-lg text-gray-600">
            機能は黒線を引くことだけ！<br />
            余計な編集機能なしの<br />
            究極シンプル目隠しアプリ
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">こんな時に便利！</h2>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-sm">✓</span>
              </div>
              <p className="text-gray-700">背景に写り込んだ通行人の顔を隠したい</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-sm">✓</span>
              </div>
              <p className="text-gray-700">お店や観光地で他の人が写ってしまった</p>
            </div>
            <div className="flex items-start space-x-3">
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
  )
}