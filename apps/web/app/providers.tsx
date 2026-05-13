'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren, useState } from 'react';
import { SessionProvider } from '../components/session-provider';
import { ApiRequestError } from '../lib/api';

export function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: (failureCount, error) => {
              if (
                error instanceof ApiRequestError &&
                [401, 403, 404].includes(error.statusCode)
              ) {
                return false;
              }

              return failureCount < 1;
            },
          },
        },
      }),
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
