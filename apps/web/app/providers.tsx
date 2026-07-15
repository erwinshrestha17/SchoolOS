'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren, useState } from 'react';
import { SessionProvider } from '../components/session-provider';
import { EntitlementsProvider } from '../components/entitlements-provider';
import { SupportOverrideBanner } from '../components/platform/SupportOverrideBanner';
import { ApiRequestError } from '../lib/api';
import { TooltipProvider } from '../components/ui/primitives/tooltip';
import { Toaster } from '../components/ui/primitives/sonner';
import { BreadcrumbLabelProvider } from '../components/schoolos/navigation/breadcrumb-label-context';
import { SchoolOSMotionProvider } from '../components/schoolos/motion/schoolos-motion-provider';

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
      <EntitlementsProvider>
        <SupportOverrideBanner />
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <SchoolOSMotionProvider>
              <BreadcrumbLabelProvider>
                {children}
                {/* SchoolOS is light-only today; pin Sonner to light so it never
                    follows an unconfigured OS dark-mode preference. */}
                <Toaster theme="light" position="top-right" />
              </BreadcrumbLabelProvider>
            </SchoolOSMotionProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </EntitlementsProvider>
    </SessionProvider>
  );
}
