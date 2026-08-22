# SchoolOS Agent Instructions

Repository-wide rules for human and AI contributors. Keep work production-oriented, Nepal-only, scoped, evidence-based, and safe under offline operation.

**Current posture:** P0 production-safety execution for a controlled real-school pilot. Offline-first operation, financial immutability, and Nepal fiscal compliance are repository-wide product invariants.

**Active P0 modules:** M0–M7, M11, M12, M15 as required by current P0 workflows.

**Deferred/frozen:** M8 Library, M9 Transport, M10 Canteen, M13 Learning, M14 Intelligence/AI. Preserve existing data, migrations, contracts, permissions, tests, and compatibility code; add no new feature work unless the project owner explicitly reactivates a module.

## 1. Instruction precedence

1. Explicit project-owner instruction for the current task.
2. This root `AGENTS.md`.
3. Scoped `AGENTS.md` in the touched app/package.
4. Canonical product, requirements, architecture, security, compliance, and release documents.
5. Existing contracts, migrations, tests, and code conventions.

Latest explicit owner decisions override stale roadmap assumptions. When a confirmed conflict exists, update the canonical source rather than silently preserving contradictory behavior.

## 2. Canonical sources

Start with `README.md`, `docs/README.md`, and `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`. Then read only focused material required for the task.

| Area | Canonical source |
|---|---|
| Product/function | `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md` |
| API/database/web/mobile requirements | `docs/requirements/SCHOOLOS_SRS.md` |
| Architecture/security/platform | `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` |
| Module ownership/gaps | `docs/architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md` |
| Web | `apps/web/AGENTS.md`, `apps/web/e2e/README.md` |
| Mobile | `apps/schoolos_mobile/AGENTS.md`, `apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md` |
| Production/operations | `docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md` |

Do not create duplicate PRDs/SRSs/SDDs/runbooks or ad hoc roadmap Markdown when content belongs in a canonical document. Track active work/blockers in GitHub Issues, Milestones, or Projects where available.

## 3. Module taxonomy and current status

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

## 4. Nepal-only product boundary and P0 order

SchoolOS is a Nepal-first multi-tenant school operating SaaS for:

- `SCHOOL`: Grades 1–10.
- `HIGHER_SECONDARY`: Grades 11–12 / +2.

Do not introduce international expansion, Cambridge/IB/British/American curriculum execution, OneRoster/LTI, foreign accreditation/compliance, cross-country localization, preschool, Bachelor’s/Master’s institution management, public rankings, or social/open-chat features without a new explicit owner decision.

Release claims require evidence:

```text
Development complete
→ Internal QA ready
→ Staging validated
→ Controlled pilot validated
→ Release candidate
→ GA / Production release
```

Local tests/builds/demos are not staging, pilot, RC, or GA evidence.

P0 is the default implementation scope. Do not start P1/P2 feature expansion while unresolved P0 blockers remain unless explicitly instructed.

P0 execution order:

1. P0-01 — fail-closed entitlements, tenant isolation, teacher assignment authorization, guardian scoping, cache invalidation, authorization matrix.
2. P0-02 — attendance correctness, locking, idempotency, correction history.
3. P0-03 — marks authorization, review/lock/publish/unlock/correction/versioning.
4. P0-04 — versioned Nepal School Education Compliance Profile.
5. P0-05 — reproducible IEMIS validation/export; no direct-sync claim without an authorized interface.
6. P0-06 — fee/receipt/immutable-ledger/IRD fiscal integrity, versioned tax policy, CBMS applicability where required, reconciliation, and idempotent M3/M7→M11 posting.
7. P0-07 — privacy, safeguarding, consent, protected files, sensitive-access audit.
8. P0-08 — offline-first web/mobile operation, School Edge continuity, synchronization, conflict recovery, and no-internet resilience.
9. Nepal localization correctness: Nepali Unicode, NPR, Nepal timezone, Nepal address hierarchy, BS/AD presentation with canonical date storage.
10. Backup/restore, clean migrations, observability, provider/storage readiness, and controlled-pilot evidence.

## 5. Platform control plane and school application are separate security domains

The **SchoolOS Platform** and **School Management System** must not be one application where a hidden `DEVELOPER` role simply sees more school menus.

They may share the monorepo, backend infrastructure, PostgreSQL, Redis, storage abstractions, common packages, and deployment pipeline, but must remain separate in identity, authorization, routing, UI surface, audit semantics, and support access.

### School tenant plane

School personas operate only inside trusted tenant scope: Principal, Admin, Teacher, HR, Accountant, Parent/Guardian.

- `/dashboard/*` = school operations.
- `/dashboard/settings/*` = school configuration.

A Principal/Admin may be highly privileged inside one school but never receives platform capabilities, provider secrets, global flags, SaaS plan controls, infrastructure controls, or access to other tenants.

### Platform control plane

`/platform/*` is the SchoolOS-internal SaaS control plane for tenant lifecycle, entitlements, SaaS subscriptions, platform operators, provider configuration, releases/feature controls, system health, support tooling, cross-tenant audit, and centrally managed compliance-profile publishing.

Conceptually keep:

```text
SchoolAuthorizationContext: tenantId + schoolUserId + roles + permissions
PlatformAuthorizationContext: platformOperatorId + platformRoles + platformCapabilities
```

Rules:

- Never implement `role === 'DEVELOPER' → showEverything()`.
- School sessions/JWTs cannot become platform sessions by adding a role.
- Platform capabilities cannot be assigned by a school Admin/Principal.
- Platform sessions do not carry a tenant as permanent authority scope.
- Prefer a distinct internal platform frontend such as `apps/platform-web` rather than embedding platform menus in the school web app.
- Separate frontend/security domains do not require microservices or a second primary database.

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

Do not introduce microservices, a different primary database technology/search cluster, GPU infrastructure, Kubernetes, or unrelated frameworks without explicit approval.

**Owner-approved offline exception:** an Edge-enabled school may run a tenant-bound local deployment of the same SchoolOS modular monolith with local PostgreSQL, Redis/BullMQ where required, and a local `StorageAdapter`. This is an offline deployment mode of existing architecture, not a forked product or microservice split.

Mandatory boundaries:

- `tenantId` is the canonical tenancy boundary name.
- Backend authorization is truth; frontend hiding is UX only.
- SaaS billing/subscriptions remain separate from school fees/accounting.
- M11 is authoritative for accounting; M3/M7 hand off controlled idempotent entries.
- Source modules emit normalized events; M12 owns notification delivery.
- M15 owns notice authoring/publishing and hands normalized events to M12.
- M13 remains frozen and logically separate; preserve existing data/contracts.
- Cloud, School Edge, web local cache/PWA, and Flutter local stores use the same domain contracts, lifecycle semantics, authorization rules, idempotency rules, audit model, and fiscal rules.
- Edge-enabled tenants must prevent split-brain with an explicit tenant/site write-authority model and authority epoch/lease/fencing semantics.

## 7. Security, authorization, and isolation

Never trust client-supplied `tenantId`, roles, permissions, guardian relations, teacher assignments, totals, approval states, tax treatment, fiscal status, or lifecycle states.

Fail closed when tenant status, entitlement, required capability/assignment, guardian scope, fiscal policy, or protected-file authorization cannot be verified.

Persona scope:

- Parent: active linked children only, with per-relationship permissions/restrictions.
- Teacher: active assigned class/section/subject/period/component only.
- Class teacher: cross-subject visibility does not grant another subject teacher’s write authority.
- Staff self-service: own records only unless explicitly permitted.
- Platform operator: SaaS control-plane authority; tenant-record access only through controlled support paths.

Authoritative teacher writes require explicit capabilities, not generic Teacher role. Reuse canonical capabilities; equivalents include `HOMEROOM_ATTENDANCE_MARK`, `PERIOD_ATTENDANCE_MARK`, `SUBJECT_HOMEWORK_WRITE`, `SUBJECT_MARKS_WRITE`, `CLASS_ACADEMIC_OVERVIEW`, `CLASS_TEACHER_REMARK_WRITE`, `RESULT_REVIEW`, `RESULT_PUBLISH`, `MARKS_UNLOCK`.

Sensitive writes/support overrides are audited. Never expose secrets, raw stack traces, provider/storage internals, CBMS/provider credentials, callback secrets, private object keys/URLs, unrelated student data, safeguarding records, salary/bank data, or private finance/staff data.

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

Authoritative SchoolOS runtime totals are authoritative. Money writes are idempotent and audited. Official totals are never independently recomputed in browser/mobile clients. External payment-provider actions require connectivity and remain pending/queued until verified by the provider.

### Immutable financial ledger and fiscal documents

M3 Fees & Receipts, M7 Payroll, and M11 Accounting & Finance must preserve an immutable authoritative financial history. M3/M7 own business transactions; M11 owns accounting truth.

- Once a financial document/transaction is authoritative (`ISSUED`, `CONFIRMED`, `APPROVED`, `POSTED`, or canonical equivalent), ordinary application flows must not destructively update or delete historical financial facts.
- Draft/unposted records may be edited only inside their defined lifecycle and authorization rules.
- Corrections after the immutable boundary use explicit linked records: credit note, debit note, refund, reversal, adjustment, reclassification, or replacement transaction as appropriate.
- Preserve `original → correction/reversal → replacement` lineage, reason, actor, approval, timestamps, source module, fiscal period, supporting document, and audit events.
- Issued invoice/receipt/voucher numbers are never reused for a different transaction. Reprints preserve the original document identity and are auditable.
- Posted journals remain double-entry balanced. Source-module posting to M11 is idempotent; duplicate event/callback/queue replay returns the existing result rather than posting again.
- Closed fiscal periods fail closed. Reopening requires capability, reason, approval where required, audit evidence, and re-locking.
- Platform/support access does not create a hidden ability to rewrite posted financial history.
- Protect posted ledger facts at API, service, and database layers. Application-only `if (status === POSTED)` checks are insufficient for high-risk records.

Do not use blockchain merely to call the ledger immutable. PostgreSQL transactions, append-only posted facts, constraints, idempotency, correction/reversal records, audit history, backups, and optional later tamper-evident hashing are the preferred architecture.

### Nepal IRD / fiscal compliance

SchoolOS is Nepal-only. M3, M7, M11, School Edge, fiscal documents, and the Nepal Compliance Profile must treat Nepal IRD/Ministry of Finance requirements as **versioned external policy**, not hard-coded constants.

#### Authority and evidence

- Before implementing/changing any tax, levy, VAT, TDS, payroll deduction, invoice format, CBMS, electronic-billing, fiscal-year, or reporting rule, verify the current requirement against official Nepal sources: IRD, Ministry of Finance, Nepal Gazette/Department of Printing, and the controlling Act/Rule/Procedure/notice.
- Record legal/official source, publication/effective date, applicability, reviewer, and evidence location in the compliance policy/version.
- A blog, vendor article, accountant memory, old PDF, prompt, fixture, or previous implementation is not sufficient authority when a current official source exists.
- Never label SchoolOS, a tenant, invoice, statutory schedule, payroll calculation, or connector `IRD compliant`, `VAT compliant`, `TDS compliant`, `CBMS compliant`, or equivalent without current evidence/approval for that exact behavior.
- If a fiscal rule is uncertain or recently changed, preserve the transaction but block false fiscal-final status and surface `needs IRD verification`/canonical equivalent.

#### Effective-dated fiscal policy

Do not scatter Nepal tax/levy rates or invoice rules through feature code. Use the existing Nepal Compliance Profile/canonical equivalents for evidence-backed, effective-dated policy such as:

```text
TaxAuthorityRule / FiscalPolicyVersion
authority = IRD / Ministry of Finance
legalReference / gazetteReference
ruleType
appliesTo / taxpayerThreshold
effectiveFrom / effectiveTo
rate / exemption / treatment
invoiceRequirement
cbmsRequirement
documentTemplateVersion
status = DRAFT | REVIEWED | ACTIVE | EXEMPTED | SUPERSEDED
evidence
```

Reuse existing canonical names/statuses when available; do not create parallel models merely to match this example. Historical transactions retain the fiscal-policy version used. Later legal changes never rewrite historical facts.

**2083/84 volatility is a mandatory design test:** the Economic Act 2083 introduced an Education Equity Fee for private educational institutions, followed by a Nepal Gazette notice granting full exemption. SchoolOS must represent introduce/change/exempt/supersede behavior without code edits or destructive receipt changes. Any amount already collected is handled through the legally valid refund/reversal/adjustment workflow while preserving the original document.

#### Billing and fiscal documents

- Every fee collection must be traceable: `charge/invoice → payment → receipt/fiscal document → M11 posting → audit history`.
- Fiscal identity/configuration supports legal school/entity name, PAN, registration/tax treatment, approved invoice series, fiscal year, branch/site where applicable, and fields required by the active policy.
- Already-issued fiscal documents are not deletable. Post-issue corrections use credit/debit notes or the legally required equivalent and remain linked to the original.
- Do not let an unregistered/not-applicable tenant collect/display VAT merely because a generic template has a tax field.
- VAT-exempt treatment of an education transaction does not imply exemption from PAN, income-tax, payroll/TDS, billing, recordkeeping, CBMS, or other obligations. Resolve each obligation independently from current verified policy.
- Keep business payment state separate from fiscalization state. `PAYMENT_CONFIRMED` does not automatically mean `IRD/CBMS_CONFIRMED`.

#### Electronic billing, software enlistment, and CBMS

Current official 2083/84 baseline to treat as **versioned policy, not a permanent constant**: IRD's 4 Baisakh 2083 notice states that, except specified taxpayers whose business nature does not directly issue invoices to consumers/customers, taxpayers with annual turnover above **NPR 20 crore** must issue invoices electronically and connect the invoice to CBMS at the time of issuance. Re-verify threshold and applicability before implementation, tenant activation, or release.

- Determine CBMS applicability per tenant/legal entity/fiscal period from verified policy and turnover/applicability evidence; never infer it solely from `institutionType === SCHOOL`.
- Keep CBMS credentials/secrets in the approved protected configuration boundary; never expose them to school clients/mobile, logs, exports, prompts, or general support views.
- Electronic-billing software/tenant approval or IRD software-enlistment status must be explicit. Installing SchoolOS does not itself prove authorization to issue IRD electronic/fiscal invoices.
- Provider/government responses are external truth. Store request/idempotency IDs, attempts, acknowledgement/reference, rejection code, timestamps, and reconciliation state without fabricating success.
- CBMS submission is idempotent and retry-safe. Never create a second fiscal document because a submission was retried.

#### Offline-first / School Edge fiscal behavior

Offline-first SchoolOS does not make external IRD obligations disappear. Separate **local business/accounting authority** from **external fiscalization/CBMS confirmation**.

- When School Edge is authoritative and internet is unavailable, internal fee, cash, accounting, and receipt workflows may continue only to the extent allowed by the tenant's current verified fiscal policy.
- If current policy requires CBMS connection/confirmation at invoice issuance, do **not** assume `issue now, upload later` is lawful. Implement only an official/approved outage procedure for that taxpayer/software.
- If the legal outage procedure is unknown, keep the business transaction safely recorded but hold the affected fiscal document in a truthful pending/blocked state such as `PENDING_FISCALIZATION`/canonical equivalent; never claim final IRD/CBMS acceptance.
- Edge must preserve fiscal-number uniqueness across cloud/Edge failover using approved sequence allocation/authority fencing so two authorities cannot issue the same invoice/receipt number.
- Reconnect reconciliation compares local fiscal documents, M11 postings, CBMS acknowledgements, payment-provider evidence, and sequence continuity. Mismatches require explicit resolution; never silently renumber or rewrite issued documents.

#### Payroll/TDS and statutory deductions

- M7 may calculate payroll and M11 may post payroll, but TDS, SSF, PF/EPF, CIT, gratuity, festival allowance, and other Nepal statutory behavior remain versioned/configurable and require current qualified Nepal accounting/legal verification before compliance claims.
- Preserve taxable/non-taxable components, effective policy version, calculation inputs, manual overrides, approval, posting, payment, correction/reversal, and statutory-report evidence.
- Never hide a statutory calculation difference by editing a posted payroll run. Use adjustment/reversal and preserve the original.

#### Minimum P0 fiscal controls

For active M3/M7/M11 fiscal workflows, P0 includes where applicable:

1. Immutable issued invoice/receipt/fiscal-document records.
2. Credit/debit-note, refund, reversal, and replacement lineage.
3. Invoice/receipt sequence uniqueness and sequence-exception reporting.
4. Versioned Nepal tax/levy/exemption policy with official-source evidence.
5. PAN/legal-entity/fiscal identity configuration.
6. Explicit VAT/tax treatment; no generic tax assumptions.
7. CBMS applicability and tenant activation evidence.
8. CBMS connector boundary, idempotency, acknowledgement/rejection, and reconciliation states when applicable.
9. Explicit electronic-billing/software-enlistment/tenant-approval status where required.
10. Offline/School-Edge fiscalization and numbering rules with no false success.
11. Idempotent M3/M7→M11 posting and complete fiscal audit trail.
12. Qualified review/evidence for statutory payroll/TDS schedules before compliance claims.

Any touched fiscal workflow must test applicable cases: duplicate issuance/replay, issued-document update/delete rejection, credit/debit-note lineage, sequence uniqueness, wrong PAN/tax configuration, effective-date boundary, policy supersession/exemption, CBMS required/not-required tenancy, CBMS timeout/retry/rejection/duplicate acknowledgement, Edge outage/reconnect, numbering across authority failover, duplicate M3/M7→M11 posting prevention, period close/reopen, refund/reversal accounting, and audit/export traceability.

Docs/code must distinguish **implemented behavior**, **officially verified requirement**, **IRD/software approval/enlistment evidence**, and **tenant-specific activation evidence**.

### Notifications / notices

Feature modules emit normalized events; they do not call providers directly. M12 owns recipient resolution, templates, preferences, channel routing, jobs/retries/callbacks, read/acknowledgement state, diagnostics, and delivery audit. M15 owns notice draft/approval/audience/version/publish/withdraw semantics.

### Web

- One screen = one primary job.
- Real APIs only; no fake production data.
- The school web app is offline-first/installable where practical: cache the application shell and approved tenant/user projections, persist approved local drafts/queues, survive reload/app restart, and reconnect automatically to Edge/cloud.
- With internet unavailable but School Edge reachable, continue normal tenant operations against Edge using the same contracts/authorization as cloud.
- With neither cloud nor Edge reachable, continue from protected local cache/queue; shared authoritative finalization waits for an authority connection.
- Paginate growing lists at the authoritative runtime; never preload an entire tenant merely for offline use.
- Handle loading, empty, success, error, permission, module-locked, local-only, queued, syncing, stale, conflict, rejected, revoked, partial-failure, and file-unavailable states where applicable.
- High-risk actions require confirmation/reason where required, including through Edge.
- KPIs are authoritative-runtime-owned, time-bound, actionable, and honest; never fake `0` for unavailable/stale data.

### Mobile

- Companion app; persona-first, purpose-limited APIs; no admin-shaped payloads.
- Mobile is local-first: approved persona data, workflow state, drafts, files/thumbnails, and queues remain available from protected local storage after provisioning/sync.
- Support cloud-online, School-Edge/LAN, intermittent-network, and fully disconnected device modes without crashing or presenting fake success.
- Approved writes receive stable operation IDs and synchronize to the active authority when available.
- Show `local`, `queued`, `syncing`, `synced`, `stale`, `conflict`, `rejected`, `revoked`, and `failed` states where relevant.
- Tenant/child/assignment/access changes invalidate no-longer-authorized local data and queued writes when learned.
- Do not require a network round trip merely to open the app, switch among already provisioned children/schools, inspect cached data, create an approved draft, or review queued work.

Biometrics for Parent/Teacher/Principal:

- School provides initial credentials through an approved channel.
- After first successful mobile login, prompt to enable device-supported Face ID/fingerprint.
- Optional; user may skip and enable later in Settings.
- Credential/password fallback remains available.
- Biometrics are device-local unlock only; never store raw biometric templates.
- Logout/session revocation/account recovery/device replacement/permission loss invalidates protected local access appropriately.

### Offline-first operation and synchronization

Offline-first is required for both School Management System and mobile. SchoolOS must tolerate slow, intermittent, high-latency, or unavailable internet without losing work or corrupting authoritative records.

```text
Mode A — Cloud online
    Web/mobile → Cloud SchoolOS authority

Mode B — Internet unavailable, school LAN available
    Web/mobile → School Edge authority → local PostgreSQL/Redis/storage
    Edge queues replication/provider work for cloud reconnect

Mode C — Device fully isolated: no internet and no LAN/Edge
    Web/mobile → protected local cache + local operation queue
    User continues approved work; shared finalization waits for authority
```

The UI must clearly show connectivity/authority state. Network loss is not a generic fatal error.

#### School Edge runtime

- Reuse the same NestJS modules/domain services/contracts as cloud; do not build separate offline business logic.
- Use tenant-bound local PostgreSQL as authoritative operational DB while that Edge authority is active.
- Use local Redis/BullMQ where current jobs/queues require it; internet-dependent jobs wait safely.
- Use a local `StorageAdapter` under File Registry/StorageService for protected files created during outage; replicate using stable file identity/content hash.
- Bind Edge to explicit tenant/site identity; never make it a cross-tenant platform node.
- Encrypt secrets/sensitive local data at rest.
- Expose local health, capacity, backup, queue, replication lag, and last-cloud-sync state.
- Edge upgrades/migrations use the same schema/contracts and remain rollback-aware.

#### Write authority and split-brain prevention

For each Edge-enabled tenant/site, authoritative writes use a single active authority model.

- Track `authorityNodeId` and an `authorityEpoch`/equivalent fencing token for authoritative streams.
- Cloud and Edge must not silently finalize the same aggregate under different authority epochs.
- Failover/promotion is explicit, audited, and fenced; stale nodes cannot resume writes after a newer epoch.
- Operations carry stable IDs and aggregate/entity versions; replay is idempotent.
- Never auto-merge conflicting authoritative histories for money, fiscal documents, attendance finalization, marks/results, guardian/custody, payroll, permissions, or accounting.
- Quarantine detected authority conflicts and use defined reconciliation/correction paths.

#### Core workflows during internet outage

When Edge is reachable, active tenant workflows continue locally as far as external providers are not required and normal permission/lock/entitlement/fiscal rules permit:

- M0 school-side identity/session support, school configuration reads, audit, local files/jobs; Platform control-plane remains cloud/internal.
- M1 admissions/student/guardian operations and protected documents.
- M2 attendance capture/submit/finalize/lock/correction.
- M3 invoicing, permitted cash/manual-bank collection, receipts, cashier work, refunds/reversals, reconciliation against local evidence, subject to IRD/fiscal rules above.
- M4 marks entry/review/lock/result calculation/publication/report-card generation when required data/policies are local.
- M5 activity/milestone capture and local media processing where available.
- M6 homework/timetable.
- M7 HR/attendance/leave/payroll.
- M11 journals/vouchers/ledger/reporting/period operations.
- M12 local in-app notification state and delivery queue creation.
- M15 notice drafting/approval/local publication.

Offline is never an authorization, audit, accounting, or fiscal-compliance bypass.

External dependencies that remain pending during outage include payment-gateway initiation/callback verification/settlement, CBMS/IRD external submission where connectivity is required, SMS/email/push/voice providers, direct IEMIS/government APIs, remote webhooks, cloud-only Platform support, remote storage replication, and cloud telemetry/backups.

Use explicit truthful states such as `pending-connectivity`, `pending-fiscalization`, `queued-for-provider`, `awaiting-verification`, `delivery-deferred`, or canonical equivalents. Never mark an external action successful before provider/government confirmation.

#### Fully isolated device behavior

With no cloud and no Edge/LAN, a provisioned client still opens from its last authorized snapshot and may:

- browse authorized cached records required by its persona;
- create/edit supported local drafts/queued operations;
- capture attendance, homework, activities, notes/remarks, forms, requests, and file/media references where supported;
- prepare high-risk work only as local pending operations when a dedicated offline contract exists;
- review queue/sync/conflict/freshness state.

An isolated client never claims a shared high-risk/fiscal/financial/academic record is officially finalized until an authoritative runtime accepts it.

#### Offline authentication and local scope

- First provisioning/sign-in requires a trusted authority unless already provisioned for offline use.
- Edge can authenticate locally provisioned school users through the approved local auth flow.
- Mobile may unlock a protected local session using configured biometric/device fallback.
- Cache only a signed/versioned offline authorization snapshot with required tenant/persona/relationship/assignment/capability scope and freshness metadata.
- Local authorization never grants more scope than the last trusted snapshot.
- Edge-side revocation applies immediately on Edge and propagates to connected clients.
- Fully isolated clients restrict/purge when they next learn of revocation; sensitive capabilities should use bounded offline authorization leases rather than unlimited stale authority.
- Offline mode cannot manufacture Platform Operators, tenants, entitlements, permissions, guardian relations, or teacher assignments.

#### Sync envelope and rules

Queued/replicated writes use canonical equivalents of:

```text
operationId / clientOperationId
originNodeId
authorityNodeId
authorityEpoch
deviceId
tenantId
userId
persona/context
authorizationVersion / assignmentVersion
aggregate/entityId
baseEntityVersion / expectedVersion
createdAtClient
lastModifiedAtClient
syncAttemptCount
syncStatus
```

Client timestamps are diagnostic; they do not override server/Edge time, periods, locks, deadlines, fiscal dates, or authorization.

Synchronization must:

1. discover the active trusted authority;
2. authenticate node/device and tenant binding;
3. exchange cursors/checkpoints and schema/contract versions;
4. push immutable outbox operations/events;
5. deduplicate by stable operation/event ID;
6. validate authority epoch, authorization snapshot, versions, locks, entitlements, fiscal/business invariants;
7. accept atomically or return explicit rejection/conflict;
8. pull authoritative changes/revocations;
9. reconcile local projections;
10. synchronize protected files by stable identity/content hash;
11. resume provider/government jobs only when connectivity/readiness exists;
12. persist checkpoints so restarts resume safely.

No silent last-write-wins for attendance, marks/results, finance, fiscal documents, payroll, accounting, guardian/custody, permissions, or protected student records.

#### Local storage, queues, backup, recovery

- Store only data required by persona/offline scope; never download the whole tenant to every device.
- Partition local data by tenant + user + persona/context and applicable school/site/child/assignment.
- Protect auth material with platform secure storage and sensitive datasets with approved encrypted/protected storage.
- Track source authority, snapshot/version, `lastSyncedAt`, and stale state.
- Logout/school switch/device-session revocation/guardian revocation/assignment removal/permission loss clears or quarantines affected cached data/queues.
- Persist outbox/queue state across browser/app/Edge restart.
- Use bounded retry/backoff; permanent validation/authz/fiscal failures are not retried forever.
- Background jobs declare whether they are local-safe, connectivity-required, or cloud-only using existing canonical classification.
- Edge supports local encrypted backup/restore during internet loss; restored nodes must validate authority epoch/replication position before accepting authoritative writes.

#### Offline verification gates

A feature claiming offline support tests applicable cases across web/mobile/Edge:

- throttled/high-latency/intermittent network;
- internet loss with LAN/Edge reachable;
- total device isolation;
- browser refresh/app kill/device reboot/Edge restart;
- queue persistence/resume;
- duplicate replay and out-of-order/partial delivery;
- concurrent authoritative change;
- authority failover/fencing/stale-node rejection;
- expired session/offline unlock;
- guardian/teacher/role revocation before sync;
- tenant suspension/module disable before sync;
- fiscal/invoice/receipt numbering uniqueness;
- marks/attendance/finance/accounting conflict handling;
- protected-file replication;
- external provider/CBMS outage while core safe workflow continues;
- no cross-tenant/user/child leakage;
- successful convergence and audit consistency after reconnect.

A feature is not **offline complete** because pages are cached. Completion requires usable workflow, local persistence, authority model, authorization, idempotency, conflict handling, queue recovery, files, security, UI state, restart behavior, and reconnect convergence end-to-end.

## 9. Missing API decision rule

If a web/mobile/platform surface needs data and no safe backend API exists:

1. Inspect current code, OpenAPI/contracts, permissions, DTOs, Prisma, services, and tests.
2. Confirm the need is real, repeatable, module-owned, tenant-scopable, entitlement/RBAC-gatable, and required for the active P0 workflow.
3. If yes, implement the smallest purpose-limited module-owned API and connect it.
4. If no, show a safe unavailable/locked/permission state and record the exact gap.

Never invent endpoint contracts, guess response shapes, derive authoritative totals from list APIs, or show developer-facing “Needs backend API” text in school UI.

Use explicit uncertainty labels when needed: `needs backend verification`, `needs OpenAPI confirmation`, `needs mobile DTO`, `needs idempotency confirmation`, `needs offline sync confirmation`, `needs authorization confirmation`, `needs IRD verification`.

## 10. Before coding

1. Read focused instructions/canonical docs/current implementation.
2. Inspect OpenAPI/contracts, Prisma, DTOs, permissions, audit, API clients, migrations, focused tests.
3. For Nepal tax/fiscal/statutory changes, verify current official IRD/MoF/Gazette evidence before coding.
4. Identify the smallest safe P0 change.
5. Reuse architecture; do not duplicate services/endpoints/DTOs/models/components/docs.
6. Do not rewrite working modules without a verified defect or approved reason.
7. Do not modify unrelated files or weaken tests/validation.
8. Update focused tests for behavior changes.
9. Paginate growing lists, avoid unbounded `findMany`, use selective/aggregate queries, review tenant-scoped indexes.
10. Return safe error envelopes; never surface raw technical errors to web/mobile.
11. Run relevant checks and report exact commands/results.

If a security, finance, fiscal, privacy, or academic-integrity requirement remains unresolved after canonical-source inspection, mark that slice PARTIAL/BLOCKED rather than inventing behavior; continue independent safe work where possible.

## 11. Definition of done

Development complete requires, where applicable:

- Real persistence; no fake production data.
- Server-side tenant/RBAC/entitlement/persona/assignment/guardian enforcement.
- Suspended tenants/disabled modules fail closed.
- Sensitive writes/support overrides audited.
- Money writes idempotent; issued/posted financial facts immutable and corrected through linked credit/debit notes, refunds, reversals, adjustments, or replacements.
- Applicable IRD/fiscal policy effective-dated and evidence-backed; PAN/tax treatment/document sequence/CBMS state honest, tenant-scoped, auditable, and never hard-coded from stale rules.
- Required electronic-billing/software-enlistment/CBMS evidence and tenant activation status recorded before compliance claims.
- Offline fiscalization never fabricates IRD/CBMS success and preserves numbering/reconciliation integrity.
- Attendance/marks preserve lifecycle and correction history.
- Honest notification state.
- Protected-file architecture respected.
- Growing lists paginated.
- Complete applicable web/mobile/offline states.
- Local cache/access revocation handled.
- Focused regression, cross-tenant, role, assignment, guardian, idempotency, fiscal, and offline tests updated.
- Relevant checks pass or failures are reported exactly.

Staging/pilot/RC/GA claims additionally require evidence in `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`, including applicable staging migration/configuration, provider/storage/CBMS readiness where relevant, authenticated browser E2E, mobile/Edge QA, backup/restore proof, monitoring/alerts, rollback readiness, and controlled-pilot evidence.

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

Run platform-web/Edge/fiscal connector checks only if those apps/profiles exist or are touched, using their real package scripts. `pnpm smoke:learning` is relevant only for an allowed M13 security/regression fix; it is not a current P0 pilot gate while M13 is frozen.

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
IRD/fiscal evidence (if applicable):
Offline/Edge evidence (if applicable):
Staging/pilot evidence:
Deferred/not touched:
Next release action:
```

Report verified facts only. Distinguish implementation completion, local verification, official fiscal evidence, tenant activation evidence, offline/Edge evidence, staging evidence, pilot evidence, and unresolved blockers.
