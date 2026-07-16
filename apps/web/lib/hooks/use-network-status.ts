"use client";

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let listening = false;

function emitNetworkChange() {
  listeners.forEach((listener) => listener());
}

function startListening() {
  if (listening || typeof window === "undefined") return;
  window.addEventListener("online", emitNetworkChange);
  window.addEventListener("offline", emitNetworkChange);
  listening = true;
}

function stopListening() {
  if (!listening || listeners.size > 0 || typeof window === "undefined") return;
  window.removeEventListener("online", emitNetworkChange);
  window.removeEventListener("offline", emitNetworkChange);
  listening = false;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  startListening();

  return () => {
    listeners.delete(listener);
    stopListening();
  };
}

function getSnapshot() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function useNetworkStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
