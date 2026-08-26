const LEASE_STORAGE_KEY = "schoolos.offline-auth-lease.v1";
export const OFFLINE_AUTH_LEASE_MS = 8 * 60 * 60 * 1000;

export type OfflineAuthLease = {
  tenantId: string;
  userId: string;
  capturedAt: string;
  expiresAt: string;
  securityDomain: "SCHOOL" | "PLATFORM";
  authorizationFingerprint: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function buildAuthorizationFingerprint(input: {
  tenantId: string;
  userId: string;
  permissions: readonly string[];
  roles: readonly string[];
}) {
  return [
    input.tenantId,
    input.userId,
    [...input.roles].sort().join(","),
    [...input.permissions].sort().join(","),
  ].join("|");
}

export function createOfflineAuthLease(input: {
  tenantId: string;
  userId: string;
  securityDomain?: "SCHOOL" | "PLATFORM";
  permissions: readonly string[];
  roles: readonly string[];
  now?: Date;
  ttlMs?: number;
}): OfflineAuthLease {
  const now = input.now ?? new Date();
  const ttlMs = input.ttlMs ?? OFFLINE_AUTH_LEASE_MS;
  return {
    tenantId: input.tenantId,
    userId: input.userId,
    capturedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    securityDomain: input.securityDomain ?? "SCHOOL",
    authorizationFingerprint: buildAuthorizationFingerprint(input),
  };
}

export function storeOfflineAuthLease(lease: OfflineAuthLease | null) {
  if (!canUseStorage()) {
    return;
  }
  if (!lease) {
    window.localStorage.removeItem(LEASE_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(LEASE_STORAGE_KEY, JSON.stringify(lease));
}

export function readOfflineAuthLease(): OfflineAuthLease | null {
  if (!canUseStorage()) {
    return null;
  }
  const raw = window.localStorage.getItem(LEASE_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as OfflineAuthLease;
    if (
      typeof parsed.tenantId !== "string" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.capturedAt !== "string" ||
      typeof parsed.expiresAt !== "string" ||
      !["SCHOOL", "PLATFORM"].includes(parsed.securityDomain) ||
      typeof parsed.authorizationFingerprint !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearOfflineAuthLease() {
  storeOfflineAuthLease(null);
}

export function isOfflineAuthLeaseValid(
  lease: OfflineAuthLease | null,
  session: {
    tenantId?: string | null;
    userId?: string | null;
    securityDomain?: string | null;
    permissions: readonly string[];
    roles: readonly string[];
  },
  now = new Date(),
) {
  if (!lease) {
    return false;
  }
  if (lease.securityDomain === "PLATFORM") {
    return false;
  }
  if (session.securityDomain === "PLATFORM") {
    return false;
  }
  if (
    lease.tenantId !== session.tenantId ||
    lease.userId !== session.userId
  ) {
    return false;
  }
  const capturedAt = Date.parse(lease.capturedAt);
  const expiresAt = Date.parse(lease.expiresAt);
  if (
    !Number.isFinite(capturedAt) ||
    !Number.isFinite(expiresAt) ||
    capturedAt > now.getTime() ||
    expiresAt <= now.getTime() ||
    expiresAt - capturedAt <= 0 ||
    expiresAt - capturedAt > OFFLINE_AUTH_LEASE_MS
  ) {
    return false;
  }
  return (
    lease.authorizationFingerprint ===
    buildAuthorizationFingerprint({
      tenantId: lease.tenantId,
      userId: lease.userId,
      permissions: session.permissions,
      roles: session.roles,
    })
  );
}
