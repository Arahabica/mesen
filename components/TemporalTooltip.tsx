import { useEffect, useState, useRef } from "react";
import { calculateAdaptiveTooltipPosition, TooltipPosition } from "@/utils/tooltipPosition";
import { Position } from "@/types/editor";

type TemporalTooltipProps = {
  text: string;
  show: boolean;
  duration: number;
  className?: string;
  style?: React.CSSProperties;
  onClose?: () => void;
  targetPosition?: Position;
  preferredPlacement?: TooltipPosition;
}

export default function TemporalTooltip({
  text,
  show,
  duration,
  className,
  style,
  onClose,
  targetPosition,
  preferredPlacement = 'top',
}: TemporalTooltipProps) {
  const [isVisible, setIsVisible] = useState(show);
  const [adjustedStyle, setAdjustedStyle] = useState<React.CSSProperties>(style || {});
  const [placement, setPlacement] = useState<TooltipPosition>(preferredPlacement);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  useEffect(() => {
    if (show && targetPosition && tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      const dimensions = {
        width: rect.width,
        height: rect.height,
      };

      const result = calculateAdaptiveTooltipPosition(
        targetPosition,
        dimensions,
        preferredPlacement
      );

      setAdjustedStyle({
        ...style,
        left: result.position.x,
        top: result.position.y,
        transform: 'none',
      });
      setPlacement(result.placement);
    } else if (style) {
      setAdjustedStyle(style);
    }
  }, [show, targetPosition, preferredPlacement, style, text]);

  const arrowClasses = {
    top: "absolute top-full left-1/2 -translate-x-1/2 -mt-1",
    bottom: "absolute bottom-full left-1/2 -translate-x-1/2 -mb-1",
    left: "absolute left-full top-1/2 -translate-y-1/2 -ml-1",
    right: "absolute right-full top-1/2 -translate-y-1/2 -mr-1",
  };

  const arrowStyles = {
    top: "w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-gray-800",
    bottom: "w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-4 border-b-gray-800",
    left: "w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-l-4 border-l-gray-800",
    right: "w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-r-4 border-r-gray-800",
  };

  return (
    <>
      <div
        ref={tooltipRef}
        className={
          `absolute px-3 py-1.5 bg-gray-800 text-white text-sm rounded-md 
          whitespace-nowrap pointer-events-none transition-all duration-700 ease-out
          ${
            isVisible ? 'opacity-80 transform translate-y-0 scale-100' : 'opacity-0 transform translate-y-3 scale-95'
          }
          ${className || ''}
          `
        }
        style={adjustedStyle}
      >
        {text}
        <div className={arrowClasses[placement]}>
          <div className={arrowStyles[placement]}></div>
        </div>
      </div>
    </>
  );
}
