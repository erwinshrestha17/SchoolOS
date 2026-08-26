import type { SchoolAuthorityFence } from "@schoolos/core";

const STORAGE_KEY = "schoolos.school-authority-fence.v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function storeSchoolAuthorityFence(fence: SchoolAuthorityFence) {
  if (!canUseStorage()) {
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fence));
}

export function readSchoolAuthorityFence(): SchoolAuthorityFence | null {
  if (!canUseStorage()) {
    return null;
  }
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as SchoolAuthorityFence;
    if (
      typeof parsed.authorityNodeId !== "string" ||
      typeof parsed.authorityEpoch !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSchoolAuthorityFence() {
  if (!canUseStorage()) {
    return;
  }
  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function authorityFenceFields(
  fence: SchoolAuthorityFence | null | undefined,
) {
  if (!fence) {
    return {};
  }
  return {
    authorityNodeId: fence.authorityNodeId,
    authorityEpoch: fence.authorityEpoch,
  };
}
