"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    let cancelled = false;

    const register = async () => {
      try {
        if (!cancelled) {
          await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
            updateViaCache: "none",
          });
        }
      } catch {
        // Installation is an enhancement. The authenticated app keeps using
        // its explicit network and offline-locked states when registration is
        // unavailable.
      }
    };

    if (document.readyState === "complete") {
      void register();
      return () => {
        cancelled = true;
      };
    }

    window.addEventListener("load", register, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
