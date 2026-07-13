"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { api } from "../../lib/api";

export function ActivityThumbnail({
  attachmentId,
  version,
  alt,
  className = "h-full w-full object-cover",
}: {
  attachmentId: string;
  version?: string | null;
  alt: string;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host || visible) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !version) return;
    let active = true;
    let objectUrl: string | null = null;
    setState("loading");

    void api
      .getActivityThumbnailBlob(attachmentId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setState("ready");
      })
      .catch(() => {
        if (active) setState("error");
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId, version, visible]);

  return (
    <div
      ref={hostRef}
      className="flex h-full w-full items-center justify-center bg-slate-100"
    >
      {state === "ready" && src ? (
        // Blob URL comes from an authenticated protected thumbnail response.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className={className} />
      ) : state === "loading" ? (
        <Loader2
          className="h-5 w-5 animate-spin text-slate-400"
          aria-label="Loading protected thumbnail"
        />
      ) : (
        <Camera
          className="h-6 w-6 text-slate-300"
          aria-label="Protected thumbnail unavailable"
        />
      )}
    </div>
  );
}
