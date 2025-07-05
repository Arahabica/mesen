type TemporalTooltipProps = {
  text: string;
  show: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function TemporalTooltip({
  text,
  show,
  className,
  style,
}: TemporalTooltipProps) {
  return (
  <div 
    className={
      `absolute px-3 py-1.5 bg-gray-800 text-white text-sm rounded-md whitespace-nowrap pointer-events-none transition-all duration-700 ease-out z-20
      ${
        show ? 'opacity-90 transform translate-y-0 scale-100' : 'opacity-0 transform translate-y-3 scale-95'
      }
      ${className || ''}
      `
    }
    style={style || {}}
  >
    {text}
    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
      <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-gray-800"></div>
    </div>
  </div>
  );
}
