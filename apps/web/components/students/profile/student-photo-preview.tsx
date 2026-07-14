'use client';

import { ImageOff, Loader2 } from 'lucide-react';
import { studentsApi } from '@/lib/api/students';
import { useProtectedImage } from '@/lib/hooks/use-protected-image';

type StudentPhotoPreviewProps = {
  studentId: string;
  photoVersion?: string | null;
  alt: string;
  className?: string;
};

export function StudentPhotoPreview({
  studentId,
  photoVersion,
  alt,
  className = 'h-20 w-20',
}: StudentPhotoPreviewProps) {
  const hasPhoto = Boolean(photoVersion);
  const { src, state: fetchState } = useProtectedImage({
    queryKey: ['student-photo-blob', studentId, photoVersion],
    enabled: hasPhoto,
    fetchBlob: (signal) => studentsApi.getStudentPhotoBlob(studentId, signal),
  });
  const state: 'loading' | 'ready' | 'missing' | 'error' = !hasPhoto
    ? 'missing'
    : fetchState === 'denied'
      ? 'error'
      : fetchState === 'idle'
        ? 'loading'
        : fetchState;

  if (state === 'ready' && src) {
    // Blob URLs are generated from an authenticated protected-file response.
    // next/image cannot optimise this private in-memory URL safely.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={`${className} rounded-2xl object-cover ring-4 ring-white`} />;
  }

  return <div className={`${className} flex shrink-0 items-center justify-center rounded-2xl bg-white text-slate-300 ring-4 ring-white`} aria-label={state === 'error' ? 'Student photo could not be displayed' : 'Student photo preview'}>
    {state === 'loading' ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImageOff className="h-7 w-7" />}
  </div>;
}
