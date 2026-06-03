'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

export interface NumberTickerProps {
  value: number;
  direction?: 'up' | 'down';
  delay?: number; // in seconds
  duration?: number; // in milliseconds
  className?: string;
  formatter?: (val: number) => string;
}

export function NumberTicker({
  value,
  direction = 'up',
  delay = 0,
  duration = 1500,
  className,
  formatter = (val) => Math.round(val).toLocaleString(),
}: NumberTickerProps) {
  const [displayValue, setDisplayValue] = React.useState(direction === 'up' ? 0 : value);

  React.useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = direction === 'up' ? 0 : value;
    const endValue = direction === 'up' ? value : 0;
    
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Easing function: easeOutQuad
      const easedProgress = progress * (2 - progress);
      const current = startValue + easedProgress * (endValue - startValue);
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
      }
    };

    const timeoutId = setTimeout(() => {
      animationFrameId = requestAnimationFrame(step);
    }, delay * 1000);

    return () => {
      clearTimeout(timeoutId);
      cancelAnimationFrame(animationFrameId);
    };
  }, [value, direction, delay, duration]);

  return <span className={cn("tabular-nums inline-block", className)}>{formatter(displayValue)}</span>;
}
