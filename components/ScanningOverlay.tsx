import React from 'react'

interface ScanningOverlayProps {
  visible: boolean
}

export default function ScanningOverlay({ visible }: ScanningOverlayProps) {
  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto">
      {/* Dark background */}
      <div className="absolute inset-0 bg-black bg-opacity-70 backdrop-blur-sm" />

      {/* Grid lines */}
      <div className="absolute inset-0 grid-overlay" />

      {/* Scanning line */}
      <div className="scan-line-container">
        <div className="scan-line-glow" />
        <div className="scan-line-main" />
        <div className="scan-line-trail" />
      </div>

      {/* Scanning text */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
        <p className="text-green-400 text-lg font-medium tracking-wider animate-pulse">
          AI SCANNING...
        </p>
      </div>

      <style jsx>{`
        .grid-overlay {
          background-image:
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 49px,
              rgba(0, 255, 0, 0.1) 49px,
              rgba(0, 255, 0, 0.1) 50px
            ),
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 49px,
              rgba(0, 255, 0, 0.05) 49px,
              rgba(0, 255, 0, 0.05) 50px
            );
          animation: gridFade 2.5s ease-in-out;
        }

        .scan-line-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 100%;
          overflow: hidden;
        }

        .scan-line-glow {
          position: absolute;
          top: -100px;
          left: 0;
          right: 0;
          height: 100px;
          background: linear-gradient(
            to bottom,
            transparent,
            rgba(0, 255, 0, 0.3),
            transparent
          );
          box-shadow: 0 0 40px 10px rgba(0, 255, 0, 0.5);
          animation: scanDown 2.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .scan-line-main {
          position: absolute;
          top: -4px;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(
            to bottom,
            rgba(0, 255, 0, 0.3),
            rgba(0, 255, 0, 1),
            rgba(0, 255, 0, 1),
            rgba(0, 255, 0, 0.3)
          );
          box-shadow:
            0 0 20px 4px rgba(0, 255, 0, 0.8),
            0 0 40px 8px rgba(0, 255, 0, 0.4);
          animation: scanDown 2.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .scan-line-trail {
          position: absolute;
          top: -60px;
          left: 0;
          right: 0;
          height: 60px;
          background: linear-gradient(
            to bottom,
            transparent,
            rgba(0, 255, 0, 0.1)
          );
          animation: scanDown 2.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        @keyframes scanDown {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(100vh);
          }
        }

        @keyframes gridFade {
          0% {
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  )
}
