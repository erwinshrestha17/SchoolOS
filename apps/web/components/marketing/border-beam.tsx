import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
}

export function BorderBeam({
  className,
  size = 350,
  duration = 6,
  borderWidth = 2,
  colorFrom = "#3b82f6", // Blue-500
  colorTo = "#8b5cf6",   // Purple-500
}: BorderBeamProps) {
  const uniqueId = React.useId().replace(/:/g, "-");

  return (
    <>
      <style>{`
        @keyframes border-beam-spin-${uniqueId} {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        .border-beam-container-${uniqueId} {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          z-index: 10;
          overflow: hidden;
        }
        .border-beam-glow-${uniqueId} {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: ${borderWidth}px;
          background: conic-gradient(from 0deg, ${colorFrom}, ${colorTo}, transparent 40%);
          animation: border-beam-spin-${uniqueId} ${duration}s linear infinite;
          
          /* Web standards masking to show only padding edge */
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: exclude;
        }
      `}</style>
      <div className={cn(`border-beam-container-${uniqueId}`, className)}>
        <div className={`border-beam-glow-${uniqueId}`} />
      </div>
    </>
  );
}
