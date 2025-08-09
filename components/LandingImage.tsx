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
      onLoad();
    }
  }, [imgRef.current])

  const imgClass = `w-full h-auto object-contain mb-8 ${isLoaded ? 'opacity-100' : 'opacity-0'}`;

  return (
    <div style={{ width: '100%', position: 'relative' }}>
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
      {isLoaded && (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none'
          }}
          viewBox="0 0 1024 712"
          preserveAspectRatio="xMidYMid meet"
        >
          <line
            x1="65"
            y1="73"
            x2="110"
            y2="73"
            stroke="#808080"
            strokeWidth="20"
            strokeLinecap="round"
            opacity="0"
          >
          <animate
            attributeName="opacity"
            from="0"
            to="1"
            dur="0.2s"
            begin="0s"
            fill="freeze"
          />
          <animate
            attributeName="x2"
            from="65"
            to="110"
            dur="1s"
            begin="0s"
            fill="freeze"
          />
          </line>
        </svg>
      )}
    </div>
  )
}
