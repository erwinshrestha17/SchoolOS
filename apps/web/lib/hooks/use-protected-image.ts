'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiRequestError } from '../api/client';

export type ProtectedImageFetchState = 'idle' | 'loading' | 'ready' | 'denied' | 'error';

type UseProtectedImageOptions = {
  queryKey: unknown[];
  enabled: boolean;
  fetchBlob: (signal?: AbortSignal) => Promise<Blob>;
};

// Shared fetch/cache/cleanup for any protected (authenticated) image: react-query
// owns caching, request dedup, cancellation-on-unmount, and safe retry (the global
// query client already skips retrying 401/403/404 - see app/providers.tsx); this
// hook only adds the blob -> object URL lifecycle on top.
export function useProtectedImage({ queryKey, enabled, fetchBlob }: UseProtectedImageOptions): {
  src: string | null;
  state: ProtectedImageFetchState;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchBlob(signal),
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!query.data) {
      setSrc(null);
      return undefined;
    }
    const objectUrl = URL.createObjectURL(query.data);
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [query.data]);

  let state: ProtectedImageFetchState;
  if (query.status === 'error') {
    const statusCode = query.error instanceof ApiRequestError ? query.error.statusCode : null;
    state = statusCode === 403 ? 'denied' : 'error';
  } else if (query.status === 'success' && src) {
    state = 'ready';
  } else if (query.fetchStatus === 'fetching') {
    state = 'loading';
  } else {
    state = 'idle';
  }

  return { src, state, refetch: () => void query.refetch() };
}
