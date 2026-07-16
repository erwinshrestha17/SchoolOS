import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("offline-safe web foundation", () => {
  it("uses a bounded stable secure replay id for attendance drafts", () => {
    const session = read("lib/session.ts");
    const attendance = read("components/forms/attendance-form.tsx");

    assert.match(session, /createAttendanceDraftSubmissionId/);
    assert.match(session, /crypto\.randomUUID|crypto\?\.randomUUID/);
    assert.doesNotMatch(attendance, /Math\.random/);
    assert.match(attendance, /clientSubmissionId: draftClientSubmissionId/);
  });

  it("clears browser-private attendance drafts with the session", () => {
    const session = read("lib/session.ts");
    const provider = read("components/session-provider.tsx");

    assert.match(session, /export async function clearAllAttendanceDrafts/);
    assert.match(session, /ATTENDANCE_DRAFT_KEY_PREFIX/);
    assert.match(session, /window\.localStorage\.removeItem\(key\)/);
    assert.match(
      session,
      /transaction\.oncomplete = \(\) => \{[\s\S]{0,160}resolve\(requestResult\)/,
    );
    assert.doesNotMatch(
      session,
      /async function withDraftStore[\s\S]{0,900}request\.onsuccess = \(\) => resolve\(request\.result\)/,
    );
    assert.match(provider, /clearAllAttendanceDrafts/);
    assert.match(provider, /await clearAllAttendanceDrafts\(\)/);
    assert.match(provider, /queryClient\.clear\(\)/);
    assert.match(provider, /clearSupportOverride\(\)/);
    assert.match(provider, /clearRecentlyViewed\(\)/);
  });

  it("cleans identity-scoped state before accepting a different session", () => {
    const provider = read("components/session-provider.tsx");
    const login = read("components/forms/login-form.tsx");
    const session = read("lib/session.ts");

    assert.match(provider, /acceptAuthenticatedBrowserSession/);
    assert.match(provider, /hasSameBrowserSessionIdentity/);
    assert.match(
      provider,
      /!hasSameBrowserSessionIdentity[\s\S]{0,500}clearPrivateBrowserState\(\)[\s\S]{0,500}storeSession\(nextSession\)/,
    );
    assert.match(provider, /setAuthenticatedSession:.*Promise<void>/);
    assert.match(login, /await setAuthenticatedSession\(result\)/);
    assert.match(session, /export const SESSION_STORAGE_KEY/);
  });

  it("locks on an unconfirmed session check without deleting drafts", () => {
    const provider = read("components/session-provider.tsx");
    const dashboardLayout = read("app/dashboard/layout.tsx");
    const platformLayout = read("app/platform/layout.tsx");
    const lockedState = read("components/ui/offline-locked-state.tsx");
    const supportOverrideBanner = read(
      "components/platform/SupportOverrideBanner.tsx",
    );

    assert.match(provider, /isConfirmedSessionFailure\(error\)/);
    assert.match(provider, /statusForUnconfirmedSessionError/);
    assert.match(provider, /"offline_locked"/);
    assert.match(provider, /"verification_failed"/);
    assert.match(provider, /window\.addEventListener\("online"/);
    assert.match(provider, /revalidateSession/);
    assert.match(provider, /sessionGenerationRef/);
    assert.match(provider, /revalidationPromiseRef/);
    assert.match(provider, /generation !== sessionGenerationRef\.current/);
    assert.match(provider, /window\.addEventListener\("storage"/);
    assert.match(provider, /isSessionStorageEvent\(event\)/);
    assert.match(provider, /getBrowserSessionIdentity\(externalSession\)/);
    assert.match(provider, /await revalidateSession\(\)/);
    assert.doesNotMatch(provider, /setCurrentSession\(externalSession\)/);
    assert.match(dashboardLayout, /status === "offline_locked"/);
    assert.match(platformLayout, /status === "offline_locked"/);
    assert.match(lockedState, /Private\s+school information stays hidden/);
    assert.match(lockedState, /drafts remain on this browser/);
    assert.match(
      supportOverrideBanner,
      /status !== 'authenticated' \|\| !session\?\.user\.isSupportOverride/,
    );
  });

  it("shows real browser drafts and server sync state separately", () => {
    const session = read("lib/session.ts");
    const workspace = read(
      "components/attendance/attendance-m2-workspaces.tsx",
    );

    assert.match(session, /authenticatedKeyPrefix/);
    assert.match(session, /scope\.tenantId/);
    assert.match(session, /scope\.userId/);
    assert.match(session, /draft\.key\.startsWith\(authenticatedKeyPrefix\)/);
    assert.match(session, /ATTENDANCE_DRAFT_TTL_MS/);
    assert.match(session, /ATTENDANCE_DRAFT_MAX_RECORDS/);
    assert.match(session, /ATTENDANCE_DRAFT_MAX_BYTES/);
    assert.match(session, /writeIndexedDbDraftWithinCapacity/);
    assert.match(session, /canStorePendingAttendanceDraft/);
    assert.match(session, /AttendanceDraftCapacityError/);
    assert.match(session, /isInvalidStoredAttendanceDraft/);
    assert.doesNotMatch(session, /trimIndexedDbDrafts/);
    assert.doesNotMatch(
      session,
      /slice\(0,\s*ATTENDANCE_DRAFT_MAX_RECORDS\)/,
    );
    assert.match(workspace, /listAttendanceDraftsForCurrentBrowser/);
    assert.match(workspace, /tenantId,/);
    assert.match(workspace, /userId,/);
    assert.match(workspace, /This Browser/);
    assert.match(workspace, /Server Drafts/);
    assert.match(workspace, /Sync Queue and Conflicts/);
  });

  it("mounts one shared offline banner and keeps unsafe actions online-only", () => {
    const shell = read("components/layout/dashboard-shell.tsx");
    const banner = read("components/ui/network-status-banner.tsx");
    const networkStore = read("lib/hooks/use-network-status.ts");

    assert.match(shell, /<NetworkStatusBanner \/>/);
    assert.match(networkStore, /useSyncExternalStore/);
    assert.match(banner, /Payments, publishing/);
    assert.match(banner, /file downloads/);
  });

  it("rejects generic mutations immediately instead of replaying them", () => {
    const client = read("lib/api/client.ts");
    const providers = read("app/providers.tsx");

    assert.match(client, /assertOnlineForMutation\(method\)/);
    assert.match(client, /assertOnlineForMutation\("POST"\)/);
    assert.match(providers, /mutations:\s*{/);
    assert.match(providers, /networkMode:\s*'always'/);
    assert.match(providers, /retry:\s*false/);
  });

  it("registers a public-only service worker and manifest", () => {
    const serviceWorker = read("public/sw.js");
    const registration = read("components/pwa/service-worker-registration.tsx");
    const providers = read("app/providers.tsx");
    const manifest = read("app/manifest.ts");
    const nextConfig = read("next.config.ts");

    assert.equal(existsSync(join(webRoot, "public/offline.html")), true);
    assert.equal(existsSync(join(webRoot, "public/icons/schoolos.svg")), true);
    for (const icon of [
      "schoolos-192.png",
      "schoolos-512.png",
      "schoolos-maskable-192.png",
      "schoolos-maskable-512.png",
    ]) {
      assert.equal(existsSync(join(webRoot, "public/icons", icon)), true);
    }
    assert.match(registration, /serviceWorker\.register\("\/sw\.js"/);
    assert.match(registration, /updateViaCache:\s*"none"/);
    assert.match(providers, /<ServiceWorkerRegistration \/>/);
    assert.match(manifest, /\/icons\/schoolos-192\.png/);
    assert.match(manifest, /\/icons\/schoolos-512\.png/);
    assert.match(manifest, /\/icons\/schoolos-maskable-192\.png/);
    assert.match(manifest, /\/icons\/schoolos-maskable-512\.png/);
    assert.match(manifest, /purpose: "maskable"/);
    assert.match(nextConfig, /Service-Worker-Allowed/);
    assert.match(nextConfig, /no-cache, no-store, must-revalidate/);

    assert.match(serviceWorker, /\/api\//);
    assert.match(serviceWorker, /\/auth\//);
    assert.match(serviceWorker, /\/dashboard/);
    assert.match(serviceWorker, /\/platform/);
    assert.match(serviceWorker, /\/files\//);
    assert.match(serviceWorker, /\/reports\//);
    assert.match(serviceWorker, /\/exports\//);
    assert.match(serviceWorker, /request\.headers\.has\("rsc"\)/);
    assert.match(serviceWorker, /hasSensitiveQuery/);
    assert.match(serviceWorker, /request\.destination === "image"/);
    assert.match(serviceWorker, /\/_next\/static\//);
    assert.match(serviceWorker, /CACHE_VERSION/);
    assert.match(serviceWorker, /MAX_RUNTIME_STATIC_ENTRIES/);
    assert.match(serviceWorker, /trimRuntimeStaticEntries/);
    assert.match(serviceWorker, /cache\.delete\(cachedRequest\)/);
    assert.match(serviceWorker, /request\.mode === "navigate"/);
    assert.match(serviceWorker, /fetch\(request\)\.catch/);
    assert.doesNotMatch(
      serviceWorker,
      /addEventListener\(["'](?:sync|periodicsync)["']/,
    );
  });

  it("clears tenant query data across support override transitions", () => {
    const supportBanner = read("components/platform/SupportOverrideBanner.tsx");
    const tenantPage = read("app/platform/schools/[tenantId]/page.tsx");

    assert.match(supportBanner, /useQueryClient/);
    assert.match(supportBanner, /exitPlatformSupportOverride\(\)/);
    assert.match(supportBanner, /queryClient\.clear\(\)/);
    assert.match(tenantPage, /useQueryClient/);
    assert.match(tenantPage, /enterPlatformSupportOverride/);
    assert.match(tenantPage, /queryClient\.clear\(\)/);
  });

  it("enables attendance sync only for a pending scoped local draft", () => {
    const attendance = read("components/forms/attendance-form.tsx");

    assert.match(attendance, /const hasPendingLocalDraft = Boolean/);
    assert.match(
      attendance,
      /draftKey && draftClientSubmissionId && draftSavedAt/,
    );
    assert.match(attendance, /!hasPendingLocalDraft/);
    assert.match(attendance, /setDraftClientSubmissionId\(null\)/);
    assert.match(attendance, /setDraftSavedAt\(null\)/);
  });

  it("retains uncertain or rejected attendance receipts for safe review", () => {
    const attendance = read("components/forms/attendance-form.tsx");
    const policy = read("lib/offline-policy.ts");

    assert.match(policy, /CLEARABLE_ATTENDANCE_SYNC_STATUSES/);
    assert.match(policy, /"ACCEPTED"/);
    assert.match(policy, /"SYNCED"/);
    assert.match(policy, /"CONFLICTED"/);
    assert.doesNotMatch(
      policy,
      /CLEARABLE_ATTENDANCE_SYNC_STATUSES[\s\S]{0,120}"REJECTED"/,
    );
    assert.match(attendance, /shouldClearLocalAttendanceDraft\(syncStatus\)/);
    assert.match(attendance, /syncStatus === "REJECTED"/);
    assert.match(attendance, /setDraftSyncState\("server_check"\)/);
    assert.match(attendance, /lastSyncStatus: lastServerSyncStatus/);
    assert.match(attendance, /createAttendanceDraftSubmissionId\(\)/);
  });
});
