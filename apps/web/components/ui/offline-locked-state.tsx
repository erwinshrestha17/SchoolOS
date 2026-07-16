"use client";

import { AlertTriangle, RefreshCw, ShieldCheck, WifiOff } from "lucide-react";
import { useState } from "react";
import { useNetworkStatus } from "@/lib/hooks/use-network-status";
import { useSession } from "../session-provider";

export function OfflineLockedState({
  reason = "network",
}: {
  reason?: "network" | "server";
}) {
  const isOnline = useNetworkStatus();
  const { revalidateSession } = useSession();
  const [isRevalidating, setIsRevalidating] = useState(false);

  async function handleRevalidate() {
    setIsRevalidating(true);

    try {
      await revalidateSession();
    } finally {
      setIsRevalidating(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section
        className="w-full max-w-lg rounded-3xl border border-amber-200 bg-white p-7 shadow-sm"
        aria-labelledby="offline-locked-title"
      >
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-amber-100 p-3 text-amber-900">
            {reason === "server" ? (
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            ) : isOnline ? (
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            ) : (
              <WifiOff className="h-6 w-6" aria-hidden="true" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">
              {reason === "server"
                ? "Secure session check unavailable"
                : "Protected workspace locked"}
            </p>
            <h1
              id="offline-locked-title"
              className="mt-1 text-2xl font-semibold text-slate-950"
            >
              {reason === "server"
                ? "SchoolOS could not verify access"
                : "Reconnect to unlock SchoolOS"}
            </h1>
          </div>
        </div>

        <p className="mt-5 text-sm leading-6 text-slate-600">
          {reason === "server"
            ? "SchoolOS reached the service, but the session check returned an unexpected response. Private school information stays hidden until a fresh check succeeds."
            : "SchoolOS could not securely verify this browser session. Private school information stays hidden until the server confirms your access again."}
        </p>
        <div
          className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700"
          role="status"
          aria-live="polite"
        >
          {reason === "server"
            ? "Retry the secure session check. If it keeps failing, contact the SchoolOS administrator with the time of the attempt."
            : isOnline
              ? "A connection is available. Run the secure session check to continue."
              : "This device is offline. SchoolOS will recheck automatically when the connection returns."}
          <p className="mt-2 font-medium text-slate-900">
            Unsynced attendance drafts remain on this browser and have not
            been sent or deleted.
          </p>
        </div>

        <button
          type="button"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={!isOnline || isRevalidating}
          onClick={() => void handleRevalidate()}
        >
          <RefreshCw
            className={`h-4 w-4 ${isRevalidating ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          {isRevalidating ? "Checking session..." : "Check session securely"}
        </button>
      </section>
    </main>
  );
}
