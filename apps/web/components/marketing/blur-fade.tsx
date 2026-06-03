'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  duration?: number; // in seconds
  delay?: number; // in seconds
  yOffset?: number; // in pixels
  blur?: string; // blur size e.g. "6px"
  inView?: boolean;
}

export function BlurFade({
  children,
  className,
  duration = 0.6,
  delay = 0,
  yOffset = 8,
  blur = "6px",
  inView = true,
}: BlurFadeProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const elementRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!inView) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.05,
      }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [inView]);

  return (
    <div
      ref={elementRef}
      style={{
        transitionDuration: `${duration}s`,
        transitionDelay: `${delay}s`,
        filter: isVisible ? 'blur(0px)' : `blur(${blur})`,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0px)' : `translateY(${yOffset}px)`,
      }}
      className={cn("transition-all ease-out", className)}
    >
      {children}
    </div>
  );
}
