# SchoolOS Agent Instructions

Repository-wide rules for human and AI contributors. Keep work production-oriented, scoped, evidence-based, and Nepal-only.

**Current posture:** P0 production-safety execution for a controlled real-school pilot, with offline-first operation as a repository-wide product invariant. School web and mobile must remain usable through poor connectivity and internet outages without weakening authorization, financial integrity, or academic integrity.

**Active P0 modules:** M0–M7, M11, M12, M15 as required by current P0 workflows.

**Deferred/frozen:** M8 Library, M9 Transport, M10 Canteen, M13 Learning, M14 Intelligence/AI. Preserve existing data, migrations, contracts, permissions, tests, and compatibility code; add no new feature work unless the project owner explicitly reactivates a module.

## 1. Instruction precedence

1. Explicit project-owner instruction for the current task.
2. This root `AGENTS.md`.
3. Scoped `AGENTS.md` in the touched app/package.
4. Canonical product, requirements, architecture, security, and release documents.
5. Existing contracts, migrations, tests, and code conventions.

Latest explicit owner decisions override stale roadmap assumptions. Update canonical docs when a conflict is confirmed; do not silently preserve contradictions.

## 2. Canonical sources

Start with `README.md`, `docs/README.md`, and `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`. Then read only the focused source required for the task.

| Area | Canonical source |
|---|---|
| Product/function | `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md` |
| API/database/web/mobile requirements | `docs/requirements/SCHOOLOS_SRS.md` |
| Architecture/security/platform | `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` |
| Module ownership/gaps | `docs/architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md` |
| Web | `apps/web/AGENTS.md`, `apps/web/e2e/README.md` |
| Mobile | `apps/schoolos_mobile/AGENTS.md`, `apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md` |
| Production/operations | `docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md` |

Do not create duplicate PRDs/SRSs/SDDs/runbooks or ad hoc roadmap Markdown when content belongs in a canonical document. Track work/blockers in GitHub Issues, Milestones, or Projects where available.

## 3. Module taxonomy and current execution status

| Module | Name | Status |
|---|---|---|
| M0 | Platform Core | Active P0 |
| M1 | Admissions and Student Profiles | Active P0 |
| M2 | Smart Attendance | Active P0 |
| M3 | Fees and Receipts | Active P0 |
| M4 | Academics, Exams, CAS, Report Cards | Active P0 |
| M5 | Activity Feed and Milestones | P0-dependent only |
| M6 | Homework and Timetable | P0-dependent only |
| M7 | HR and Payroll | P0-dependent only |
| M8 | Library | Deferred |
| M9 | Transport | Deferred |
| M10 | Canteen | Deferred |
| M11 | Accounting and Finance | Active P0 |
| M12 | Notifications and Delivery | Active P0 |
| M13 | Learning Layer | Frozen / disabled by default |
| M14 | Intelligence / AI | Roadmap-only |
| M15 | Notices and Announcements | Active P0 |

- `M8A`, `M8B`, `M8C` are obsolete.
- Inventory/Asset Management is not active scope.
- Chat/conversations are removed from active product scope. Preserve legacy data only where required for compatibility/retention; add no navigation or new writes.
- A broad standalone Student App is not active scope.

## 4. Nepal-only product boundary

SchoolOS is a Nepal-first multi-tenant school operating SaaS for:

- `SCHOOL`: Grades 1–10.
- `HIGHER_SECONDARY`: Grades 11–12 / +2.

Do not introduce international expansion, Cambridge/IB/British/American curriculum execution, OneRoster/LTI, foreign accreditation/compliance, cross-country localization, preschool, Bachelor’s/Master’s management, public rankings, or social/open-chat features without a new explicit owner decision.

Release claims must follow evidence:

```text
Development complete
→ Internal QA ready
→ Staging validated
→ Controlled pilot validated
→ Release candidate
→ GA / Production release
```

Local tests/builds/demos are not staging, pilot, RC, or GA evidence.

### P0 is the default implementation scope

Do not start P1/P2 feature expansion while unresolved P0 blockers remain unless explicitly instructed.

P0 execution order:

1. P0-01 — fail-closed entitlements, tenant isolation, teacher assignment authorization, guardian scoping, mobile cache invalidation, authorization matrix.
2. P0-02 — attendance correctness, locking, idempotency, correction history.
3. P0-03 — marks authorization, review/lock/publish/unlock/correction/versioning.
4. P0-04 — versioned Nepal School Education Compliance Profile.
5. P0-05 — reproducible IEMIS validation/export; no direct-sync claim without an authorized interface.
6. P0-06 — fee/receipt/reconciliation integrity and idempotent M3→M11 posting.
7. P0-07 — privacy, safeguarding, consent, protected files, sensitive-access audit.
8. P0-08 — offline-first web/mobile operation, School Edge continuity, synchronization, conflict recovery, and no-internet resilience.
9. Nepal localization correctness: Nepali Unicode, NPR, Nepal timezone, Nepal address hierarchy, BS/AD presentation with canonical date storage.
10. Backup/restore, clean migrations, observability, provider/storage readiness, and controlled-pilot evidence.

## 5. Platform control plane and school application are separate security domains

The **SchoolOS Platform** and the **School Management System** must not be one application where a hidden `DEVELOPER` role simply sees more school menus.

They may share the monorepo, backend infrastructure, PostgreSQL, Redis, storage abstractions, common packages, and deployment pipeline, but must remain separate in identity, authorization, routing, UI surface, audit semantics, and support access.

### School tenant plane

School personas operate only inside trusted tenant scope: Principal, Admin, Teacher, HR, Accountant, Parent/Guardian.

- `/dashboard/*` = school operations.
- `/dashboard/settings/*` = school configuration.

A Principal/Admin may be highly privileged inside one school but must never receive platform capabilities, provider secrets, global flags, SaaS plan controls, infrastructure controls, or other tenants’ data.

### Platform control plane

`/platform/*` is SchoolOS-internal SaaS control plane for tenant lifecycle, entitlements, SaaS subscriptions, platform operators, provider configuration, release/feature controls, system health, support tooling, cross-tenant audit, and centrally managed compliance-profile publishing.

Use distinct trusted contexts conceptually:

```text
SchoolAuthorizationContext: tenantId + schoolUserId + roles + permissions
PlatformAuthorizationContext: platformOperatorId + platformRoles + platformCapabilities
```

Rules:

- Never implement `role === 'DEVELOPER' → showEverything()`.
- School sessions/JWTs cannot become platform sessions by adding a role.
- Platform capabilities cannot be assigned by a school Admin/Principal.
- Platform sessions do not carry a tenant as permanent authority scope.
- Prefer a distinct internal platform frontend (for example `apps/platform-web`) rather than platform menus embedded in the school web app. If migration is incomplete, move incrementally and do not duplicate functionality.
- Separate frontend/security domains do **not** require microservices or a second database. Do not add new infrastructure units without approval.

### Controlled support access

Platform operators do not get ambient unrestricted tenant-record browsing. Tenant support access should be purpose-limited and, where supported, require tenant selection, reason/ticket, scoped module/capability, read-only default, expiry, step-up/approval for sensitive operations, and full audit. Emergency access must never become an untracked permanent bypass.

## 6. Architecture invariants

Keep:

- NestJS modular monolith.
- PostgreSQL/Prisma.
- Redis/BullMQ.
- Next.js App Router.
- Flutter companion app.
- `packages/core` where appropriate.

Do not introduce microservices, a different primary database technology/search cluster, GPU infrastructure, Kubernetes, or unrelated frameworks without explicit approval. **Owner-approved offline exception:** an Edge-enabled school may run a tenant-bound local deployment of the same SchoolOS modular monolith with local PostgreSQL, Redis/BullMQ where required, and a local StorageAdapter so the school can continue operating without internet. This is an offline deployment mode of existing architecture, not a forked product or new microservice architecture.

Mandatory boundaries:

- `tenantId` is the canonical tenancy boundary name.
- Backend authorization is truth; frontend hiding is UX only.
- SaaS billing/subscriptions remain separate from school fees/accounting.
- M11 is authoritative for accounting; M3/M7 hand off controlled idempotent entries.
- Source modules emit normalized events; M12 owns notification delivery.
- M15 owns notice authoring/publishing and hands normalized events to M12.
- M13 remains frozen and logically separate; preserve existing data/contracts.
- Offline-first is cross-cutting: cloud, School Edge, web PWA/cache, and Flutter local stores must use the same domain contracts, authorization rules, lifecycle semantics, idempotency rules, and audit model.
- For Edge-enabled tenants, prevent split-brain with an explicit tenant/site write-authority model and authority epoch/lease/failover semantics; never allow cloud and Edge to silently finalize conflicting authoritative writes.

## 7. Security, authorization, and isolation

Never trust client-supplied `tenantId`, roles, permissions, guardian relations, teacher assignments, totals, approval states, or lifecycle states.

Fail closed when a tenant is suspended, entitlement is disabled/missing/invalid/unavailable, required capability/assignment cannot be verified, guardian relationship is not active/verified/authorized, or protected-file authorization fails.

Persona scope:

- Parent: active linked children only, with per-relationship permissions/restrictions.
- Teacher: active assigned class/section/subject/period/component only.
- Class teacher: cross-subject visibility does not grant another subject teacher’s write access.
- Staff self-service: own records only unless explicitly permitted.
- Platform operator: SaaS control-plane authority; tenant-record access only through controlled support paths.

Authoritative teacher writes require explicit capabilities, not generic Teacher role. Use existing canonical capabilities; equivalents include `HOMEROOM_ATTENDANCE_MARK`, `PERIOD_ATTENDANCE_MARK`, `SUBJECT_HOMEWORK_WRITE`, `SUBJECT_MARKS_WRITE`, `CLASS_ACADEMIC_OVERVIEW`, `CLASS_TEACHER_REMARK_WRITE`, `RESULT_REVIEW`, `RESULT_PUBLISH`, `MARKS_UNLOCK`.

Sensitive writes/support overrides are audited. Never expose secrets, raw stack traces, provider/storage internals, callback secrets, object keys, private URLs, unrelated student data, safeguarding records, salary/bank data, or private finance/staff data.

Never place production credentials, real student data, database backups, secrets, or private school records in prompts, logs, fixtures, screenshots, issues, PR text, or commits.

## 8. Cross-cutting implementation rules

### Contracts and naming

- Inspect touched-area conventions before adding/renaming routes, files, DTOs, enums, schemas, clients, components, or contracts.
- TypeScript/web paths: kebab-case. Flutter/Dart: lower_snake_case. Framework-required names are exceptions.
- API paths: lowercase kebab-case resource nouns with explicit parameters such as `:studentId`.
- Lifecycle values flow `Prisma/domain → DTO → service → OpenAPI → shared contract → web/mobile`.
- Do not invent UI-only statuses or duplicate raw lifecycle strings.
- Preserve stable legacy names unless a compatibility plan covers DB/API/web/mobile/jobs/cache/integrations/tests.

### Files

Use `Feature module → FileRegistryService → StorageService → StorageAdapter`. No provider SDKs in feature modules, normal DB base64 blobs, raw private-file browser opens, or exposed object keys/private URLs.

### Money

Authoritative SchoolOS runtime totals are authoritative. Money writes are idempotent and audited. Confirmed payments, receipts, accounting, payroll, refunds, and adjustments use reversal/correction, never silent deletion/mutation. Official totals are never independently recomputed in browser/mobile clients. High-risk financial workflows may continue without **internet** only through the trusted School Edge authority; an isolated browser/phone may draft or queue but must not independently finalize shared financial records. External payment-provider actions still require connectivity and must remain pending/queued until the provider can be reached.

### Notifications / notices

Feature modules emit normalized events; they do not call providers directly. M12 owns recipient resolution, templates, preferences, channel routing, jobs/retries/callbacks, read/acknowledgement state, diagnostics, and delivery audit. M15 owns notice draft/approval/audience/version/publish/withdraw semantics.

### Web

- One screen = one primary job.
- Real APIs only; no fake production data.
- The school web application must be **offline-first/installable where practical**: cache the application shell and approved tenant/user projections, persist approved local drafts/queues, survive reload/app restart, and reconnect automatically to School Edge or cloud.
- When internet is unavailable but School Edge is reachable on the local network, the web system should continue normal tenant operations against Edge using the same contracts and authorization behavior as cloud.
- When neither cloud nor Edge is reachable, the browser may continue from protected local cache and local operation queue; shared authoritative finalization waits for an authority connection.
- Paginate growing lists at the authoritative runtime; never preload an entire tenant merely to support offline.
- Handle loading, empty, success, error, permission, module-locked, local-only, queued, syncing, stale, conflict, rejected, revoked, partial-failure, and file-unavailable states where applicable.
- High-risk actions require confirmation/reason where required, including when executed through School Edge.
- KPIs are authoritative-runtime-owned, time-bound, actionable, and honest; never fake `0` for unavailable/stale data.

### Mobile

- Companion app; persona-first, purpose-limited APIs; no admin-shaped payloads.
- Mobile is **local-first**: approved user data, workflow state, drafts, files/thumbnails, and operation queues required for the persona must be available from a protected local store after first successful provisioning/sync.
- The app must support cloud-online, School-Edge/LAN, intermittent-network, and fully disconnected device modes without crashing or presenting fake success.
- Approved writes are recorded locally first with stable operation IDs and synchronized to the active authority when available.
- Show `local`, `queued`, `syncing`, `synced`, `stale`, `conflict`, `rejected`, `revoked`, and `failed` states where relevant.
- Tenant/child/assignment/access changes must invalidate no-longer-authorized local data and queued writes when the app learns of the change.
- Do not require a network round trip merely to open the app, switch among already provisioned children/schools, inspect cached data, create an approved draft, or review queued work.

Biometrics for Parent/Teacher/Principal:

- School provides initial credentials through an approved channel.
- After first successful mobile login, prompt to enable device-supported Face ID/fingerprint.
- Optional; user may skip and enable later in Settings.
- Credential/password fallback remains available.
- Biometrics are device-local unlock only; never store raw biometric templates.
- Logout/session revocation/account recovery/device replacement/permission loss must invalidate protected local access appropriately.

### Offline-first operation and synchronization

**Offline-first is a required product capability for both the School Management System and the mobile app.** SchoolOS must tolerate slow, intermittent, high-latency, or unavailable internet without losing work or corrupting authoritative records.

"Fully offline" means SchoolOS provides three explicit operating modes rather than pretending every device can safely become an independent server:

```text
Mode A — Cloud online
    Web/mobile → Cloud SchoolOS authority

Mode B — Internet unavailable, school LAN available
    Web/mobile → School Edge authority → local PostgreSQL/Redis/storage
    Edge queues replication/delivery work for cloud reconnect

Mode C — Device fully isolated: no internet and no LAN/Edge
    Web/mobile → protected local cache + local operation queue
    User can continue approved work; shared finalization waits for authority
```

The UI must clearly show the active connectivity/authority state. A network outage must not be presented as a generic fatal error.

#### School Edge runtime

To support real whole-school operation during internet outages, SchoolOS may provide a **School Edge** deployment profile for a tenant/site.

Requirements:

- Reuse the same NestJS modules/domain services/contracts as cloud; do not build separate offline business logic.
- Use tenant-bound local PostgreSQL as the authoritative operational database while that Edge authority is active.
- Use local Redis/BullMQ only where current jobs/queues require it; jobs that need internet wait safely.
- Use a local `StorageAdapter` under the existing File Registry/StorageService boundary for protected files created during outage; replicate by stable file ID/content hash when connectivity returns.
- Bind an Edge node to explicitly provisioned tenant/site identity; it must not become a cross-tenant platform node.
- Encrypt secrets and local sensitive data at rest; Edge administration is not ordinary school-user access.
- Expose local health, disk/capacity, backup, queue, replication lag, and last-cloud-sync status.
- Edge upgrades/migrations must use the same schema/contracts and be rollback-aware; never create an incompatible local schema fork.

#### Write authority and split-brain prevention

For each Edge-enabled tenant/site, authoritative writes must have a single active authority model.

- Track `authorityNodeId` and an `authorityEpoch`/equivalent fencing token for authoritative operation streams.
- Cloud and Edge must not silently finalize the same aggregate under different authority epochs.
- Failover/promotion must be explicit, audited, and fenced; stale nodes cannot resume writes after a newer authority epoch exists.
- Operations carry stable IDs and aggregate/entity versions. Replays are idempotent.
- Conflicting authoritative histories are never auto-merged for money, attendance finalization, marks/results, guardian/custody, payroll, permissions, or accounting.
- If an authority conflict is detected after reconnect, quarantine the affected aggregate/workflow and require the defined reconciliation/correction path.

#### Core school workflows during internet outage

When **School Edge is reachable**, active tenant workflows should continue locally as far as they do not depend on an external provider. This includes, subject to normal permissions/locks/entitlements:

- M0 school-side identity/session support, school configuration reads, audit capture, local job/file operations; Platform control-plane operations remain cloud/internal.
- M1 admissions/student/guardian operational records and protected documents.
- M2 attendance capture, submit/finalize/lock/correction workflows.
- M3 fee invoicing, cash/manual-bank collection, receipts, cashier operations, refunds/reversals, reconciliation against locally available evidence.
- M4 marks entry/review/lock/result calculation/publication/report-card generation where all required data/policies are local.
- M5 activity/milestone capture and local media processing where available.
- M6 homework/timetable operations.
- M7 HR/attendance/leave/payroll workflows.
- M11 journals/vouchers/ledger/reporting/period operations.
- M12 local in-app notification state and delivery queue creation.
- M15 notice drafting/approval/publishing to locally reachable SchoolOS users.

All of these still use normal authorization, audit, idempotency, lifecycle, and correction/reversal rules. "Offline" is never permission bypass.

#### External dependencies during outage

Some operations are physically impossible without external connectivity. SchoolOS must degrade cleanly and queue/reconcile instead of failing the surrounding workflow.

Examples:

- Digital-wallet/card/payment-gateway initiation, callback verification, and provider settlement.
- SMS, email, push-provider delivery, voice providers, remote webhooks.
- Direct IEMIS/government submission or any external API sync.
- Cloud-only Platform Operator/support operations.
- Remote object-storage replication when the school is using Edge-local storage.
- Cloud backups/telemetry/observability export.

Use explicit states such as `pending-connectivity`, `queued-for-provider`, `awaiting-verification`, `delivery-deferred`, or the canonical existing equivalents. Never mark an external action successful before provider confirmation.

#### Fully isolated web/mobile device behavior

When a device has **no cloud and no School Edge/LAN connection**, it must still open and remain useful from the last authorized local snapshot.

Allowed locally:

- Browse already authorized cached records needed by the persona.
- Create/edit local drafts for workflows the user is authorized to perform.
- Capture attendance, homework, activity, notes/remarks, forms, requests, and file/media references as queued operations where the module supports it.
- Prepare marks, fee/cashier entries, approvals, accounting entries, payroll changes, result actions, or other high-risk work as **local pending operations** only when a dedicated offline contract exists.
- Review queue status, prior sync history, local conflicts, and last-known data freshness.

An isolated device must not claim that a shared high-risk record is officially finalized when no authoritative SchoolOS runtime has accepted it. Once cloud/Edge returns, the queued operation is re-authorized and either accepted, rejected, or conflicted.

#### Offline authentication and authorization

- First provisioning/sign-in requires a trusted authority unless the device/user was already provisioned for offline use.
- Edge can authenticate locally provisioned school users using approved local auth material/verification flow; do not depend on cloud availability for ordinary on-campus sign-in after provisioning.
- Mobile may unlock an existing protected local session using configured biometric/device credential fallback.
- Cache a signed/versioned offline authorization snapshot containing only required tenant/persona/relationship/assignment/capability scope and its issuance/freshness metadata.
- Local authorization never grants more scope than the last trusted snapshot.
- Edge-side role/guardian/assignment revocation applies immediately on Edge and propagates to connected clients.
- Fully isolated clients purge/restrict data when they next learn of revocation. For especially sensitive capabilities, use a bounded offline authorization lease/grace policy rather than unlimited stale authority.
- Never allow offline mode to manufacture a new Platform Operator, tenant, entitlement, permission, guardian relation, or teacher assignment.

#### Required operation/sync envelope

Queued or replicated writes must use canonical equivalents of:

```text
operationId / clientOperationId
originNodeId
authorityNodeId
authorityEpoch
deviceId
tenantId
userId
persona/context
assignmentVersion / authorizationVersion where relevant
aggregate/entityId
baseEntityVersion / expectedVersion
occurredAtClient
acceptedAtAuthority
localSequence / authoritySequence where relevant
syncAttemptCount
syncStatus
payloadVersion
```

Client timestamps are diagnostic. They do not override authoritative time, fiscal/academic period rules, locks, deadlines, sequence allocation, or permissions.

#### IDs, numbering, and financial integrity offline

- Use globally collision-resistant internal IDs for offline-created records.
- Any human-facing sequential numbers that must be generated during an internet outage—such as receipts/vouchers—must use an approved Edge allocation strategy that guarantees tenant/site uniqueness, for example preallocated sequence blocks or an Edge-owned sequence namespace.
- Never let two isolated clients independently invent the same official receipt/invoice/voucher sequence.
- Cash/manual-bank transactions may be accepted through Edge and posted locally; digital provider payments remain pending until provider verification.
- Reconnect must preserve original transaction IDs and audit history; do not delete/recreate transactions simply to make cloud IDs match.
- M3→M11 and M7→M11 postings remain idempotent across Edge/cloud replication.

#### Sync and replication rules

When connectivity changes, synchronization is automatic but never blind:

1. Discover the active trusted authority: local Edge first when configured/reachable, otherwise cloud according to tenant routing policy.
2. Authenticate node/device and validate tenant binding.
3. Exchange cursors/checkpoints and schema/contract versions.
4. Push immutable outbox operations/events in deterministic order where the domain requires ordering.
5. Deduplicate by operation/event ID.
6. Validate authority epoch, authorization snapshot, entity/aggregate version, locks, entitlements, and business invariants.
7. Accept atomically or return explicit reject/conflict results.
8. Pull authoritative changes and tombstone/revocation events.
9. Reconcile local cache/materialized projections.
10. Upload/download protected files by stable file identity/content hash.
11. Resume deferred provider jobs only after connectivity/provider readiness is confirmed.
12. Persist checkpoints so app/Edge restarts resume without replay corruption.

Sync must be resumable, chunked/batched, bandwidth-aware, and safe under repeated disconnect/reconnect cycles.

#### Conflict handling

- **Duplicate replay:** return the original accepted result; no duplicate records.
- **Non-overlapping safe changes:** merge only when the domain explicitly defines a deterministic merge.
- **Server/Edge record changed from submitted base version:** mark conflict and retain both authoritative and local intent.
- **Attendance/marks/result/finance/payroll/accounting conflict:** never last-write-wins; use explicit correction/reversal/review flow.
- **Guardian/assignment/permission revoked:** mark operation `revoked`/`rejected`; do not keep retrying; purge unauthorized projections.
- **Tenant suspended/module disabled:** stop affected writes immediately when the active authority knows the state.
- **Contract/schema mismatch:** stop incompatible replication and surface upgrade-required/blocked state; never coerce unknown payloads.

#### Local cache/storage rules

- Store only data required by the user's persona and configured offline scope; offline-first does not mean "download the whole tenant to every device."
- Partition local data by tenant + user + persona/context and, where applicable, school/site/child/assignment.
- Protect credentials/refresh material with platform secure storage and sensitive local datasets with the existing encrypted/protected storage design.
- Cache protected files only when explicitly allowed; enforce local access checks and expiry/retention rules.
- Track `lastSyncedAt`, source authority, snapshot/version, and stale state for locally displayed data.
- Logout, school/account switch, device/session revocation, guardian revocation, teacher-assignment removal, or permission loss must clear or quarantine affected cached data/queues.
- Preserve safe unsynced user work before destructive cache cleanup only when doing so does not retain data the user is no longer authorized to possess.

#### Queue, jobs, and provider behavior

- Persist outbox/queue state across browser/app/Edge restart.
- Use bounded retry with jitter/backoff for transient failures; do not create retry storms after a long outage.
- Permanent `4xx`/validation/authz failures are not retried forever.
- Background jobs declare whether they are `LOCAL_OK`, `CONNECTIVITY_REQUIRED`, or `CLOUD_ONLY` (or canonical equivalents).
- Provider-dependent jobs remain pending until provider connectivity/readiness exists.
- User-facing queue dashboards show pending, failed, conflicted, revoked, and completed work with recoverable actions.

#### Offline backups and recovery

- Edge must support local encrypted backup/restore while internet is unavailable.
- Cloud replication is not a substitute for a valid local backup, and local backup is not a substitute for cloud/DR replication after reconnect.
- Protect outbox/inbox/authority metadata in backups so restoring an Edge node cannot silently reuse stale authority and create split-brain.
- A restored node must validate its authority epoch/replication position before accepting new authoritative writes.

#### Offline verification gates

Any feature claiming offline support must test applicable cases across **web, mobile, and Edge**:

- throttled/high-latency/intermittent network;
- internet loss with LAN/Edge still reachable;
- total device isolation with no internet/LAN;
- browser refresh/app kill/device reboot/Edge restart;
- queue persistence and resume;
- duplicate operation replay;
- large backlog synchronization;
- out-of-order/partial batch delivery;
- concurrent authoritative change;
- authority failover/fencing and stale-node rejection;
- expired session/offline unlock;
- guardian/teacher/role revocation before sync;
- tenant suspension/module disable before sync;
- financial/receipt numbering uniqueness;
- marks/attendance/accounting conflict handling;
- protected-file upload/download replication;
- provider outage while core workflow continues;
- no cross-tenant/user/child leakage;
- successful convergence and audit consistency after reconnect.

A feature is not **offline complete** because it has cached pages. It is complete only when the usable workflow, local persistence, authority model, authorization, idempotency, conflict handling, queue recovery, files, security, UI state, restart behavior, and reconnect convergence are implemented and verified end-to-end.

## 9. Missing API decision rule

If a web/mobile/platform surface needs data and no safe backend API exists:

1. Inspect current code, OpenAPI/contracts, permissions, DTOs, Prisma, services, and tests.
2. Confirm the need is real, repeatable, module-owned, tenant-scopable, entitlement/RBAC-gatable, and needed for the active P0 workflow.
3. If yes, implement the smallest purpose-limited module-owned API and connect it.
4. If no, show a safe unavailable/locked/permission state and record the gap.

Never invent endpoint contracts, guess response shapes, derive authoritative totals from list APIs, or show developer-facing “Needs backend API” text in school UI.

Use explicit uncertainty labels when needed: `needs backend verification`, `needs OpenAPI confirmation`, `needs mobile DTO`, `needs idempotency confirmation`, `needs offline sync confirmation`, `needs authorization confirmation`.

## 10. Before coding

1. Read focused instructions/canonical docs/current implementation.
2. Inspect OpenAPI/contracts, Prisma, DTOs, permissions, audit, API clients, migrations, focused tests.
3. Identify the smallest safe P0 change.
4. Reuse architecture; do not duplicate services/endpoints/DTOs/models/components/docs.
5. Do not rewrite working modules without a verified defect or approved reason.
6. Do not modify unrelated files or weaken tests/validation.
7. Update focused tests for behavior changes.
8. Paginate growing lists, avoid unbounded `findMany`, use selective/aggregate queries, review tenant-scoped indexes.
9. Return safe error envelopes; never surface raw technical errors to web/mobile.
10. Run relevant checks and report exact commands/results.

If a security/finance/privacy/academic-integrity requirement remains unresolved after canonical-source inspection, mark that slice PARTIAL/BLOCKED rather than inventing behavior; continue independent safe work where possible.

## 11. Definition of done

Development complete requires, where applicable:

- Real persistence; no fake production data.
- Server-side tenant/RBAC/entitlement/persona/assignment/guardian enforcement.
- Suspended tenants/disabled modules fail closed.
- Sensitive writes/support overrides audited.
- Money writes idempotent; confirmed records corrected/reversed, not deleted.
- Attendance/marks preserve lifecycle and correction history.
- Honest notification state.
- Protected-file architecture respected.
- Growing lists paginated.
- Complete applicable web/mobile states.
- Mobile cache/access revocation handled.
- Focused regression, cross-tenant, role, assignment, guardian, and idempotency tests updated.
- Relevant checks pass or failures are reported exactly.

Staging/pilot/RC/GA claims additionally require the evidence in `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`, including applicable staging migration/configuration, provider/storage checks, authenticated browser E2E, mobile device QA, backup/restore proof, monitoring/alerts, rollback readiness, and controlled-pilot evidence.

## 12. Verification

Run only relevant gates and report exact commands/results. Typical gates:

```bash
pnpm db:generate
pnpm db:validate
pnpm verify:openapi
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
pnpm smoke:pilot
pnpm smoke:full
pnpm --filter @schoolos/web typecheck
pnpm test:web:e2e
cd apps/schoolos_mobile && flutter pub get && dart format . && flutter analyze && flutter test
```

Run platform-web checks only if that app exists/is touched, using its real package scripts. `pnpm smoke:learning` is relevant only for an allowed M13 security/regression fix; it is not a current P0 pilot gate while M13 is frozen.

Docs-only changes need no runtime checks unless they alter executable commands/configuration/contracts/release procedures.

## 13. Progress format

```text
Release stage:
Current P0 slice:
Current module:
Completed:
Remaining P0 blockers:
Risks:
Verification run:
Verification result:
Staging/pilot evidence:
Deferred/not touched:
Next release action:
```

Report verified facts only. Distinguish implementation completion, local verification, staging evidence, pilot evidence, and unresolved blockers.
