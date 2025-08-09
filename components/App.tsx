'use client'

import React, { useState, lazy, Suspense } from 'react'
import { ImageData } from '@/types/editor'
import LandingPage from './LandingPage'

const ImageEditor = lazy(() => import('./ImageEditor'))

export default function App() {
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null)

  const handleImageSelect = (imageData: ImageData) => {
    setSelectedImage(imageData)
  }

  const handleReset = () => {
    setSelectedImage(null)
  }

  return (
    <>
      <LandingPage 
        onImageSelect={handleImageSelect} 
        isVisible={!selectedImage}
      />
      {selectedImage && (
        <Suspense fallback={
          <div className="h-dvh bg-gray-900 flex items-center justify-center animate-simpleFadeIn" />
        }>
          <ImageEditor 
            initialImage={selectedImage} 
            onReset={handleReset}
          />
        </Suspense>
      )}
    </>
  )
}