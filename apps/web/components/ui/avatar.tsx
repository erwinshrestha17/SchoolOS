'use client';

import Image from 'next/image';
import { cn } from '../../lib/utils';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  initials?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

export function Avatar({ src, alt, initials, size = 'md', className }: AvatarProps) {
  return (
    <div
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full',
        sizeMap[size],
        className
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt ?? 'Avatar'}
          fill
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--primary),var(--primary-dark))] font-bold text-white">
          {initials ?? 'U'}
        </div>
      )}
    </div>
  );
}
