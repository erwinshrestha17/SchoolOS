'use client';

import type { CSSProperties, PropsWithChildren } from 'react';
import { MotionConfig } from 'motion/react';

export const schoolOSMotion = {
  fast: 0.14,
  standard: 0.18,
  deliberate: 0.22,
  easeOut: [0.2, 0.8, 0.2, 1] as const,
};

const motionVariables = {
  '--schoolos-motion-fast': `${schoolOSMotion.fast}s`,
  '--schoolos-motion-standard': `${schoolOSMotion.standard}s`,
  '--schoolos-motion-deliberate': `${schoolOSMotion.deliberate}s`,
  '--schoolos-motion-ease-out': `cubic-bezier(${schoolOSMotion.easeOut.join(',')})`,
} as CSSProperties;

/**
 * One global motion-token boundary. The provider deliberately adds no page
 * entrance animation; feature components opt into the approved tokens only.
 * Motion for React is configured here so every approved animation shares the
 * same timing and respects the user's reduced-motion preference. Operational
 * controls remain functional without animation.
 */
export function SchoolOSMotionProvider({ children }: PropsWithChildren) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{
        duration: schoolOSMotion.standard,
        ease: schoolOSMotion.easeOut,
      }}
    >
      <div style={motionVariables} className="contents" data-schoolos-motion="global">
        {children}
      </div>
    </MotionConfig>
  );
}
