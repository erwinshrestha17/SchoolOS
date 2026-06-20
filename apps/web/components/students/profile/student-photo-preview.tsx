'use client';

import { useEffect, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { studentsApi } from '@/lib/api/students';

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
  const [src, setSrc] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>(
    photoVersion ? 'loading' : 'missing',
  );

  useEffect(() => {
    if (!photoVersion) {
      setSrc(null);
      setState('missing');
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    setState('loading');
    setSrc(null);

    void studentsApi.getStudentPhotoBlob(studentId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setState('ready');
      })
      .catch(() => {
        if (!active) return;
        setState('error');
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoVersion, studentId]);

  if (state === 'ready' && src) {
    return <img src={src} alt={alt} className={`${className} rounded-2xl object-cover ring-4 ring-white`} />;
  }

  return <div className={`${className} flex shrink-0 items-center justify-center rounded-2xl bg-white text-slate-300 ring-4 ring-white`} aria-label={state === 'error' ? 'Student photo could not be displayed' : 'Student photo preview'}>
    {state === 'loading' ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImageOff className="h-7 w-7" />}
  </div>;
}
