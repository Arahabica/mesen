import React, { useState, useEffect, useRef, useCallback } from 'react'


export default function LandingImage() {
  const [isLoaded, setIsLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const onLoad = useCallback(() => {
    setIsLoaded(true)
  }, []);

  useEffect(() => {
    // Check if image is already loaded (from cache)
    if (imgRef.current && imgRef.current.complete) {
      console.log('Image already loaded from cache');
      onLoad()
    }
  }, [])

  const imgClass = `w-full h-auto object-contain mb-8 ${isLoaded ? 'opacity-100' : 'opacity-0'}`;

  return (
    <div style={{ width: '100%' }}>
      <img
        ref={imgRef}
        src="/mesen.webp"
        alt="目線入れアプリ"
        width={1024}
        height={712}
        className={imgClass}
        onLoad={onLoad}
        onError={(e) => console.error('Image failed to load:', e)}
      />
    </div>
  )
}
