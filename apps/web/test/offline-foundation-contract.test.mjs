import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);

  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
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
    const markPage = read("app/dashboard/attendance/mark/page.tsx");

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
    assert.doesNotMatch(session, /slice\(0,\s*ATTENDANCE_DRAFT_MAX_RECORDS\)/);
    assert.match(workspace, /listAttendanceDraftsForCurrentBrowser/);
    assert.match(workspace, /tenantId,/);
    assert.match(workspace, /userId,/);
    assert.match(workspace, /This Browser/);
    assert.match(workspace, /Server Drafts/);
    assert.match(workspace, /Sync Queue and Conflicts/);
    assert.match(workspace, /attendanceDraftRecoveryHref/);
    assert.match(workspace, /academicYearId: draft\.academicYearId/);
    assert.match(workspace, /classId: draft\.classId/);
    assert.match(workspace, /attendanceDate: draft\.attendanceDate/);
    assert.match(workspace, /search\.set\("sectionId", draft\.sectionId\)/);
    assert.match(workspace, /Open saved scope/);
    assert.match(workspace, /draft\.academicYearLabel/);
    assert.match(workspace, /Final submission queued/);
    assert.match(workspace, /Pending confirmation/);
    assert.match(workspace, /Access denied/);
    assert.match(workspace, /Saved locally/);
    assert.match(markPage, /initialDraftScope/);
    assert.match(markPage, /<AttendanceMarkWorkspace initialDraftScope=/);
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
    const tenantAccess = read(
      "components/platform/tenant-detail/tenant-access.tsx",
    );
    const sessionProvider = read("components/session-provider.tsx");

    assert.match(supportBanner, /useQueryClient/);
    assert.match(supportBanner, /exitPlatformSupportOverride\(\)/);
    assert.match(supportBanner, /queryClient\.clear\(\)/);
    assert.match(tenantAccess, /useQueryClient/);
    assert.match(tenantAccess, /enterPlatformSupportOverride/);
    assert.match(tenantAccess, /queryClient\.clear\(\)/);
    assert.match(sessionProvider, /clearPrivateBrowserState/);
    assert.match(sessionProvider, /queryClient\.clear\(\)/);
    assert.match(sessionProvider, /clearSupportOverride\(\)/);
  });

  it("enables attendance sync only for a pending scoped local draft", () => {
    const attendance = read("components/forms/attendance-form.tsx");

    assert.match(attendance, /const hasPendingLocalDraft = Boolean/);
    assert.match(
      attendance,
      /draftScopeHydrated[\s\S]{0,120}draftKey[\s\S]{0,120}draftClientSubmissionId[\s\S]{0,120}draftSavedAt/,
    );
    assert.match(attendance, /!hasPendingLocalDraft/);
    assert.match(attendance, /setDraftClientSubmissionId\(null\)/);
    assert.match(attendance, /setDraftSavedAt\(null\)/);
  });

  it("waits for the selected draft scope to hydrate before saving or submitting", () => {
    const attendance = read("components/forms/attendance-form.tsx");
    const autosaveFlow = sourceBetween(
      attendance,
      "useEffect(() => {\n    if (\n      !draftKey ||\n      !draftScopeHydrated",
      "const overrideMutation = useMutation",
    );
    const submissionFlow = sourceBetween(
      attendance,
      "const syncDraftSubmission = async () =>",
      "const keepServerVersion = () =>",
    );

    assert.match(attendance, /const draftScopeHydrated = Boolean/);
    assert.match(autosaveFlow, /!draftScopeHydrated/);
    assert.match(submissionFlow, /!draftScopeHydrated/);
    assert.match(
      attendance,
      /const visibleDraftSyncState:[\s\S]{0,120}draftScopeHydrated/,
    );
    assert.match(
      attendance,
      /roster\.length > 0 &&[\s\S]{0,80}draftScopeHydrated/,
    );
  });

  it("serializes server draft saves against final receipt submission", () => {
    const attendance = read("components/forms/attendance-form.tsx");
    const saveFlow = sourceBetween(
      attendance,
      "const saveDraftToServer = async () =>",
      "const syncDraftSubmission = async () =>",
    );
    const submissionFlow = sourceBetween(
      attendance,
      "const syncDraftSubmission = async () =>",
      "const keepServerVersion = () =>",
    );

    assert.match(saveFlow, /serverDraftSaveInFlightRef\.current/);
    assert.match(saveFlow, /receiptSyncInFlightRef\.current/);
    assert.match(saveFlow, /serverDraftSaveInFlightRef\.current = true/);
    assert.match(saveFlow, /!receiptSyncInFlightRef\.current/);
    assert.match(saveFlow, /activeDraftKeyRef\.current === serverDraftKey/);
    assert.match(saveFlow, /isAttendanceDraftStorageTicketCurrent/);
    assert.match(submissionFlow, /serverDraftSaveInFlightRef\.current/);
    assert.match(
      attendance,
      /scopeSelectionDisabled =[\s\S]{0,180}saveDraftMutation\.isPending/,
    );
    assert.match(
      attendance,
      /requestFinalSubmission = \(\) => \{[\s\S]{0,120}serverDraftSaveInFlightRef\.current/,
    );
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

  it("routes the primary attendance confirmation through receipt-safe sync with one stable id", () => {
    const attendance = read("components/forms/attendance-form.tsx");
    const submissionFlow = sourceBetween(
      attendance,
      "const syncDraftSubmission = async () =>",
      "const keepServerVersion = () =>",
    );
    const primaryConfirmation = sourceBetween(
      attendance,
      "<ConfirmDialog\n        isOpen={isConfirmOpen}",
      "<ConfirmDialog\n        isOpen={isOverrideConfirmOpen}",
    );

    assert.doesNotMatch(attendance, /api\.submitAttendance/);
    assert.match(attendance, /mutationFn: api\.syncAttendance/);
    assert.match(primaryConfirmation, /void syncDraftSubmission\(\)/);
    assert.doesNotMatch(primaryConfirmation, /\.mutate\(/);
    const receiptDraft = sourceBetween(
      submissionFlow,
      "const receiptProtectedDraft: AttendanceDraftStorageValue =",
      "const persistQueuedFinalSubmission = async () =>",
    );
    const syncRequest = sourceBetween(
      submissionFlow,
      "const result = await syncMutation.mutateAsync({",
      "const syncStatus =",
    );
    assert.match(receiptDraft, /clientSubmissionId: draftClientSubmissionId/);
    assert.match(syncRequest, /clientSubmissionId: draftClientSubmissionId/);
    const receiptPersistIndex = submissionFlow.search(
      /await storeAttendanceDraft\(submissionDraftKey, receiptProtectedDraft, \{[\s\S]{0,100}ticket: submissionStorageTicket/,
    );
    const requestIndex = submissionFlow.indexOf(
      "const result = await syncMutation.mutateAsync({",
    );
    assert.ok(
      receiptPersistIndex >= 0,
      "the durable receipt write is required",
    );
    assert.ok(requestIndex >= 0, "the final sync request is required");
    assert.ok(
      receiptPersistIndex < requestIndex,
      "the durable receipt must be stored before the final sync request",
    );
    assert.match(
      submissionFlow,
      /await storeAttendanceDraft\(submissionDraftKey, receiptProtectedDraft, \{[\s\S]{0,120}ticket: submissionStorageTicket[\s\S]{0,120}} catch \{[\s\S]{0,320}so nothing was sent[\s\S]{0,180}return;/,
    );
    assert.match(
      submissionFlow,
      /const ambiguousDraft = \{[\s\S]{0,120}\.\.\.receiptProtectedDraft,[\s\S]{0,120}lastSyncStatus: "TRANSPORT_AMBIGUOUS"/,
    );
    assert.match(
      submissionFlow,
      /!isReceiptReplay &&[\s\S]{0,120}hasReconnectConflict/,
    );
    assert.doesNotMatch(submissionFlow, /createAttendanceDraftSubmissionId/);
  });

  it("queues confirmed offline attendance and replays only receipt-protected final intent", () => {
    const attendance = read("components/forms/attendance-form.tsx");
    const submissionFlow = sourceBetween(
      attendance,
      "const syncDraftSubmission = async () =>",
      "const keepServerVersion = () =>",
    );
    const reconnectFlow = sourceBetween(
      attendance,
      "reconnectActionRef.current = () =>",
      "useEffect(() => {\n    const handleOnline",
    );

    assert.match(
      attendance,
      /const receiptProtectedFinalSubmissionStatuses = \[[\s\S]{0,100}"QUEUED",[\s\S]{0,100}"PROCESSING",[\s\S]{0,100}"TRANSPORT_AMBIGUOUS"/,
    );
    assert.match(
      submissionFlow,
      /navigator\.onLine === false[\s\S]{0,400}await persistQueuedFinalSubmission\(\)/,
    );
    assert.match(
      submissionFlow,
      /\.\.\.receiptProtectedDraft,[\s\S]{0,80}lastSyncStatus: "QUEUED"/,
    );
    assert.match(
      reconnectFlow,
      /isReceiptProtectedFinalSubmissionStatus\(lastServerSyncStatus\)\s*&&\s*hasPendingLocalDraft[\s\S]{0,160}void syncDraftSubmission\(\)[\s\S]{0,160}return;[\s\S]{0,160}void saveDraftToServer\(\)/,
    );
    assert.match(
      attendance,
      /isReceiptProtectedFinalSubmissionStatus\(storedSyncStatus\)\s*&&\s*navigator\.onLine !== false/,
    );
  });

  it("fences receipt results to the captured attendance scope", () => {
    const attendance = read("components/forms/attendance-form.tsx");
    const submissionFlow = sourceBetween(
      attendance,
      "const syncDraftSubmission = async () =>",
      "const keepServerVersion = () =>",
    );
    const scopeControls = sourceBetween(
      attendance,
      '<FilterBar\n          label="Attendance Filters"',
      '<SectionCard\n        title="Attendance Roster"',
    );

    assert.match(submissionFlow, /const submissionDraftKey = draftKey/);
    assert.match(
      submissionFlow,
      /activeDraftKeyRef\.current === submissionDraftKey/,
    );
    assert.match(
      submissionFlow,
      /clearAttendanceDraft\(submissionDraftKey, \{[\s\S]{0,80}ticket: submissionStorageTicket/,
    );
    assert.ok(
      (submissionFlow.match(/isSubmissionScopeCurrent\(\)/g) ?? []).length >= 6,
      "all awaited receipt outcomes must be fenced to the captured draft key",
    );
    assert.ok(
      (scopeControls.match(/disabled=\{scopeSelectionDisabled\}/g) ?? [])
        .length >= 4,
      "year, class, section, and date must be frozen during receipt sync",
    );
  });

  it("invalidates and serializes browser draft writes across session teardown", () => {
    const session = read("lib/session.ts");
    const fence = read("lib/attendance-draft-storage-fence.ts");
    const attendance = read("components/forms/attendance-form.tsx");
    const clearAll = sourceBetween(
      session,
      "export async function clearAllAttendanceDrafts()",
      "export async function listAttendanceDraftsForCurrentBrowser",
    );

    assert.match(clearAll, /attendanceDraftStorageFence\.invalidate\(\)/);
    assert.ok(
      clearAll.indexOf("attendanceDraftStorageFence.invalidate()") <
        clearAll.indexOf('typeof window === "undefined"'),
      "identity invalidation must happen synchronously before cleanup awaits",
    );
    assert.match(session, /attendanceDraftStorageFence\.run\(ticket/);
    assert.match(fence, /private operationQueue: Promise<void>/);
    assert.match(fence, /this\.assertCurrent\(ticket\)/);
    assert.match(attendance, /captureAttendanceDraftStorageTicket\(\)/);
    assert.match(attendance, /componentMountedRef\.current/);
    assert.match(
      attendance,
      /draftStorageAuthorityRef\.current\?\.ticket === submissionStorageTicket/,
    );
  });

  it("requires review for new final intent and directly retries only confirmed intent", () => {
    const attendance = read("components/forms/attendance-form.tsx");
    const requestFlow = sourceBetween(
      attendance,
      "const requestFinalSubmission = () =>",
      "reconnectActionRef.current = () =>",
    );

    assert.match(
      requestFlow,
      /\["queued", "server_check", "authorization_denied"\]\.includes/,
    );
    assert.match(requestFlow, /void syncDraftSubmission\(\)/);
    assert.match(requestFlow, /setIsConfirmOpen\(true\)/);
    assert.ok(
      (attendance.match(/onClick=\{requestFinalSubmission\}/g) ?? []).length >=
        2,
      "banner and saved-draft final actions must share the confirmation gate",
    );
  });

  it("locks authorization denials and labels unconfirmed receipts truthfully", () => {
    const attendance = read("components/forms/attendance-form.tsx");
    const submissionFlow = sourceBetween(
      attendance,
      "const syncDraftSubmission = async () =>",
      "const keepServerVersion = () =>",
    );
    const denialIndex = submissionFlow.indexOf(
      "error instanceof ApiRequestError && error.statusCode === 403",
    );
    const editableIndex = submissionFlow.indexOf(
      "canRestoreEditableAttendanceDraftAfterSyncError(error)",
    );

    assert.ok(denialIndex >= 0 && denialIndex < editableIndex);
    assert.match(
      submissionFlow,
      /createAccessRevocationReceipt\([\s\S]{0,120}"AUTHORIZATION_DENIED"/,
    );
    assert.match(submissionFlow, /setDraftSyncState\("authorization_denied"\)/);
    assert.match(attendance, /\? "PENDING_CONFIRMATION"/);
    assert.doesNotMatch(
      attendance,
      /draftSyncState === "queued" \|\| draftSyncState === "server_check"[\s\S]{0,80}\? "QUEUED"/,
    );
    assert.match(attendance, /return to this saved draft later/);
    assert.match(
      attendance,
      /scopeSelectionDisabled =[\s\S]{0,160}unresolvedFinalizationReadOnly/,
    );
  });

  it("hydrates a cold local receipt before server roster data is available", () => {
    const attendance = read("components/forms/attendance-form.tsx");
    const hydrationStart = attendance.indexOf(
      "const draftRead = await readAttendanceDraft",
    );
    const rosterFallback = attendance.indexOf(
      "if (!rosterQuery.data) return;",
      hydrationStart,
    );

    assert.ok(hydrationStart >= 0);
    assert.ok(
      rosterFallback > hydrationStart,
      "browser receipt hydration must run before the server-roster fallback",
    );
    assert.match(
      attendance.slice(hydrationStart, rosterFallback),
      /setHydratedDraftKey\(draftKey\)/,
    );
  });

  it("keeps recovered scope in the route and hides revoked scope state", () => {
    const attendance = read("components/forms/attendance-form.tsx");
    const workspace = read(
      "components/attendance/attendance-m2-workspaces.tsx",
    );

    assert.match(attendance, /new URLSearchParams\(\{/);
    assert.match(attendance, /academicYearId,/);
    assert.match(attendance, /classId,/);
    assert.match(attendance, /attendanceDate,/);
    assert.match(attendance, /search\.set\("sectionId", sectionId\)/);
    assert.match(attendance, /router\.replace\(nextHref/);
    assert.match(attendance, /router\.replace\(pathname/);
    assert.match(attendance, /const rosterDisclosureBlocked/);
    assert.match(attendance, /Student details were cleared from this browser/);
    assert.match(workspace, /isAccessRestrictedBrowserDraft/);
    assert.match(workspace, /Recovery unavailable/);
    assert.match(workspace, /Student details cleared from this browser/);
    assert.match(workspace, /Access revalidation required/);
  });

  it("announces authoritative attendance outcomes and focuses actionable failures", () => {
    const attendance = read("components/forms/attendance-form.tsx");

    assert.match(
      attendance,
      /role=\{submissionFeedbackIsAlert \? "alert" : "status"\}/,
    );
    assert.match(
      attendance,
      /aria-live=\{submissionFeedbackIsAlert \? "assertive" : "polite"\}/,
    );
    assert.match(attendance, /aria-atomic="true"/);
    assert.match(
      attendance,
      /tabIndex=\{submissionFeedbackIsAlert \? -1 : undefined\}/,
    );
    assert.match(attendance, /submissionFeedbackRef\.current\?\.focus\(\)/);
    assert.match(attendance, /Attendance accepted by SchoolOS at/);
    assert.match(attendance, /recorded a conflict for office review/);
    assert.match(attendance, /No authoritative attendance was accepted/);
  });
});
