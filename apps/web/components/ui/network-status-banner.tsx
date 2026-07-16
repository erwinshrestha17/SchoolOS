"use client";

import { WifiOff } from "lucide-react";
import { useNetworkStatus } from "@/lib/hooks/use-network-status";

export function NetworkStatusBanner() {
  const isOnline = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-amber-950"
      role="status"
      aria-live="polite"
      data-testid="offline-mode-banner"
    >
      <div className="mx-auto flex max-w-[1600px] items-start gap-2 text-sm font-semibold">
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          You are offline. Previously loaded safe information remains visible,
          and attendance drafts stay on this browser. Payments, publishing,
          settings, file downloads, and other protected actions need internet.
        </span>
      </div>
    </div>
  );
}
