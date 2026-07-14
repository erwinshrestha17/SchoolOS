'use client';

import { useRef } from 'react';
import { studentsApi } from '../../lib/api/students';
import { useInViewport } from '../../lib/hooks/use-in-viewport';
import { useProtectedImage } from '../../lib/hooks/use-protected-image';
import { ProtectedAvatar, type ProtectedAvatarSize } from '../ui/protected-avatar';

// Renders a student's photo through the authenticated /students/:id/photo/content
// endpoint, lazily (only once scrolled near-visible) and cached/deduped by
// react-query. photoVersion should be the student's current photoFileId (or null) -
// its presence gates the fetch and a changed value busts the cache after replace.
export function StudentAvatar({
  studentId,
  photoVersion,
  initials,
  alt,
  size = 'md',
  className,
}: {
  studentId: string;
  photoVersion?: string | null;
  initials?: string;
  alt?: string;
  size?: ProtectedAvatarSize;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const inViewport = useInViewport(hostRef);
  const hasPhoto = Boolean(photoVersion);

  const { src, state } = useProtectedImage({
    queryKey: ['student-photo-blob', studentId, photoVersion],
    enabled: hasPhoto && inViewport,
    fetchBlob: (signal) => studentsApi.getStudentPhotoBlob(studentId, signal),
  });

  return (
    <div ref={hostRef} className="inline-flex">
      <ProtectedAvatar
        state={hasPhoto ? state : 'missing'}
        src={src}
        initials={initials}
        alt={alt}
        size={size}
        className={className}
      />
    </div>
  );
}
