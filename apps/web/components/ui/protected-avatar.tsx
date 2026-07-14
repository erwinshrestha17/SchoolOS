'use client';

import { ImageOff, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './primitives/avatar';
import { cn } from '../../lib/utils';
import type { ProtectedImageFetchState } from '../../lib/hooks/use-protected-image';

export type ProtectedAvatarSize = 'sm' | 'md' | 'lg' | 'xl';
export type ProtectedAvatarState = ProtectedImageFetchState | 'missing';

const sizeClasses: Record<ProtectedAvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

// Presentational only - no fetching here. Built on the Radix-based primitives
// Avatar (AvatarImage renders a real <img>, unlike the legacy next/image-based
// Avatar, so it safely accepts blob: object URLs from protected fetches).
export function ProtectedAvatar({
  state,
  src,
  initials,
  alt,
  size = 'md',
  className,
}: {
  state: ProtectedAvatarState;
  src: string | null;
  initials?: string;
  alt?: string;
  size?: ProtectedAvatarSize;
  className?: string;
}) {
  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {state === 'ready' && src ? (
        <AvatarImage src={src} alt={alt ?? 'Avatar'} className="object-cover" />
      ) : null}
      <AvatarFallback className="bg-[linear-gradient(135deg,var(--primary),var(--primary-dark))] font-bold text-white">
        {state === 'loading' ? (
          <Loader2 className="h-1/2 w-1/2 animate-spin" aria-label="Loading photo" />
        ) : state === 'denied' || state === 'error' ? (
          <ImageOff className="h-1/2 w-1/2" aria-label="Photo unavailable" />
        ) : (
          initials || 'U'
        )}
      </AvatarFallback>
    </Avatar>
  );
}
