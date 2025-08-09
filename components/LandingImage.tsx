import React, { useState, useEffect, useRef, useCallback } from 'react'
import './LandingImage.css'


export default function LandingImage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showMan, setShowMan] = useState(false);
  const [showWoman, setShowWoman] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const onLoad = useCallback(() => {
    setIsLoaded(true);
    if (!hasAnimated) {
      if (Math.random() > 0.5) {
        setShowMan(true);
      }
      if (Math.random() > 0.5) {
        setShowWoman(true);
      }
      setTimeout(() => {
        setHasAnimated(true);
      }, 5000);
    }
  }, [hasAnimated]);

  useEffect(() => {
    // Check if image is already loaded (from cache)
    if (imgRef.current && imgRef.current.complete) {
      console.log('Image already loaded from cache');
      onLoad();
    }
  }, [imgRef.current])

  const imgClass = `w-full h-auto object-contain ${isLoaded ? 'opacity-100' : 'opacity-0'}`;

  return (
    <div style={{ width: '100%', position: 'relative' }} className={`mb-6 ${hasAnimated ? '' : 'landing-image-component'}`}>
      <img
        ref={imgRef}
        src="/mesen.webp"
        alt="目線入れアプリ"
        width={800}
        height={557}
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
            stroke="#666666"
            strokeWidth="20"
            strokeLinecap="round"
          />
          <line
            x1="300"
            y1="50"
            x2="345"
            y2="50"
            stroke="#666666"
            strokeWidth="20"
            strokeLinecap="round"
          />
          <line
            x1="465"
            y1="45"
            x2="500"
            y2="45"
            stroke="#666666"
            strokeWidth="20"
            strokeLinecap="round"
          />
          <line
            x1="565"
            y1="90"
            x2="615"
            y2="90"
            stroke="#666666"
            strokeWidth="20"
            strokeLinecap="round"
          />
          <line
            x1="660"
            y1="47"
            x2="690"
            y2="47"
            stroke="#666666"
            strokeWidth="20"
            strokeLinecap="round"
          />
          <line
            x1="765"
            y1="80"
            x2="815"
            y2="80"
            stroke="#666666"
            strokeWidth="20"
            strokeLinecap="round"
          />
          <line
            x1="910"
            y1="59"
            x2="960"
            y2="59"
            stroke="#666666"
            strokeWidth="20"
            strokeLinecap="round"
          />
          {showMan && (
            <line

              x1="280"
              y1="445"
              x2="410"
              y2="445"
              stroke="#666666"
              strokeWidth="40"
              strokeLinecap="round"
            />
          )}
          {showWoman && (
            <line
              x1="590"
              y1="520"
              x2="710"
              y2="520"
              stroke="#666666"
              strokeWidth="40"
              strokeLinecap="round"
            />
          )}
        </svg>
      )}
    </div>
  )
}
