'use client';

import { useEffect, useState, type RefObject } from 'react';

// Reports true once the element has scrolled near the viewport, then stops
// observing - used to lazy-trigger protected-image fetches so a long list
// doesn't fire a request per row on first paint.
export function useInViewport(ref: RefObject<Element | null>, options?: { rootMargin?: string }): boolean {
  const [visible, setVisible] = useState(false);
  const rootMargin = options?.rootMargin ?? '160px';

  useEffect(() => {
    const element = ref.current;
    if (!element || visible) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin, visible]);

  return visible;
}
