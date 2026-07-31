# SchoolOS Controlled-Pilot Implementation Priority Roadmap

**Document status:** Implementation planning baseline  
**Primary objective:** Harden the existing SchoolOS product for a controlled school pilot without broadening module scope.  
**Decision principle:** Resolve authorization, student-safety, financial-correctness, privacy, notification, offline-conflict, and adoption risks before adding new modules or advanced features.

---

## 1. Executive Decision

SchoolOS should **not build more modules before the controlled pilot**.

The implementation focus must be:

1. teacher assignment and action-scope enforcement;
2. guardian-child capability permissions;
3. wrong-child action prevention;
4. attendance finalization, correction, and offline conflict safety;
5. critical notification severity, delivery state, acknowledgement, and fallback;
6. shared-device privacy, recovery, session revocation, and cache removal;
7. structured parent correction and support requests;
8. seeded browser, multi-user, Android, and iOS verification.

All other work must be classified as:

- a lightweight pilot improvement;
- a school-policy dependency;
- a conditional release blocker for an enabled feature;
- a post-pilot enhancement;
- explicitly deferred product scope.

---

## 2. Priority Definitions

| Priority | Meaning | Release treatment |
|---|---|---|
| **P0 — Pilot blocker** | Failure could permit unauthorized access, wrong-student actions, false safety alerts, data loss, financial duplication, exposure of sensitive information, or loss of operational trust. | Must be implemented and verified before the affected pilot workflow is enabled. |
| **Conditional P0** | Critical only when the related capability is enabled, such as digital payments, pickup authorization, medical emergency data, or practical-component marking. | Disable the capability or complete its P0 controls before pilot use. |
| **P1 — Pilot quality** | High-value improvement that materially improves usability, adoption, coordination, or supportability but is not always a safety blocker. | Complete critical-screen portions before pilot; remaining work may continue during the controlled pilot. |
| **P2 — Post-pilot** | Important operational breadth that is not necessary for the first controlled school pilot. | Schedule only after P0 evidence and pilot feedback. |
| **Policy required** | The school needs an approved manual procedure before software automation is safe. | Document, train, and test the policy now; build deeper software later. |
| **Deferred** | Complexity exceeds near-term pilot value or introduces substantial privacy, legal, integration, or operational risk. | Do not implement during pilot hardening. |

---

# 3. Master Priority List

## 3.1 P0 — Mandatory Controlled-Pilot Release Blockers

### P0-01 — Shared Teacher Authorization and Scope Resolver

**Goal:** Make one backend service the source of truth for every teacher read, write, edit, submit, approve, publish, download, and protected-file action.

**Resolver inputs**

- tenant;
- user;
- academic year and term;
- class and section;
- subject;
- subject component where applicable;
- teacher assignment type;
- functional or temporary duty;
- effective start and end time;
- requested action;
- record state;
- delegation or replacement status.

**Minimum rules**

```text
Subject teacher
→ view and edit assigned subject/component only

Class teacher
→ view class coordination information
→ cannot edit another subject teacher’s records

Temporary substitute
→ access exact date, period, class, and permitted actions only

Exam or activity duty
→ receives duty-specific access only

Unassigned, revoked, or expired teacher
→ no access
```

**Apply to**

- attendance;
- homework;
- marks and results;
- lesson diary and curriculum progress;
- student lists;
- activities;
- notices;
- reports and exports;
- mobile APIs;
- protected files;
- offline synchronization;
- direct-object URL/API access.

**Implementation requirements**

- fail closed when scope cannot be resolved;
- no duplicated module-specific authorization logic;
- deny direct API access even when the UI hides the action;
- return a stable reason code for denied actions;
- log authorization decision inputs without exposing sensitive payloads;
- add unit, integration, and cross-module contract tests.

**Scenario coverage**

- multiple simultaneous teacher responsibilities;
- class-teacher versus subject-teacher boundaries;
- assistant/shared/component-level teaching;
- examination coordinator, invigilator, and marker separation;
- activity-only responsibilities;
- branch-specific teaching;
- temporary responsibilities and expiry.

**Owner:** Backend/Auth with module owners  
**Dependency:** Existing assignment tables remain in place  
**Release gate:** No teacher-facing module may retain independent incomplete scope checks.

---

### P0-02 — Temporary Substitute, Long-Term Replacement, and Handover

**Goal:** Support teacher absence and replacement without granting permanent broad access or rewriting historical ownership.

**Temporary substitute workflow**

```text
Teacher unavailable
→ Authorized coordinator assigns substitute
→ Date/period/class/action scope granted
→ Substitute records attendance and coverage
→ Handover note returned to original teacher
→ Access expires automatically
```

**Long-term replacement workflow**

- define effective start date;
- immediately revoke the former teacher’s new operational access;
- preserve original authorship of submitted records;
- explicitly transfer, return, or cancel pending work;
- prevent old offline writes from synchronizing;
- remove unauthorized cached student data;
- assign responsibility for pending corrections and parent cases;
- keep a complete audit trail.

**Minimum substitute permissions**

- assigned roster;
- period timetable and room;
- actionable safety information;
- attendance for the covered period;
- lesson coverage note;
- optional homework draft, subject to school policy.

**Explicit exclusions**

- unrestricted historical observations;
- unrelated marks;
- result publication;
- permanent class access;
- access after the effective period.

**Owner:** Academic Operations + Auth + Mobile  
**Dependency:** P0-01  
**Release gate:** Sudden absence and long-term replacement pass end-to-end tests.

---

### P0-03 — Assignment Revocation, Offline Enforcement, and Secure Cache Purge

**Goal:** Ensure removed access is removed from server actions, queued writes, protected files, and local device data.

**Required behaviour**

- server rejects queued writes created under expired or revoked scope;
- revoked class and child records disappear after synchronization;
- sensitive local cache is deleted or cryptographically invalidated;
- protected-file tokens stop working;
- push topics/subscriptions are updated;
- user sees a clear non-sensitive explanation;
- historical audit records remain;
- unauthorized offline drafts cannot become official records.

**Required conflict state**

```text
Draft created while authorized
→ Assignment revoked
→ Device reconnects
→ Draft rejected
→ Sensitive roster cache removed
→ Optional non-sensitive handover note retained only when policy allows
```

**Owner:** Auth + Sync + Mobile Security  
**Dependency:** P0-01  
**Release gate:** Revocation tests pass with devices offline during the permission change.

---

### P0-04 — Effective-Dated Student Roster Membership

**Goal:** Handle admission, transfer, section change, withdrawal, and academic-year transitions without rewriting history.

**Rules**

- roster membership has effective start and end dates;
- historical attendance remains in the historical class context;
- future homework and notices follow the new section;
- no student appears in two active rosters unless an explicit valid arrangement exists;
- admission does not create false historical absences;
- prior marks remain linked to the original assessment/class context;
- teacher access updates immediately;
- parent access remains tied to the student, not the old section;
- transfer and section-change events are audited.

**Owner:** Student Information + Academic Operations  
**Dependency:** P0-01  
**Release gate:** Mid-term join, transfer, and section-change scenarios pass.

---

### P0-05 — Guardian Capability Permission Model

**Goal:** Replace the assumption that every linked guardian has identical authority.

**Minimum guardian-child capabilities**

```text
Can view academics
Can view attendance
Can manage leave
Can view fees
Can pay fees
Can receive emergency alerts
Can communicate with school
Can give specific consent
Can authorize pickup
Can submit complaints or correction requests
```

**Relationship state**

- verified or unverified;
- active, suspended, revoked, or expired;
- effective start and end date;
- emergency-contact priority;
- school approval status;
- restriction reason reference;
- complete audit history.

**Supported realistic arrangements**

- overseas parent plus local daily guardian;
- grandparent as main guardian;
- financial sponsor;
- separated parents with field-level restrictions;
- temporary guardian;
- hostel or local caregiver;
- emergency-only contact;
- pickup-only authorized person;
- deceased or ended relationship;
- compromised account.

**Do not implement**

- automated legal interpretation;
- custody decision engine;
- complex court-order parsing;
- automatic conflict resolution between guardians;
- cross-school permission federation.

**Owner:** Identity + Student Information + Parent APIs  
**Release gate:** Guardian access differs correctly by capability and expires or revokes immediately.

---

### P0-06 — Guardian Administration, Recovery, and Revocation

**Goal:** Give school administrators a safe, auditable way to manage guardian access.

**Minimum administration screen**

- search and select student;
- link guardian;
- verify relationship;
- assign capabilities;
- set emergency priority;
- set temporary start/end;
- restrict sensitive fields;
- revoke or suspend access;
- view recent sessions/devices where appropriate;
- record evidence reference and decision reason;
- notify other authorized guardians when policy permits.

**Recovery paths**

- trusted existing session;
- verified email;
- approved co-guardian;
- school-assisted identity review;
- staff approval for high-risk phone-number changes;
- revocation of old sessions;
- temporary hold when account takeover is suspected.

**Required edge cases**

- lost phone;
- changed SIM;
- changed phone number;
- temporary guardian expiry;
- relationship removal;
- separated-parent restriction update;
- deceased guardian;
- account compromise.

**Owner:** Admin Web + Identity + Support Operations  
**Dependency:** P0-05  
**Release gate:** Admin can provision, restrict, recover, expire, and revoke access without database intervention.

---

### P0-07 — Wrong-Child Prevention

**Goal:** Prevent payment, leave, consent, pickup, complaint, and message actions for the wrong child.

**Every high-impact screen must show**

- child name;
- photograph or non-sensitive identifier where permitted;
- class and section;
- school or branch;
- action;
- amount, date, event, teacher, or recipient as relevant.

**Require confirmation for**

- payments;
- leave;
- consent;
- pickup authorization;
- complaints;
- attendance corrections;
- sensitive messages;
- meeting requests about a specific child.

**Backend controls**

- revalidate guardian-child relationship at submission;
- revalidate required capability;
- reject stale child context;
- use idempotency for transactional actions;
- store child ID and visible confirmation context in the audit event;
- never rely only on the active-child selection in the client.

**Owner:** Parent Web/Mobile + Parent APIs  
**Dependency:** P0-05  
**Release target:** Zero confirmed wrong-child actions caused by interface context.

---

### P0-08 — Attendance State, Finalization, Conflict, Leave, and Correction Model

**Goal:** Make attendance operationally accurate and parent-safe.

**Required attendance states**

```text
Not started
In progress
Submitted/finalized
Present
Absent
Late
Approved leave
Early authorized departure
Unauthorized departure
Period absent
Correction requested
Corrected
Locked
Conflict requiring review
```

**Core rules**

- “not recorded” is never treated as “absent”;
- confirmed absence alerts are not sent before finalization or the configured cutoff;
- approved leave automatically informs attendance state;
- daily attendance, period attendance, and school-presence events remain distinct;
- one record does not silently overwrite another;
- original and corrected values remain auditable;
- stale offline replay cannot overwrite a finalized record;
- a parent can report an incorrect record;
- the reviewing authority is independent when a dispute involves the original teacher;
- principal/coordinator can identify unsubmitted attendance.

**Conflict evidence**

- event time;
- device capture time;
- server receipt time;
- synchronization time;
- author;
- class/period context;
- original value;
- official value;
- correction or resolution outcome.

**Example conflict**

```text
Offline draft: Present at 9:05
Official record: Late at 9:18
Finalized by Class Teacher

Actions:
- View difference
- Discard local draft
- Request correction
```

**Owner:** Attendance + Sync + Notifications + Parent App  
**Dependencies:** P0-01, P0-04  
**Release gate:** Multi-user, multi-device, offline/online conflict tests pass.

---

### P0-09 — Notification Severity, Delivery State, Acknowledgement, and Escalation

**Goal:** Separate routine information from safety-critical communication and accurately represent notification outcomes.

**Severity model**

| Level | Examples | Pilot behaviour |
|---|---|---|
| Emergency | Missing child, serious injury, security concern | Push + configured fallback + acknowledgement + manual phone escalation |
| Urgent | Verified absence, sudden closure, same-day critical change | Push; fallback when unread or failed |
| Action required | Payment failure, leave information, consent | In-app/push with deadline |
| Informational | Homework, results, events | In-app and optional push |
| Digest | Routine summaries | Daily or weekly |

**Delivery states**

```text
Queued
Sent to provider
Provider accepted
Delivered where known
Read
Acknowledged
Failed
Expired
Escalated
```

**Rules**

- “sent” is not “delivered”;
- “delivered” is not “read”;
- “read” is not “acknowledged”;
- no absence alert before attendance finalization;
- emergency content uses neutral lock-screen wording;
- critical unread or failed alerts follow configured escalation;
- notification history records provider timestamps and fallback attempts;
- SMS is used only where configured;
- manual telephone procedures remain the final emergency fallback;
- automated voice calling is not required.

**Owner:** M12 Notifications + M15 Notices + Attendance  
**Dependency:** P0-08 for absence alerts  
**Release gate:** Emergency and verified-absence notification paths pass provider and fallback testing.

---

### P0-10 — Shared-Device Privacy and Session Security

**Goal:** Protect results, fees, health information, complaints, and guardian restrictions on shared, lost, or replaced devices.

**Minimum controls**

- neutral/masked lock-screen notifications;
- secure token storage;
- encrypted sensitive cache;
- logout clears private cache;
- short app-lock timeout;
- active session/device list;
- remote session revocation;
- re-authentication for payment and consent;
- school-assisted account recovery;
- revoke access after guardian relationship removal;
- prevent stale protected-file access;
- purge class/child cache after permission revocation.

**Strongly recommended**

- biometric or app PIN where supported;
- clear active guardian identity;
- sensitive-screen screenshot protection where technically appropriate;
- session-risk flag for high-risk account changes.

**Not required**

- device-location tracking;
- behavioural fraud scoring;
- automatic SIM-change trust;
- sophisticated multi-profile family switching.

**Owner:** Identity + Mobile + Web Security  
**Dependencies:** P0-05, P0-06  
**Release gate:** Shared-phone, lost-phone, logout, revoked-session, and protected-cache tests pass.

---

### P0-11 — Structured Requests, Corrections, and Independent Dispute Review

**Goal:** Replace unrestricted chat with traceable purpose-specific cases.

**P0 request categories**

- attendance correction;
- fee issue;
- leave;
- wrong or missing payment;
- urgent child-related concern;
- homework clarification where needed for pilot.

**P1 categories**

- meeting request;
- complaint;
- transport issue when enabled;
- result or mark review;
- consent clarification;
- general academic coordination.

**Minimum case fields**

- child;
- category;
- requester and capability;
- responsible teacher/team;
- current status;
- expected response time;
- parent reply;
- school reply;
- attachments/evidence;
- reassignment;
- escalation;
- decision;
- closure and reopen reason.

**Dispute rule**

```text
Parent raises dispute
→ Record owner gives factual response
→ Independent coordinator reviews
→ Principal/formal authority decides when unresolved
→ Original record remains
→ Correction or decision is appended
```

**Owner:** Action Centre + Attendance + Finance + Academic Modules  
**Dependencies:** P0-05, P0-07, P0-08  
**Release gate:** Attendance, fee, and leave cases route, deduplicate, escalate, and close correctly.

---

### P0-12 — Financial Correctness and Payment Uncertainty

**Classification:** Conditional P0 when real digital payments are enabled.

**Goal:** Prevent duplicate charges, wrong-child payments, double ledger postings, and misleading payment status.

**Required payment states**

```text
Created
Awaiting provider
Pending verification
Provider confirmed
Posted to ledger
Failed
Cancelled
Reversed
Refund pending
Refunded
Unmatched credit
Disputed
```

**Required controls**

- backend-owned amounts and ledger posting;
- idempotency key per attempt;
- duplicate-tap and replay protection;
- provider-reference reconciliation;
- “Do not pay again” pending-verification state;
- one ledger posting per confirmed payment;
- wrong-child confirmation;
- cash-payment correction workflow;
- missing discount/scholarship dispute;
- refund or transfer workflow;
- complete audit trail;
- payment success shown only after server confirmation.

**Release options**

- complete this item before enabling digital payments; or
- keep digital payments disabled and use verified manual collection during the pilot.

**Owner:** Finance + Payments + Parent App  
**Dependencies:** P0-07, P0-10  
**Release gate:** Deducted-but-unconfirmed, duplicate, retry, refund, and reconciliation tests pass.

---

### P0-13 — Medical Emergency, Emergency Contact Escalation, and Pickup Safety

**Classification:** Conditional P0 when these capabilities are enabled.

**Teacher emergency view**

- actionable allergy/emergency instruction;
- emergency contact order;
- school health or incident contact;
- incident timestamp;
- first-aid actions;
- guardian-contact status;
- administration handover.

**Privacy rule**

- show only information needed for immediate action;
- hide unrelated diagnoses, family health records, and documents.

**Emergency contact escalation**

```text
Primary guardian
→ Secondary guardian
→ Local emergency contact
→ School incident owner
→ Documented emergency protocol
```

**Pickup authorization**

- approved pickup-person list;
- time-limited authorization or code;
- staff identity verification;
- guardian confirmation;
- release timestamp and releasing staff;
- denial and incident workflow;
- immediate alert for attempted unauthorized collection;
- possession of the parent’s phone alone is insufficient.

**Release options**

- implement and test before enabling digital pickup/emergency workflow; or
- use a documented manual process and keep the app feature disabled.

**Owner:** Student Safety + Parent App + Notifications  
**Dependencies:** P0-05, P0-09, P0-10  
**Release gate:** Contact failure and unauthorized-pickup scenarios pass.

---

### P0-14 — Core Security and Data-Integrity Guarantees

**Goal:** Preserve the existing architecture and prove the non-negotiable controls.

**Required evidence**

- tenant isolation;
- assignment and guardian authorization;
- backend-owned money;
- idempotent financial writes;
- authenticated protected files;
- audit history for corrections and access changes;
- secure token and cache handling;
- backup and restore;
- safe migration history;
- no stale offline overwrite of official records;
- no unauthorized direct-object access;
- rate limiting and request validation for sensitive actions;
- secrets and production configuration checks.

**Owner:** Platform + Security + Module Owners  
**Release gate:** Security regression suite and restore drill pass.

---

### P0-15 — Seeded Browser, Multi-User, Provider, and Real-Device Verification

**Goal:** Convert local implementation claims into controlled-pilot evidence.

**Required test matrix**

| Layer | Required evidence |
|---|---|
| Backend | Unit, integration, authorization, idempotency, concurrency, and migration tests |
| Web | Seeded browser workflows for Principal, Teacher, Parent, and school administrator |
| Android | Real low/mid-range device tests, offline sync, app restart, revoked access, and shared-phone privacy |
| iOS | Supported-device smoke tests for the enabled Parent/Teacher workflows |
| Multi-user | Two teachers or teacher/admin editing/finalizing the same record |
| Multi-device | Offline device reconnecting after online finalization or revocation |
| Notifications | Push, in-app, provider failure, unread state, acknowledgement, and SMS where enabled |
| Payments | Provider sandbox/reconciliation tests if enabled |
| Operations | Backup/restore, session revocation, log review, support procedure, and incident drill |

**Pilot release evidence**

- test case ID;
- seeded data used;
- environment;
- device/browser;
- expected result;
- observed result;
- screenshots/log reference;
- defect link where failed;
- reviewer;
- date;
- pass/fail decision.

**Owner:** QA + Module Owners + Operations  
**Dependencies:** All P0 items  
**Release gate:** No unresolved severity-1 or severity-2 defect in enabled pilot scope.

---

## 3.2 P1 — High-Value Pilot Improvements

### P1-01 — Parent Dashboard Reordering

Order the dashboard as follows:

1. emergency alerts;
2. acknowledgement-required actions;
3. today’s attendance;
4. leave/correction status;
5. official notices;
6. fees;
7. homework and exams;
8. published results.

Also show:

- selected child;
- last updated time;
- stale, pending, or offline state;
- correction/report action;
- official versus replaced notice.

---

### P1-02 — Nepali and English Critical-Screen Usability

Complete bilingual foundations first for:

- login and recovery;
- child selection;
- attendance and corrections;
- leave;
- fees and payment status;
- emergency alerts;
- consent;
- guardian administration;
- session/device management.

Requirements:

- account language preference;
- simple school terminology;
- large tap targets;
- readable text;
- no colour-only status;
- clear offline/sync wording;
- low-end Android performance;
- accessible error and confirmation messages.

Regional languages, automated translation, full voice navigation, and broad audio-generation remain deferred.

---

### P1-03 — Principal Attention View

Provide one consolidated view of:

- pending leave;
- attendance corrections;
- result corrections;
- urgent notices;
- missing attendance submissions;
- unresolved high-priority parent cases.

Each item opens the owning module for the decision.

Do **not** build a competing generic workflow engine before the pilot.

---

### P1-04 — Operational Timetable and Substitute Coordination

Connect leave, exam duty, and absence to:

- uncovered-period detection;
- substitute suggestions;
- qualification and conflict checks;
- changed period/room notification;
- temporary scope creation;
- automatic scope expiry;
- record of whether the class occurred.

---

### P1-05 — Shared Teaching and Subject Components

Support explicit component scopes such as:

- theory;
- practical;
- internal assessment;
- project;
- observation-only assistant;
- draft creator;
- reviewer;
- publisher.

Prevent concurrent-edit overwrite and preserve each contributor’s authorship.

This becomes Conditional P0 before a Grade 11–12 or practical-subject pilot.

---

### P1-06 — Daily, Period, and School-Presence Attendance Presentation

Build a clear derived view without merging distinct evidence:

- daily summary;
- period attendance;
- late arrival;
- early departure;
- approved leave;
- unauthorized departure;
- parent-safe status.

---

### P1-07 — Lightweight Lesson Diary and Closure Replanning

Record:

- planned content;
- actual topic/pages covered;
- learning outcome;
- incomplete content;
- reteaching needed;
- disruption reason;
- revised date;
- optional private reflection.

Support closures caused by weather, strike, public notice, examination-centre use, teacher absence, and local events without creating false performance alerts.

---

### P1-08 — Homework Workload and Publication Safety

Provide:

- total assignments due by class/date;
- estimated workload;
- exam/holiday conflict warning;
- cross-subject overload warning;
- actual publication time;
- corrected deadline when posted late;
- attachment-health state;
- version history;
- no overdue status before publication;
- no student penalty caused solely by a failed attachment.

Class teachers may coordinate but cannot edit another teacher’s homework.

---

### P1-09 — Exam Duty Scopes and Assessment Exceptions

Separate:

- invigilator;
- subject teacher;
- practical evaluator;
- exam coordinator;
- result reviewer;
- result publisher.

Assessment states must distinguish:

```text
Zero
Absent
Exempt
Not assessed
Withheld
Make-up pending
Supplementary completed
Unpublished
```

Never convert missing/unpublished marks to zero.

---

### P1-10 — Class-Teacher Coordination Dashboard

Show:

- subject submission status;
- homework workload;
- attendance pattern;
- unresolved parent follow-ups;
- meeting history;
- responsible teacher;
- correction/request action.

Do not permit silent editing of another teacher’s marks, homework, lesson diary, or academic remarks.

---

### P1-11 — Teacher Observation Visibility Classes

Require the author to select the record type:

| Record type | Visibility |
|---|---|
| Routine academic observation | Teacher and authorized academic staff |
| Parent-ready progress remark | Parent-visible after required review |
| Private teacher reflection | Teacher only |
| Student-support case note | Assigned support team |
| Safeguarding concern | Restricted policy-defined workflow |

Prevent accidental publication in report cards, notices, parent feeds, or exports.

---

### P1-12 — Communication Hours, Routing, and Response Expectations

Structured communication should support:

- school communication hours;
- normal versus permitted urgent categories;
- next expected response window;
- subject issue versus whole-child routing;
- internal reassignment without parent resubmission;
- response SLA;
- reminder and escalation;
- reopen after incorrect closure;
- rate limiting;
- abusive-message reporting;
- no exposure of private phone numbers.

---

### P1-13 — Low-End Device and Large-Class Performance

Classroom workflows must support:

- mark all present, then edit exceptions;
- minimal typing;
- autosave;
- recent-class shortcuts;
- low-data attachments;
- resume after interruption;
- keyboard entry on web;
- virtualized/paginated large rosters;
- bulk remarks;
- absent/exempt shortcuts;
- protected bulk import;
- no repeated full-list reload;
- clear offline indicator.

Complete before a Grade 11–12 or 60–80-student class pilot.

---

### P1-14 — Payment Corrections and Family Financial Privacy

When payments are enabled, support:

- missing cash payment;
- disputed payment;
- missing scholarship or discount;
- instalment/hardship request;
- reminder pause for disputed amount;
- restricted finance-team visibility;
- backdated correction with reason;
- original and corrected ledger records;
- updated statement.

A child’s learning and safety access must not be blocked by a private financial-support request.

---

### P1-15 — Result Explanation and Published Correction History

Parent results should show:

- official grading legend;
- plain-language explanation;
- previous-term comparison where appropriate;
- no harmful ranking;
- clear zero/missing/unpublished distinction;
- meeting/review action.

When corrected after publication, show:

- current value;
- previous value;
- correction date;
- reason;
- approver;
- report-card regeneration status;
- review route.

---

### P1-16 — Specific Digital Consent

Consent must be purpose-specific and show:

- activity purpose;
- date and location;
- cost;
- transport;
- supervision;
- safety arrangements;
- departure and return time;
- emergency contact;
- exact permission requested.

Sensitive consent requires re-authentication. Avoid permanent blanket consent.

---

### P1-17 — Parent Meeting Access

Support:

- meeting-slot booking;
- phone/video option;
- asynchronous questions;
- alternate authorized guardian;
- meeting summary;
- actions, owner, and follow-up date.

---

### P1-18 — Official Notice Versioning

For replaced or corrected notices, show:

- current official notice;
- previous version;
- what changed;
- publication time;
- replacement relationship;
- acknowledgement when the change is significant.

---

### P1-19 — Multigrade Classroom Support

**Conditional priority:** P1 for rural/community-school pilots that use multigrade teaching; otherwise P2.

Support:

- one teaching block with multiple grade rosters;
- separate curriculum progress;
- grade-specific homework and assessment;
- grouped activities;
- one workload record;
- grade-specific parent records.

---

### P1-20 — Complaint and Investigation Separation

Separate:

- routine correction;
- academic dispute;
- staff-conduct complaint;
- safeguarding concern.

For staff complaints:

- restricted intake;
- conflict-of-interest routing;
- factual response;
- protected evidence;
- independent decision;
- appeal/closure;
- no public accusation;
- no automatic delivery to the alleged person when unsafe or inappropriate.

Full safeguarding case management remains policy-blocked.

---

## 3.3 P2 — Post-Pilot Enhancements

### P2-01 — Club, House, Sports, and Activity Coordination

Provide activity-specific rosters, attendance, consent, notices, and temporary scopes without academic access.

### P2-02 — Field Trip and Event Duty

Provide participant list, emergency contacts, actionable medical alerts, consent state, departure/return confirmation, and incident reporting.

### P2-03 — Teacher Mentoring Without Surveillance

Support mentoring goals, observation feedback, training history, private reflection, and follow-up actions. Do not automatically rank teachers or expose private reflection.

### P2-04 — Multi-Branch Teacher Context

Provide branch-specific timetable, assignment scope, notices, emergency contacts, and explicit active-branch context. Prevent cross-branch search leakage.

### P2-05 — Academic-Year and Term Transition

Automate assignment expiry/start, read-only history, outstanding-correction ownership, dashboard rollover, export permission, and cache refresh.

### P2-06 — IEMIS and NEB Export Handoff

Provide validated export, missing-field report, verification checklist, version/timestamp, rejection correction, and no guarantee of official-system acceptance.

### P2-07 — Hostel Parent Summary

Provide movement/leave, serious health events, major wellbeing/disciplinary events, hostel contact, and emergency information without continuous surveillance.

### P2-08 — Cross-School or Cross-Tenant Family Aggregation

Defer until tenant isolation, consent, account recovery, and cross-school governance are independently proven.

### P2-09 — Transport Delay and Route Change

Provide verified delay, route change, alternate pickup, and acknowledgement. Live GPS must show “unavailable” when stale. Do not display stale data as live.

### P2-10 — Disability and Special-Support Plans

Provide accommodation plans, authorized contacts, review dates, accessible resources, and restricted support information without stigmatizing labels.

### P2-11 — Deeper Parent Accessibility

After critical-screen bilingual work, consider audio notices, guided mode, assisted family helper, and broader accessibility settings.

### P2-12 — Wider Communication Categories

Add additional case types only after attendance, fee, leave, and critical support requests are stable.

### P2-13 — Generic Approval Adapter

Build only when several modules demonstrably require one decision API and the owning-module source of truth can be preserved.

### P2-14 — Advanced Institutional and Learning Workflows

Expand early warning, interventions, learning outcomes, curriculum monitoring, and institutional planning only after pilot validation of core data quality.

---

# 4. Policy Required Now; Full Module Later

## 4.1 Safeguarding

Before any safeguarding automation, each pilot school must define:

- designated safeguarding contact;
- emergency telephone number;
- confidential reporting route;
- restricted-access roles;
- no sensitive details in notifications;
- escalation steps;
- documentation and retention rules;
- conflict-of-interest handling;
- response outside school hours;
- when police, health, or child-protection authorities are contacted;
- staff training and periodic drills.

The application may provide a minimal confidential **Request urgent support** entry only when routing and handling policy are approved.

It must not automate investigations or classify allegations.

---

## 4.2 Medical Emergency Procedure

The school must define:

- who provides immediate care;
- contact escalation order;
- when to call emergency services;
- who records the incident;
- who may view medical instructions;
- how guardian acknowledgement is obtained;
- post-incident review.

The application must complement, not delay, telephone or in-person action.

---

## 4.3 Unauthorized Pickup Procedure

The school must define:

- identity-verification standard;
- approved pickup-person process;
- denial and escalation steps;
- incident owner;
- guardian contact sequence;
- emergency authority.

---

## 4.4 Manual Continuity Procedure

Schools need a documented fallback for:

- prolonged internet outage;
- notification provider failure;
- payment provider failure;
- mobile-device loss;
- SchoolOS service outage;
- backup attendance and later reconciliation.

---

# 5. Explicitly Deferred Scope

Do not implement these during controlled-pilot hardening:

1. complete teacher-assignment schema rewrite;
2. full custody and legal-case engine;
3. automated court-order interpretation;
4. automated voice-calling platform;
5. cross-school family federation;
6. live bus GPS tracking;
7. AI summaries and predictive alerts;
8. parent-engagement scoring;
9. general real-time chat;
10. full safeguarding investigation platform;
11. advanced behavioural fraud scoring;
12. device-location tracking;
13. automatic SIM-change trust;
14. every regional language;
15. full voice navigation;
16. broad Stage 3 and Stage 4 expansion;
17. a generic approval engine that duplicates module workflow truth.

---

# 6. Recommended Implementation Sequence

## Wave 0 — Baseline and Change Control

**Purpose:** Freeze the pilot boundary and establish evidence.

- define enabled pilot personas and modules;
- identify existing assignment and guardian data sources;
- inventory all module-specific authorization checks;
- inventory offline caches and queued-write paths;
- document current attendance and notification state machines;
- identify whether payments, pickup, and medical workflows will be enabled;
- create seeded pilot tenants, users, assignments, guardians, students, fees, and notices;
- establish defect severity and release-gate rules.

**Exit criteria:** Signed pilot scope and traceable backlog.

---

## Wave 1 — Authorization and Identity Foundation

Implement in this order:

1. P0-01 Shared Teacher Authorization and Scope Resolver;
2. P0-05 Guardian Capability Permission Model;
3. P0-06 Guardian Administration, Recovery, and Revocation;
4. P0-14 Core Security and Data-Integrity Guarantees.

**Exit criteria**

- one teacher authorization contract;
- one guardian capability contract;
- direct-object denial tests;
- tenant isolation tests;
- admin provisioning and revocation flow;
- protected-file authorization.

---

## Wave 2 — Effective Scope and Offline Revocation

Implement:

1. P0-02 Substitute and Replacement Handover;
2. P0-03 Offline Revocation and Cache Purge;
3. P0-04 Effective-Dated Rosters;
4. P0-07 Wrong-Child Prevention.

**Exit criteria**

- temporary access expires;
- replacement preserves history;
- revoked offline device fails closed;
- transfer/section-change history remains correct;
- high-impact parent actions confirm the child.

---

## Wave 3 — Attendance and Notification Safety

Implement:

1. P0-08 Attendance State and Conflict Model;
2. P0-09 Notification Severity and Acknowledgement;
3. P0-11 Attendance/Leave Correction Cases;
4. P1-03 Principal Attention View.

**Exit criteria**

- no false absence before finalization;
- daily/period/late/leave states remain distinct;
- stale offline attendance cannot overwrite official records;
- parent correction flow works;
- emergency and verified-absence notifications are distinguishable and auditable.

---

## Wave 4 — Privacy, Finance, and Conditional Safety

Implement:

1. P0-10 Shared-Device Privacy;
2. P0-12 Financial Correctness if payments are enabled;
3. P0-13 Emergency/Pickup Safety if those capabilities are enabled;
4. P1-14 Payment Corrections and Privacy;
5. P1-16 Specific Consent.

**Exit criteria**

- shared/lost device test passes;
- payment retry and reconciliation are safe or payment remains disabled;
- pickup/emergency flow passes or remains manual and disabled in-app.

---

## Wave 5 — Pilot Adoption Improvements

Implement the critical portions of:

- P1-01 Parent Dashboard;
- P1-02 Nepali/English usability;
- P1-10 Class-Teacher Coordination;
- P1-12 Communication Routing;
- P1-13 Low-End/Large-Class Performance;
- P1-15 Result Explanation;
- P1-18 Notice Versioning.

**Exit criteria:** Pilot users can understand status, recover from errors, and complete common tasks on supported devices.

---

## Wave 6 — Verification and Pilot Readiness

Execute P0-15 across:

- seeded browser;
- Android;
- iOS;
- multi-user;
- multi-device;
- provider integrations;
- backup/restore;
- operational incident drills.

**Exit criteria:** Controlled-pilot release decision recorded with evidence.

---

# 7. Module Impact Matrix

| Capability | Primary modules | Secondary surfaces |
|---|---|---|
| Teacher scope resolver | Identity/Authorization, Student Information | Attendance, Homework, Marks, Reports, Files, Mobile APIs |
| Temporary assignment/handover | Academic Operations, Timetable | Attendance, Homework, Notifications, Mobile |
| Guardian capabilities | Identity, Student Information | Parent app, Fees, Attendance, Leave, Consent, Pickup |
| Wrong-child prevention | Parent app/API | Payments, Leave, Requests, Consent, Messaging |
| Attendance state/conflicts | M2 Attendance | M12 Notifications, Parent app, Principal view |
| Notification severity | M12 Notifications, M15 Notices | Attendance, Safety, Leave, Fees |
| Shared-device privacy | M0 Identity, Mobile | Parent/Teacher cache, Protected Files |
| Structured requests | Action Centre | Attendance, Fees, Leave, Homework, Complaints |
| Payment safety | Finance/Fees | Parent app, Provider integration, Ledger |
| Principal attention | Principal web | Attendance, Leave, Results, Notices |
| Localization/accessibility | Web/Mobile design systems | All critical pilot screens |
| Verification | QA/Operations | Every enabled module |

---

# 8. Controlled-Pilot Release Gates

## 8.1 Teacher Gate

The pilot must prove:

- teacher sees only assigned classes, sections, subjects, and components;
- teacher writes only within current effective scope;
- class teacher coordinates without editing other subjects;
- temporary responsibility is narrow and expires;
- long-term replacement preserves original authorship;
- revoked assignment fails closed online and offline;
- transferred students do not remain in the active old roster;
- protected files follow the same scope rules.

---

## 8.2 Parent Gate

The pilot must prove:

- parent/guardian sees only linked children;
- guardian capabilities differ correctly;
- temporary and revoked access expires immediately;
- wrong-child actions are prevented;
- shared-device data is protected;
- lost-phone recovery revokes old sessions;
- parent can report attendance and fee errors;
- high-impact actions are auditable.

---

## 8.3 Attendance Gate

The pilot must prove:

- offline drafts synchronize exactly once;
- no absence alert before finalization;
- daily, period, late, leave, and departure states are distinct;
- stale offline replay does not overwrite official data;
- corrections preserve original evidence;
- principal can identify missing submissions;
- multi-user conflicts remain visible.

---

## 8.4 Notification Gate

The pilot must prove:

- critical alerts require acknowledgement;
- queued, provider-accepted, delivered, read, acknowledged, failed, and escalated states are distinct;
- unread and failed states trigger the configured fallback;
- SMS works where enabled;
- no sensitive lock-screen content appears;
- manual telephone procedure is documented and tested.

---

## 8.5 Finance Gate

When digital payments are enabled:

- amount and ledger are backend-owned;
- wrong-child confirmation is enforced;
- retries are idempotent;
- pending verification prevents duplicate payment;
- provider reconciliation works;
- cash corrections and refunds preserve audit history;
- no payment success appears before server confirmation.

Otherwise, digital payment must remain disabled for the pilot.

---

## 8.6 Operations Gate

The pilot must prove:

- tenant isolation;
- authenticated protected files;
- secure sessions and remote revocation;
- backup and restore;
- migrations and seed data;
- browser workflows;
- Android and iOS supported flows;
- monitoring and support runbook;
- incident escalation;
- no unresolved critical or high-severity defect in enabled scope.

---

# 9. Prioritized Implementation Checklist

## P0 Core

- [x] P0-01 Shared Teacher Authorization and Scope Resolver
- [x] P0-02 Temporary Substitute, Replacement, and Handover
- [x] P0-03 Offline Revocation and Cache Purge
- [x] P0-04 Effective-Dated Student Rosters
- [x] P0-05 Guardian Capability Permission Model
- [x] P0-06 Guardian Administration, Recovery, and Revocation
- [x] P0-07 Wrong-Child Prevention
- [ ] P0-08 Attendance State, Finalization, Conflict, and Correction
- [ ] P0-09 Notification Severity, Acknowledgement, and Escalation
- [ ] P0-10 Shared-Device Privacy and Session Security
- [ ] P0-11 Structured Requests and Independent Review
- [ ] P0-14 Core Security and Data-Integrity Guarantees
- [ ] P0-15 Seeded Browser and Real-Device Verification

## Conditional P0

- [ ] P0-12 Financial Correctness before digital payments
- [ ] P0-13 Emergency/Pickup Safety before app-based safety workflows
- [ ] P1-05 Shared Teaching Components before practical/+2 rollout
- [ ] P1-13 Large-Class Performance before high-enrolment/+2 rollout
- [ ] P1-19 Multigrade Support before a multigrade-school pilot

## P1

- [ ] P1-01 Parent Dashboard Reordering
- [ ] P1-02 Nepali and English Critical-Screen Usability
- [x] P1-03 Principal Attention View (local PARTIAL — see evidence register)
- [ ] P1-04 Timetable and Substitute Coordination
- [ ] P1-05 Shared Teaching and Subject Components
- [ ] P1-06 Attendance Presentation
- [ ] P1-07 Lesson Diary and Closure Replanning
- [ ] P1-08 Homework Workload and Publication Safety
- [ ] P1-09 Exam Duties and Assessment Exceptions
- [ ] P1-10 Class-Teacher Coordination Dashboard
- [ ] P1-11 Teacher Observation Visibility
- [ ] P1-12 Communication Hours and Routing
- [ ] P1-13 Low-End Device and Large-Class Performance
- [ ] P1-14 Payment Corrections and Financial Privacy
- [ ] P1-15 Result Explanation and Correction History
- [ ] P1-16 Specific Digital Consent
- [ ] P1-17 Parent Meeting Access
- [ ] P1-18 Official Notice Versioning
- [ ] P1-19 Multigrade Classroom Support
- [ ] P1-20 Complaint and Investigation Separation

## P2

- [ ] P2-01 Club/House/Sports Coordination
- [ ] P2-02 Field Trip and Event Duty
- [ ] P2-03 Teacher Mentoring
- [ ] P2-04 Multi-Branch Teacher Context
- [ ] P2-05 Academic-Year Transition
- [ ] P2-06 IEMIS/NEB Export Handoff
- [ ] P2-07 Hostel Parent Summary
- [ ] P2-08 Cross-School Family Aggregation
- [ ] P2-09 Transport Delay and Route Change
- [ ] P2-10 Disability and Special-Support Plans
- [ ] P2-11 Deeper Parent Accessibility
- [ ] P2-12 Wider Communication Categories
- [ ] P2-13 Generic Approval Adapter
- [ ] P2-14 Advanced Learning and Institutional Workflows

---

# 10. Complete Scenario Coverage Map

This section confirms that the source teacher and parent scenarios are included in the consolidated backlog.

## 10.1 Teacher Scenario Mapping

| ID | Teacher scenario | Consolidated implementation |
|---|---|---|
| T01 | Sudden absence and substitute coverage | P0-01, P0-02, P1-04 |
| T02 | Long-term replacement and handover | P0-02, P0-03 |
| T03 | Multiple concurrent responsibilities | P0-01 |
| T04 | Assistant/shared subject teaching | P1-05; Conditional P0 for practical/+2 |
| T05 | Daily versus period attendance conflict | P0-08, P1-06 |
| T06 | Offline teacher versus finalized record | P0-08 |
| T07 | Assignment removed while offline | P0-03 |
| T08 | Mid-term join/transfer/section change | P0-04 |
| T09 | Parent disputes teacher record | P0-11, P1-20 |
| T10 | Medical emergency during class | P0-13, Policy 4.2 |
| T11 | Multigrade classroom | P1-19 |
| T12 | Closure/strike/weather disruption | P1-07, P0-09 |
| T13 | Lesson diary and actual coverage | P1-07 |
| T14 | Homework overload | P1-08, P1-10 |
| T15 | Late homework/broken attachment | P1-08 |
| T16 | Coordinator/invigilator/marker separation | P1-09, P0-01 |
| T17 | Absent/exempt/make-up assessment | P1-09 |
| T18 | Timetable changes from leave/training/duty | P1-04 |
| T19 | Parent contacts wrong teacher/outside hours | P1-12 |
| T20 | Low-end phone/classroom limitations | P1-13, P1-02 |
| T21 | 60–80-student class | P1-13 |
| T22 | Class-teacher coordination without editing | P1-10, P0-01 |
| T23 | Private observation versus parent remark | P1-11 |
| T24 | Teacher complaint/investigation | P1-20 |
| T25 | Club/house/sports coordinator | P2-01 |
| T26 | Field trip/event duty | P2-02, P0-13 |
| T27 | Mentoring without surveillance | P2-03 |
| T28 | Teacher across branches | P2-04 |
| T29 | Academic-year/term transition | P2-05, P0-04 |
| T30 | IEMIS/NEB handoff | P2-06 |

---

## 10.2 Parent Scenario Mapping

| ID | Parent scenario | Consolidated implementation |
|---|---|---|
| G01 | Overseas parent and local guardian | P0-05, P0-06, P0-09 |
| G02 | Grandparent as main guardian | P0-05, P1-02, P2-11 |
| G03 | Multiple guardians with different duties | P0-05 |
| G04 | Separated/divorced parents | P0-05, P0-06 |
| G05 | Temporary guardian | P0-05, P0-06 |
| G06 | Immediate guardian revocation | P0-06, P0-10 |
| G07 | Shared family smartphone | P0-10 |
| G08 | Lost phone/SIM/number change | P0-06, P0-10 |
| G09 | Wrong child selected | P0-07 |
| G10 | Attendance not finalized | P0-08, P0-09 |
| G11 | Incorrect absence alert | P0-08, P0-11 |
| G12 | Late arrival/early departure | P0-08 |
| G13 | Medical emergency | P0-13, P0-09 |
| G14 | Primary emergency contact unreachable | P0-13, P0-09 |
| G15 | Unauthorized pickup attempt | P0-13, Policy 4.3 |
| G16 | Payment deducted but app shows failure | P0-12 |
| G17 | Duplicate payment | P0-12 |
| G18 | Missing cash payment | P1-14, P0-11 |
| G19 | Cannot pay on time | P1-14 |
| G20 | Missing scholarship/discount | P1-14 |
| G21 | Parent request while offline | P0-11, P0-15 |
| G22 | Duplicate request from slow internet | P0-11 |
| G23 | Parent contacts wrong teacher | P1-12 |
| G24 | Teacher misses response window | P1-12 |
| G25 | Messages outside school hours | P1-12 |
| G26 | Conflicting notices | P1-18 |
| G27 | Critical notice unread | P0-09 |
| G28 | Sensitive lock-screen notification | P0-10, P0-09 |
| G29 | Parent does not understand grades | P1-15, P1-02 |
| G30 | Marks corrected after publication | P1-15, P0-11 |
| G31 | Missing/corrupted homework attachment | P1-08 |
| G32 | Parent disagrees with teacher decision | P0-11, P1-20 |
| G33 | Digital trip/activity consent | P1-16 |
| G34 | Parent cannot attend meeting | P1-17 |
| G35 | Hostel student | P2-07 |
| G36 | Children in different schools/branches | P2-08 |
| G37 | Bus delay/route change | P2-09 |
| G38 | Disability/special support | P2-10 |
| G39 | Bullying/wellbeing concern | Policy 4.1, P1-20 |
| G40 | Deceased parent account | P0-06 |

---

# 11. Definition of Done for Each Backlog Item

An item is not complete until all applicable conditions are met:

- [ ] backend authorization and validation implemented;
- [ ] web UI implemented;
- [ ] mobile UI implemented where the role uses mobile;
- [ ] loading, empty, error, stale, offline, and conflict states implemented;
- [ ] audit event defined;
- [ ] protected-file behaviour verified;
- [ ] accessibility and localization strings included;
- [ ] unit tests pass;
- [ ] integration tests pass;
- [ ] authorization-negative tests pass;
- [ ] idempotency/concurrency tests pass where applicable;
- [ ] seeded browser test passes;
- [ ] real-device test passes;
- [ ] operational runbook updated;
- [ ] support and recovery procedure documented;
- [ ] rollback or feature-disable path exists;
- [ ] acceptance evidence linked;
- [ ] no unresolved blocker defect.

---

# 12. Final Implementation Order

The recommended order is:

1. **Shared Teacher Authorization and Scope Resolver**
2. **Guardian Capability Model**
3. **Guardian Administration, Recovery, and Revocation**
4. **Core Security and Data-Integrity Regression Tests**
5. **Substitute, Replacement, and Effective-Dated Assignment Handling**
6. **Offline Revocation and Cache Purge**
7. **Effective-Dated Student Roster Membership**
8. **Wrong-Child Prevention**
9. **Attendance Finalization, Conflict, Leave, and Correction**
10. **Notification Severity, Acknowledgement, and Escalation**
11. **Shared-Device Privacy and Session Security**
12. **Structured Attendance, Fee, and Leave Requests**
13. **Conditional Payment Safety**
14. **Conditional Medical Emergency and Pickup Safety**
15. **Principal Attention View**
16. **Critical Nepali/English Usability**
17. **Low-End Device and Large-Class Optimization**
18. **Seeded Browser, Multi-User, Android, and iOS Verification**
19. **Controlled Pilot**
20. **P1 completion based on pilot evidence**
21. **P2 only after pilot findings are resolved**

---

# 13. Final Release Boundary

A controlled pilot may proceed only when SchoolOS can demonstrate:

> Teachers act only within current assignments; guardians act only for linked children and permitted capabilities; important parent actions cannot target the wrong child; attendance alerts are based on finalized evidence; offline data cannot overwrite official records; critical alerts have acknowledgement and fallback; shared devices do not expose sensitive data; money remains backend-owned and idempotent; and every enabled workflow has seeded browser and supported real-device evidence.

The product direction is therefore:

> **Harden identity, assignment scope, guardian permissions, child context, attendance safety, notifications, financial correctness, and device privacy. Validate the existing product under realistic multi-user and offline conditions. Do not broaden SchoolOS until the controlled pilot proves these foundations.**

---

# 14. Implementation Progress Record

This section is the in-repository progress record required by this roadmap. It
records code and verification evidence only; it does not replace GitHub issue
tracking, CI artifacts, staging records, device evidence, or release-owner
approval.

## 14.1 Baseline and change control

| Field | Baseline |
|---|---|
| Inventory date | 2026-07-28 |
| Checkout inspected | `main` at `6a1cd7603fb55dba864560604bf7745c72a8c4c2` |
| Worktree before inventory | Clean |
| Release stage | GA program Wave 0 — Internal QA ready (local); staging validation in progress |
| Active implementation wave | Wave 0 (foundation + cross-cutting P0) |
| Priority rule | Complete or explicitly disable applicable P0 gates before P1; do not begin P2 |
| Progress-document rule | Maintain this section in place; do not create a competing roadmap or progress Markdown file |
| GA scope (owner 2026-07-29) | M0–M12 + M15 + M13 (Wave 5); M14 deferred; first production target = one school (Wave 1) |

### GA wave module enablement matrix

Modules ship in waves. Do not enable entitlements on production school #1 until that wave's exit gate passes.

| Wave | Modules | Production enablement |
|---|---|---|
| Wave 0 | Platform P0, staging, ops | Infrastructure only |
| Wave 1 | M0, M1, M2, M5, M6, M12, M15 | Core daily workflows for school #1 |
| Wave 2 | M3 full fees + digital payments | After financial integrity evidence |
| Wave 3 | M4 exams, CAS, report cards, promotion | After academic cycle evidence |
| Wave 4 | M7, M8, M9, M10, M11 | Per-module staging/device evidence; M7 payroll blocked until Nepal statutory verification |
| Wave 5 | M13 Learning | After security review + `smoke:learning` |
| Wave 6 | Multi-school platform onboarding | Full GA sign-off |

### Wave 1 core GA boundary (first production school)

The first production school (Wave 1) uses Grade 1–10 or Grade 1–12 personas:

- school administrator, principal/head teacher, teacher, parent/guardian;
- admission and guardian linking;
- enrollment, class/section, teacher assignment, and timetable;
- attendance capture, finalization, correction, conflict review, and parent alert;
- homework and published notices;
- structured parent requests and Principal Attention;
- web operations plus purpose-limited Parent and Teacher mobile workflows.

Wave 2–5 modules remain **disabled** on school #1 until each wave's exit gate passes.

### Deferred or wave-gated capabilities

| Capability | Decision | Re-enable condition |
|---|---|---|
| Real digital payments | Wave 2 (M3) | P0-12 and provider/reconciliation evidence pass |
| Full exams/report cards/promotion | Wave 3 (M4) | DEF-03 staging verification + academic E2E |
| HR/payroll/library/transport/canteen/accounting | Wave 4 | Per-module staging + device evidence; M7 payroll needs CA sign-off |
| M13 Learning | Wave 5 | Owner unfreeze + security review + `smoke:learning` |
| M14 Intelligence / AI | Deferred | Separate post-GA approval |
| App-based medical emergency workflow | Manual until P0-13 | P0-13 + notification fallback + device evidence |
| Digital pickup authorization | Not in active product scope | Explicit owner re-approval |
| Multigrade / very large classes | Wave 1+ evidence | P1-13/P1-19 when applicable school selected |
| P2 capabilities | After Wave 1 GA | All applicable P0 gates pass for enabled modules |

## 14.2 Wave 0 source inventory

| Area | Current sources of truth | Baseline finding |
|---|---|---|
| Teacher authority | `TeacherAssignment`, `TeacherDelegation`, `TeacherScopeService` | Canonical resolver exists with effective dates, component scope, capability rules, audit, and negative tests |
| Legacy teacher compatibility | `Section.classTeacherId`, `SubjectTeacherAssignment`, `TimetableSubstitution` | Enabled pilot teacher authorization now reads the canonical resolver; legacy rows remain only for compatibility writes, frozen M13, module-disabled improvement surfaces, and removed Chat compatibility/retention paths |
| Guardian access | `Guardian`, `StudentGuardian`, `GuardianIdentityVerification` | Linked-child and identity foundations exist, but per-relationship capabilities, state, effective dates, recovery/session revocation, and restriction history are missing |
| Student roster | `Enrollment` plus current student class/section fields | No complete effective-start/end roster history was verified |
| Attendance | `AttendanceSession`, `AttendanceRecord`, `AttendanceDraft`, `AttendanceSyncSubmission`, `AttendanceConflict`, correction requests | Idempotency/conflict foundations exist; required state vocabulary, finalization/cutoff semantics, leave reconciliation, period/departure distinctions, and full multi-user evidence remain incomplete |
| Notification delivery | `NotificationEvent`, `NotificationDelivery`, read receipts, mobile push tokens | Queued/sent/delivered/failed/read foundations exist; provider-accepted, acknowledged, expired, escalated, severity/fallback policy, and provider evidence are incomplete |
| Structured requests | `SchoolServiceRequest`, notes, attachments | Child-linked, idempotent, assigned, deadline, escalation, resolution, close, and reopen foundations exist; capability enforcement and independent-review coverage remain incomplete |
| Offline/private mobile data | `PrivateReadCache`, parent dashboard snapshot store, teacher attendance draft store | Safe-read and attendance-draft foundations exist; relationship/assignment-version invalidation and proven secure purge after revocation are incomplete |
| Sessions/devices | Refresh-token/session handling, secure mobile storage, mobile push installations | Logout/session foundations exist; active-device management, remote revocation UX, re-authentication boundaries, and lost/shared-device evidence remain incomplete |
| Conditional payments | Backend payment/idempotency/provider-readiness code | Keep disabled until P0-12 evidence passes |
| Verification | Local schema/OpenAPI/unit/e2e gates and pilot smoke scripts | Local gates exist; seeded authenticated browser, real Android/iOS, provider, backup/restore, and incident-drill evidence are not established |

## 14.3 P0 and conditional-P0 register

Status values in this register are conservative. `Implemented-unverified` and
`Partial` are not completion states.

| ID | Previous status | Gap or root cause found | Current evidence and limitations | Release decision |
|---|---|---|---|---|
| P0-01 | Development complete; locally verified | Enabled pilot paths previously re-derived teacher authority from legacy assignment sources | Canonical resolver adoption, stable `TEACHER_SCOPE_DENIED`, direct-object/protected-file negative coverage, full API regression, typechecks, and mobile regression pass locally; seeded browser/device proof remains part of P0-15 | Proceed to P0-05; do not treat local evidence as pilot validation |
| P0-02 | Development complete; locally verified | Create-and-assign previously marked substitutions ASSIGNED without creating a TeacherDelegation; long-term replacement/handover domain was missing | Linked-delegation create/assign/cancel/complete, TeacherReplacement cutover with authorship preservation, pending-work dispositions, handover notes, coordinator web workspace, and focused unit tests pass locally (`docs/production/evidence/p0-02-substitute-replacement-2026-07-31-local.md`); offline cache purge and device revocation remain P0-03; browser/device evidence remains P0-15 | Proceed to P0-03; do not treat local evidence as pilot validation |
| P0-03 | Development complete; locally verified | Scope version previously ignored revoked rows; UNASSIGNED sync rejections did not always purge private caches | Monotonic scope version includes revoked/expired rows; UNASSIGNED sync maps to `TEACHER_SCOPE_DENIED` and clears access-scoped caches (`docs/production/evidence/p0-03-offline-revocation-2026-07-31-local.md`); push-topic and offline-during-revocation device proof remain P0-15 | Proceed to P0-04; do not treat local evidence as pilot validation |
| P0-04 | Development complete; locally verified | `Enrollment` had status and admission date but no effective end/history model for mid-term section changes | Effective-dated enrollment segments, placement cutover, transfer/exit stamping, migration/backfill, and focused student update tests pass locally (`docs/production/evidence/p0-04-effective-dated-rosters-2026-07-31-local.md`); browser/device matrix remains P0-15 | Proceed to P0-07; do not treat local evidence as pilot validation |
| P0-05 | Development complete; locally verified | Linked-child checks previously treated every guardian as equally authorized and the parent system role retained a broad student-directory permission | Persisted capability/state/effective-date/approval/restriction/priority contract, audited relationship writes, stable `GUARDIAN_CAPABILITY_DENIED`, capability-scoped backend/mobile summaries and files, fail-closed Flutter navigation, migration backfill, full API/mobile regression, schema/OpenAPI/typechecks, and expiry/revocation-at-next-request tests pass locally; offline cache purge, admin/session revocation, browser/device, and staging evidence remain under P0-03, P0-06, and P0-15 | Proceed to P0-06; do not treat local evidence as pilot validation |
| P0-06 | Development complete; locally verified | Guardian identity and link foundations previously lacked one evidence-backed recovery, account-provisioning, session-revocation, compromise-hold, and relationship-lifecycle workflow | Purpose-limited administration APIs and web UX now require verified recovery proof, reason, evidence reference, confirmation, and permission gates; parent-only provisioning is transactional with forced first password change; safe session metadata, selected/all-session revocation, phone recovery, suspend/restore/expire/revoke/deceased transitions, preserved history, cross-tenant denial, and full API regression pass locally; policy-controlled other-guardian notification, authenticated browser/device, and staging evidence remain | Proceed to P0-14; do not treat local evidence as pilot validation |
| P0-07 | Development complete; locally verified | Server confirmation helpers existed, but mobile high-impact payloads omitted `confirmStudentId` | Payment, sandbox payment/top-up, service-request, and consent decision payloads send confirmation; consent UI names the selected child; contract tests cover mismatch (`docs/production/evidence/p0-07-wrong-child-prevention-2026-07-31-local.md`); browser/device multi-child proof remains P0-15 | Proceed to Wave 3 P0-08; do not treat local evidence as pilot validation |
| P0-08 | Development complete for local parent-finalization, correction-independence, status vocabulary, and student-leave auto-link slices; residual gaps remain | Parents previously could see/dispute unsubmitted drafts; original marker could review corrections; departure/period statuses missing; approved leave did not inform attendance | Parent-facing queries/corrections require submitted sessions; independent reviewer enforcement; status vocabulary + migrations; student leave requests auto-inform roster/submit and stamp drafts on approve (`docs/production/evidence/p0-08-attendance-state-conflict-2026-07-31-local.md`, `docs/production/evidence/p0-08-student-leave-auto-link-2026-07-31-local.md`); full conflict evidence matrix and multi-user/offline browser-device proof remain | Proceed to Wave 3 P0-09; do not treat local evidence as pilot validation |
| P0-09 | Development complete for local severity distinguishability + delivery honesty slice; residual gaps remain | Absence alerts were IMPORTANT (not Urgent); emergency notices stayed in opt-outable NOTICE category; center payloads lacked severity/honest delivery labels; P0-08 departure statuses could fail event accept | Verified absence → CRITICAL + distinct copy; emergency → notice_emergency/EMERGENCY mandatory category; center exposes priority/severity/deliveryState; departure statuses accepted (`docs/production/evidence/p0-09-notification-severity-2026-07-31-local.md`); provider-accepted/escalated/expired/fallback automation and provider evidence remain | Proceed to Wave 3 P0-11; do not treat local evidence as pilot validation |
| P0-10 | Partial | Secure storage, logout handling, private read cache, and protected downloads exist | Active device list, remote revocation, re-auth, cache encryption/invalidation, screenshot policy, and shared/lost-device evidence remain | Block sensitive mobile workflows |
| P0-11 | Development complete for local independent-resolve / escalate-reassign / category-capability / dedup slice; residual gaps remain | Service-request resolve allowed assigned first responder; escalate did not reassign; category not capability-gated; general complaints lacked active-case dedup; create idempotency races could 500 | Independent resolve + escalate reassignment + category capability + child/category dedup + P2002 idempotent replay (`docs/production/evidence/p0-11-structured-requests-2026-07-31-local.md`); dedicated homework/urgent types, parent note API, web Action Centre, and browser/device evidence remain | Wave 3 P1-03 local slice landed; residual Action Centre / browser-device gates remain |
| P0-12 | Implemented-unverified conditional foundation | Payment and provider-readiness code exists, but provider reconciliation and release evidence are not established | Sandbox/local tests are not payment-provider proof | Keep real digital payments disabled |
| P0-13 | Disabled conditional capability | Emergency contact data exists, but app-based medical escalation is not pilot-approved; digital pickup is outside active product scope | Manual school procedures still require approval and drill evidence | Keep app workflows disabled |
| P0-14 | Partial; local hardening + clean migration replay verified | Production rate limiting was not fail-closed, sensitive guardian commands lacked route-specific throttles, revoked guardian links remained visible as file-capable in the M1 ownership audit, notification dev-log mode exposed message payloads, configured outbound provider URLs allowed private-network targets, and one platform export path opened a signed storage URL directly | Production configuration requires rate limiting; StudentsController and M1 guardian-removal routes carry 10/min throttles; ownership audit uses active verified approved in-window relationships; notification dev logs are metadata-only; outbound provider URLs reject non-public HTTPS literals/redirects; platform exports use authenticated protected-file download; empty-DB replay of all 89 migrations and `migrate status` pass locally (`docs/production/evidence/p0-14-security-2026-07-31-local.md`); repository security scan seal, staging secrets/provider checks, and staging/pilot backup-restore drill remain incomplete | Block pilot release; do not advance beyond Wave 1 |
| P0-15 | Not established | Local tests and smoke scripts do not establish seeded staging/browser/device/provider/restore/incident evidence | No current evidence proves the complete matrix or absence of severity-1/2 defects | Block pilot release |
| P1-05 conditional P0 | Partial and disabled | Component scopes exist, but shared/practical authoring and concurrency evidence are incomplete | Not applicable while +2/practical pilot is disabled | Keep disabled |
| P1-13 conditional P0 | Partial and excluded | Low-end UI patterns exist, but representative large-roster performance/device evidence is incomplete | Not applicable while 60-80 student classes/+2 are excluded | Keep excluded |
| P1-19 conditional P0 | Missing and disabled | No verified multigrade roster/workload model | Not applicable to initial pilot boundary | Keep disabled |

## 14.4 P1 register

| ID | Previous status | Gap or root cause found | Current limitation | Release decision |
|---|---|---|---|---|
| P1-01 | Implemented-unverified | Parent home and prioritization code exists | Must be rechecked after guardian capability and notification severity contracts | Wait for applicable P0 |
| P1-02 | Partial | English-first critical screens and shared UI foundations exist | Complete critical Nepali copy, accessibility, offline wording, and device evidence only after P0 contracts stabilize | Wait |
| P1-03 | Development complete for local consolidated queues + owning-module drill-through; residual gaps remain | Web missing result-correction attention; mobile Attention omitted pending leave and included non-HIGH parent cases; Flutter only drilled into service-request routes | Pending leave, attendance/result corrections, urgent notices, missing attendance on web+mobile; HIGH/overdue parent cases on mobile with `/principal/...` drill-through (`docs/production/evidence/p1-03-principal-attention-2026-07-31-local.md`); web Action Centre for parent cases and browser/device proof remain | Proceed to Wave 3 residual gates / Wave 4; do not treat local evidence as pilot validation |
| P1-04 | Partial | Timetable substitution foundations exist | Leave/duty integration, eligible suggestion, temporary scope creation/expiry, and class-occurred evidence remain | Wait for P0-01/P0-02 |
| P1-05 | Partial | Component scope data exists | Shared authorship, reviewer/publisher separation, concurrency, and practical/+2 evidence remain | Disabled for initial pilot |
| P1-06 | Partial | Daily attendance presentation exists | Period, arrival/departure, leave, and parent-safe derived presentation are incomplete | Wait for P0-08 |
| P1-07 | Unverified | Curriculum/lesson and institutional-improvement surfaces exist | Roadmap-specific diary, disruption, and closure-replanning behavior is not verified | Do not start before P0 |
| P1-08 | Partial | Homework lifecycle and attachment checks exist | Cross-subject workload, publication-time safety, deadline correction, and version evidence remain | Wait for P0-01 |
| P1-09 | Partial | Exam, marks, component, lock, and correction foundations exist | Duty separation and complete zero/absent/exempt/not-assessed/withheld/make-up vocabulary remain | Wait for P0-01 |
| P1-10 | Partial | Homeroom summary/coordination foundations exist | Missing complete workload, follow-up, meeting, correction, and no-cross-subject-write evidence | Wait for P0-01 |
| P1-11 | Unverified | Observation/milestone data exists | Visibility classes and accidental-publication prevention are not established | Do not start before P0 |
| P1-12 | Partial | Structured requests have routing/deadlines/escalation foundations | Communication hours, category routing, SLA, abuse controls, and no-phone-exposure evidence remain | Wait for P0-11 |
| P1-13 | Partial | Mobile low-bandwidth patterns and attendance shortcuts exist | Low-end Android and representative large-class performance evidence remain | Excluded until verified |
| P1-14 | Partial conditional | Finance correction/request foundations exist | Payment dispute privacy, reminder pause, statement correction, and provider evidence remain | Keep digital payments disabled |
| P1-15 | Partial | Published results/report-card and correction foundations exist | Plain explanation, distinction vocabulary, history presentation, and regeneration evidence remain | Wait for P0-01/P0-11 |
| P1-16 | Partial | Guardian consent capture/revoke exists | Purpose-specific contract, re-authentication, child confirmation, and sensitive-consent evidence remain | Wait for P0-05/P0-10 |
| P1-17 | Unverified | Meeting/calendar foundations may exist | Parent booking, alternate guardian, summary, owner, and follow-up evidence not verified | Do not start before P0 |
| P1-18 | Unverified/partial | Notice lifecycle and acknowledgement exist | Explicit replacement/version relationship and significant-change acknowledgement are not established | Wait for P0-09 |
| P1-19 | Missing conditional | No verified multigrade model | Not applicable to initial pilot | Keep disabled |
| P1-20 | Partial | Service requests provide restricted notes and escalation foundations | Complaint/safeguarding separation, conflict-of-interest routing, protected evidence, and approved policy remain | Keep full investigation workflow disabled |

## 14.5 P2 register

Every P2 item is outside the implementation boundary while any applicable P0
gate is incomplete or unverified.

| ID | Previous status | Gap or root cause found | Current evidence | Release decision |
|---|---|---|---|---|
| P2-01 | Deferred | Post-pilot activity breadth | Not inventoried for pilot completion | Do not implement |
| P2-02 | Deferred | Depends on consent/emergency policy and temporary duty scope | Not inventoried for pilot completion | Do not implement |
| P2-03 | Deferred and disabled | Requires privacy-preserving mentoring design | Teacher-development and learning-improvement routes are hidden from active web/mobile navigation; backend improvement APIs fail closed behind the disabled `learning` entitlement; retained data/source is unchanged | Do not implement |
| P2-04 | Deferred | Requires branch context and leakage controls | Not inventoried for pilot completion | Do not implement |
| P2-05 | Deferred | Requires proven effective-dated core models first | Not inventoried for pilot completion | Do not implement |
| P2-06 | Deferred | Requires validated export contract and external handoff evidence | Not inventoried for pilot completion | Do not implement |
| P2-07 | Deferred | Requires hostel policy and restricted summary design | Not inventoried for pilot completion | Do not implement |
| P2-08 | Deferred | Conflicts with current single-tenant family boundary | Not inventoried for pilot completion | Do not implement |
| P2-09 | Deferred | Requires provider/load/privacy validation | Not inventoried for pilot completion | Do not implement |
| P2-10 | Deferred | Requires restricted accommodation-plan design and policy | Not inventoried for pilot completion | Do not implement |
| P2-11 | Deferred | Follows critical-screen bilingual/accessibility work | Not inventoried for pilot completion | Do not implement |
| P2-12 | Deferred | Core request categories must stabilize first | Not inventoried for pilot completion | Do not implement |
| P2-13 | Deferred | Would risk duplicating owning-module workflow truth | Not inventoried for pilot completion | Do not implement |
| P2-14 | Deferred and disabled | Depends on post-pilot data quality and explicit scope approval | Institutional/learning-improvement routes fail closed behind the disabled `learning` entitlement; active web/mobile entry points are hidden; M13 data/source remains frozen and M14 remains deferred | Do not implement |

## 14.6 Detailed evidence log

### P0-01 — Wave 0 baseline

- **Previous implementation status:** Partial.
- **Problem or gap:** The canonical `TeacherScopeService` is not yet the only
  assignment authority used by teacher-facing modules and protected files.
- **Root cause:** The compatibility migration added canonical
  `TeacherAssignment`/`TeacherDelegation` records while retaining legacy
  assignment reads; module adoption was not completed across the full P0-01
  surface.
- **Implementation files changed:** None in the baseline batch.
- **Migrations added:** None in the baseline batch.
- **Tests added or updated:** None in the baseline batch.
- **Commands executed:**
  - `pnpm db:validate`
  - `pnpm verify:openapi`
  - `pnpm --filter @schoolos/api exec jest src/teacher-scope/teacher-scope.service.spec.ts --runInBand`
  - `pnpm --filter @schoolos/api exec jest --config ./test/jest-e2e.json test/teacher-scope-authorization.e2e-spec.ts --runInBand`
- **Browser/device scenarios tested:** None in the baseline batch.
- **Result:** Prisma schema valid; OpenAPI gate passed; 29 focused unit tests
  passed; 17 focused authorization E2E tests passed.
- **Remaining limitations:** Legacy consumers, direct-object and protected-file
  adoption, stable denial-code contract, browser/device evidence, and
  cross-module negative coverage remain.
- **Release decision:** P0-01 remains blocked; proceed next with the smallest
  cross-module canonicalization batch.

### P0-01 — Wave 1 canonicalization and local closure

- **Previous implementation status:** Partial.
- **Problem or gap:** Enabled teacher-facing services could reach the same
  class, section, subject, component, student, or protected file through
  different legacy authorization checks, with inconsistent denial behavior.
- **Root cause:** The compatibility migration established
  `TeacherAssignment`, `TeacherDelegation`, and `TeacherScopeService`, but did
  not move every enabled consumer to that single authority.
- **Implementation completed:**
  - extended the canonical resolver with actor-level exact and any-section
    checks, capability-filtered assignment listing, and the stable
    `TEACHER_SCOPE_DENIED` contract;
  - migrated enabled student directory/profile/IEMIS/QR, attendance, homework,
    timetable, activity, notice/event visibility, reports, sections,
    operational summary, teacher-today, assessment retake, academic subject
    catalog, and protected student/homework file paths;
  - required exact section scope for new academic teacher assignments and
    dual-wrote the legacy row only as a compatibility bridge;
  - preserved frozen M13 and removed Chat data/source while keeping both out of
    active pilot authorization claims;
  - failed closed module-disabled learning/institutional-improvement APIs
    behind the disabled `learning` entitlement and hid their web/mobile entry
    points.
- **Implementation files changed:** Focused API services/modules/specs under
  `teacher-scope`, `academics`, `students`, `attendance`, `homework`,
  `timetable`, `activity-feed`, `communications`, `reports`, `sections`,
  `file-registry`, `teacher-workspace`, and `operational-summary`; the existing
  web/mobile navigation and academic assignment form; this roadmap.
- **Migrations added:** None. Persisted legacy names and data remain intact.
- **Tests added or updated:** Canonical resolver capability and delegation
  coverage; module-level allowed/denied scope tests; protected-file and
  direct-object E2E fixtures; stale legacy-authorization fixtures replaced
  with the canonical contract.
- **Commands executed:**
  - `pnpm db:validate`
  - `pnpm verify:openapi`
  - `pnpm --filter @schoolos/api exec jest --runInBand`
  - `pnpm --filter @schoolos/api exec jest --config ./test/jest-e2e.json test/teacher-scope-authorization.e2e-spec.ts test/activity-media-privacy-integration.e2e-spec.ts test/student-documents-registry.e2e-spec.ts test/activity-hardening.spec.ts --runInBand`
  - `pnpm --filter @schoolos/api typecheck`
  - `pnpm --filter @schoolos/web typecheck`
  - `dart format` on the three touched Flutter files
  - `flutter analyze`
  - `flutter test`
- **Browser/device scenarios tested:** Flutter widget/unit regression only; no
  real Android, iOS, or authenticated browser scenario was executed in this
  batch.
- **Result:** Prisma and OpenAPI gates passed; 224 API suites / 2,153 tests
  passed; selected authorization E2E passed 3 suites / 27 tests; API and web
  typechecks passed; Flutter analysis reported zero issues and all 509 Flutter
  tests passed.
- **Remaining limitations:** Seeded authenticated browser, real-device,
  multi-user, offline-revocation, and pilot evidence remain governed by P0-03
  and P0-15. Legacy reads remain only in frozen M13, disabled
  learning-improvement, and removed Chat compatibility/retention paths.
- **Release decision:** P0-01 is development complete with reproducible local
  evidence. Proceed to P0-05. This does not advance the release stage beyond
  Internal QA / controlled-pilot preparation.

### P0-01 — Wave 2 capability contract, RESULT_REVIEW, audit, and mobile access-changed

- **Previous implementation status:** Development complete locally after Wave 1;
  remaining gaps were capability-name equivalence documentation, result preview
  capability precision, authorization denial audit helpers, missing-tenant job
  proof, and mobile access-changed cache invalidation.
- **Root cause:** Wave 1 closed teacher-scope adoption for enabled modules but
  left result previews on class/section combo lists, had no single P0-01
  capability contract map, and treated mobile revocation as next-request /
  logout cleanup without an explicit access-changed purge path.
- **Implementation completed:**
  - added `TeacherCapability.RESULT_REVIEW` and enforced it in `ResultsService`;
  - added `p0-01-capability-contract` mapping required names onto existing
    TeacherCapability / RBAC / FileRegistry surfaces without duplicating names;
  - added `authorization-audit` helpers and wired guardian denial audits on
    attendance and student-QR parent paths;
  - extended missing-tenant `runTenantScopedJob` fail-closed coverage;
  - mobile access-changed codes clear private caches, prune unlinked child
    caches, discard unauthorized attendance drafts, and show a controlled
    access-changed parent state.
- **Migrations added:** None.
- **Evidence document:**
  `docs/production/evidence/p0-01-authorization-2026-07-31-local.md`
- **Release decision:** Local hardening closed for this slice. Staging browser /
  device / controlled-pilot evidence remain governed by P0-03 and P0-15. Do not
  treat local evidence as pilot validation.

### P0-05 — Guardian capability contract and local closure

- **Previous implementation status:** Missing.
- **Problem or gap:** Any active `StudentGuardian` link effectively granted the
  same linked-child visibility, while the parent system role also retained a
  broad student-directory permission. The persisted relationship had no
  capability, verification, approval, lifecycle, effective-date, emergency
  priority, or restriction contract.
- **Root cause:** Guardian identity verification and child linking had been
  implemented as separate foundations, but relationship-specific authority
  was never made the single backend contract or propagated to the parent
  client.
- **Implementation completed:**
  - added the ten roadmap capabilities plus relationship verification,
    lifecycle, approval, effective start/end, emergency priority,
    restriction-reference, approval evidence, and update metadata to
    `StudentGuardian`;
  - added one central active-relationship resolver with the stable
    `GUARDIAN_CAPABILITY_DENIED` envelope and request-time tenant, user, child,
    verification, approval, lifecycle, effective-date, and capability checks;
  - removed `students:read` from the parent system role so parent access uses
    purpose-limited APIs instead of the administrative student directory;
  - applied capability scope to attendance, academics, homework, timetable,
    activity/media, fees/payments/receipts, library, transport, consent,
    complaints/corrections, student QR/files, parent action-centre and weekly
    progress sources, and the aggregate operational summary;
  - updated student-guardian writes to validate effective windows, require a
    restriction reference when authority is restricted, retain primary-link
    safety, record approval evidence, and audit before/after state;
  - exposed relationship capability/state metadata to Flutter, preserved it
    in the encrypted parent snapshot, skipped unauthorized reads, disabled
    unavailable navigation, and used honest locked states instead of false
    zeroes;
  - kept digital pickup outside the active pilot and corrected fee copy from
    `Pay fees` to `Fees & receipts` so `FEES_VIEW` does not imply `FEES_PAY`.
- **Implementation files changed:** Focused Prisma schema/migration and core
  student/permission contracts; the shared parent-scope resolver; enabled
  parent-facing API services/specs under students, mobile, attendance,
  activity, homework, timetable, finance, library, transport, consent,
  service requests, files, communications, canteen, and operational summary;
  focused Flutter parent models, repository/cache, dashboard/homework/more
  presentation, tests, and goldens; this roadmap.
- **Migrations added:**
  `20260728130000_guardian_capability_contract`, including compatibility
  backfill for existing links. Existing guardians retain their prior access
  except pickup; new links default to no capabilities, unverified, and pending
  approval.
- **Tests added or updated:** Central capability differentiation and stable
  denial tests; active/expired/suspended/revoked relationship filtering;
  audited relationship-write, restriction, approval, effective-window, and
  multi-guardian tests; capability-scoped module/file/QR/action-centre/weekly
  progress/aggregate tests; parent client parsing, locked-navigation,
  repository-concurrency, widget, layout, offline snapshot, and golden
  coverage.
- **Commands executed:**
  - `pnpm compile:artifacts`
  - `pnpm db:validate`
  - `pnpm verify:openapi`
  - `pnpm --filter @schoolos/api exec jest --runInBand src/operational-summary/operational-summary.service.spec.ts src/common/security/parent-scope.spec.ts src/mobile/mobile.service.spec.ts`
  - `pnpm --filter @schoolos/api test --runInBand`
  - `pnpm typecheck`
  - `dart format` on the touched Flutter source and test files
  - `flutter test test/parent_models_test.dart test/parent_dashboard_widget_test.dart test/parent_portal_repository_concurrency_test.dart`
  - `flutter test --update-goldens test/parent_dashboard_golden_test.dart`
  - `flutter analyze`
  - `flutter test`
- **Browser/device scenarios tested:** Flutter widget, layout, accessibility,
  cache, and golden regressions only; no authenticated browser, physical
  Android, or physical iOS scenario was executed in this batch.
- **Result:** Prisma validation and OpenAPI verification passed; 225 API suites
  / 2,162 tests passed; the final focused guardian/mobile/summary selection
  passed 3 suites / 57 tests; repo-wide core/API/web typechecks passed;
  Flutter analysis reported zero issues and all 511 Flutter tests passed.
- **Remaining limitations:** P0-06 still owns administrator provisioning,
  recovery, evidence/reason history presentation, device/session revocation,
  compromise hold, and account-recovery proof. P0-03 still owns secure offline
  cache and queued-write invalidation after relationship change. P0-15 still
  owns seeded authenticated browser, real-device, multi-user, staging, and
  pilot evidence. Real digital payments remain disabled under P0-12 and
  digital pickup remains outside the active pilot boundary.
- **Release decision:** P0-05 is development complete with reproducible local
  request-time capability, expiry, and revocation evidence. Proceed to P0-06.
  This does not advance the release stage beyond Internal QA /
  controlled-pilot preparation.

### P0-06 — Guardian administration, recovery, and revocation local closure

- **Previous implementation status:** Partial.
- **Problem or gap:** Administrators could link guardians and record identity
  reviews, but there was no single purpose-limited workflow for parent-account
  provisioning, evidence-backed recovery, high-risk phone changes, active
  session review/revocation, suspected compromise, or relationship
  suspension, restoration, expiry, revocation, and deceased-person handling.
- **Root cause:** Guardian relationship administration, user administration,
  identity evidence, refresh-token sessions, and audit history existed as
  separate foundations. Their high-risk transitions were not composed behind
  one guardian-specific contract with proof, reason, evidence reference,
  confirmation, and fail-closed permissions.
- **Implementation completed:**
  - added a safe guardian-access administration summary with relationship and
    parent-account state, recovery readiness, bounded decision history, and
    recent session labels without raw token, device identifier, IP address,
    user-agent, document number, or protected-file identifier exposure;
  - added verified recovery paths for an active trusted session, a completed
    email OTP, another approved co-guardian, or a completed school identity
    review; mere possession of an email address is not accepted as proof;
  - added audited recovery commands for high-risk phone change, selected or
    all-session revocation, suspected-account-compromise hold, suspended
    account restoration, temporary relationship expiry, relationship
    revocation, and deceased-guardian handling;
  - made parent-account provisioning transactional across parent-only user
    creation and guardian-link activation, require forced password change, and
    keep temporary passwords and session secrets out of audit and response
    history;
  - required guardian verification and user-administration permissions in
    addition to relationship-update permission for recovery, provisioning,
    and session commands, and added cross-tenant denial coverage;
  - blocked direct phone mutation for an app-linked guardian so high-risk
    number changes use the verified recovery command;
  - replaced the legacy physical guardian-link delete with a confirmed,
    reasoned, evidence-backed `REVOKED` lifecycle transition that preserves
    relationship, identity-review, protected-file-review, and audit history;
  - replaced the student-profile guardian editor with one permission-gated
    administration workspace for capability, verification, approval,
    effective-date, emergency-priority, restriction, identity-review,
    provisioning, recovery, session-revocation, and decision-history tasks.
- **Implementation files changed:** Focused core student contracts; student
  administration DTOs, controller, service, user service, and their unit
  tests; admission compatibility removal DTO/controller/service; the student
  API client and student-profile guardian/document workspaces; focused web
  contract tests; this roadmap.
- **Migrations added:** None beyond the P0-05
  `20260728130000_guardian_capability_contract`; P0-06 composes existing
  guardian, user, refresh-token, identity-review, and audit persistence.
- **Tests added or updated:** Safe-summary redaction, verified recovery-method
  readiness, phone-change/session invalidation/audit transaction,
  compromise/deceased/expire/revoke/restore state transitions, invalid restore
  denial, selected-session revocation, verification-permission and
  cross-tenant denial, app-linked direct-phone denial, transactional
  parent-only provisioning, secret-free audit, identity-response redaction,
  lifecycle-preserving compatibility removal, and guardian administration web
  contracts.
- **Commands executed:**
  - `pnpm compile:artifacts`
  - `pnpm db:validate`
  - `pnpm verify:openapi`
  - `pnpm --filter @schoolos/api test --runInBand src/users/users.service.spec.ts src/students/students.service.spec.ts src/students/students.controller.spec.ts src/admissions/m1-admissions-hardening.service.spec.ts src/admissions/m1-admissions-hardening.controller.spec.ts`
  - `pnpm --filter @schoolos/api test --runInBand`
  - `pnpm --filter @schoolos/api typecheck`
  - `pnpm --filter @schoolos/web typecheck`
  - `node --test test/student-profile-edit-contract.test.mjs test/m1-workspace-contract.test.mjs test/web-contracts.test.mjs`
  - `node --test --test-reporter=dot test/*.test.mjs`
- **Browser/device scenarios tested:** Contract tests only for this P0-06
  administration surface; no authenticated browser, physical Android, or
  physical iOS recovery scenario was executed in this batch.
- **Result:** Prisma validation and OpenAPI verification passed; the focused
  guardian administration selection passed 5 suites / 107 tests; the full API
  regression passed 225 suites / 2,179 tests; API and web typechecks passed;
  the focused web selection passed 111 tests. The full web contract run still
  has four pre-existing implementation-contract failures: three
  institutional-improvement pages intentionally fail closed with `notFound()`
  instead of mounting their disabled workspaces, and the disabled M4
  learning-improvement tab is absent. P0-06 introduced no focused web failure.
- **Remaining limitations:** Automatic notification of other authorized
  guardians remains disabled because no approved school policy and no safe
  M12 guardian-security event contract currently authorize it. This
  conditional feature is not claimed. P0-03 still owns secure offline cache
  and queued-write invalidation; P0-10 owns complete device management,
  re-authentication, and shared/lost-device proof; P0-15 owns authenticated
  browser, supported real-device, multi-user, staging, and pilot evidence.
- **Release decision:** P0-06 is development complete with reproducible local
  recovery, provisioning, session-revocation, and lifecycle evidence. Proceed
  to P0-14. This does not advance the release stage beyond Internal QA /
  controlled-pilot preparation.

### P0-14 — Core security and data-integrity local hardening

- **Previous implementation status:** Partial.
- **Problem or gap:** Strong tenant, RBAC, money, protected-file, audit,
  idempotency, migration, token, and configuration foundations existed, but
  the controlled-pilot security gate still lacked one reproducible
  cross-module regression result. Production could explicitly disable rate
  limiting, high-risk guardian administration routes had no narrower throttle,
  revoked guardian links remained visible as file-capable in the M1 ownership
  audit, notification dev-log mode logged recipient/content payloads,
  configurable notification/payment URLs allowed private-network targets, and
  the platform export workspace opened a signed storage URL directly.
- **Root cause:** The controls were implemented in separate module-specific
  paths. The deployment preflight did not fail closed on rate limiting, the
  admissions compatibility audit had not adopted the active relationship
  predicate, provider URLs were checked only for HTTPS, safe notification
  behavior covered delivery but not development-log redaction, and the
  platform export page predated the shared authenticated protected-file
  helper.
- **Implementation completed:**
  - required `RATE_LIMIT_ENABLED=true` for staging and production deployment
    preflight, rejected a disabled production runtime, validated every
    auth/QR/API-key rate-limit window and maximum, and added guard metadata
    coverage for default, authentication, guardian, QR, and API-key classes;
  - applied a ten-request-per-minute route throttle to guardian relationship,
    recovery, provisioning, session-revocation, invitation, and identity-review
    commands without weakening permission or tenant checks;
  - constrained the M1 ownership audit to active, verified, approved,
    effective guardian-child relationships so a revoked relationship is
    preserved for history without retaining protected-file access;
  - upgraded the shared Prisma test harness to faithfully evaluate relationship
    capability arrays, effective-date comparisons, nested guardian ownership,
    and active enrollment, then refreshed only the stale P0-05/P0-06 and frozen
    M13 compatibility fixtures that the production contract invalidated;
  - reduced notification dev-log output to provider/channel, recipient or
    token count, and notification-delivery identifier; email addresses, phone
    numbers, subject/body/HTML, device tokens, child identifiers, and routes
    are no longer logged;
  - added one shared outbound URL guard for notification and payment-provider
    configuration and runtime calls. It requires HTTPS without user
    information, rejects local/private/reserved IP literals and local host
    names, and disables redirect following for outbound provider requests;
  - replaced the platform report-export signed-URL browser open with the shared
    authenticated protected-file download helper and added a contract guard
    against reintroducing `getFileView` or `window.open` on that page;
  - started a fresh repository-wide Codex Security workbench scan after the
    first scan's temporary checkout was replaced. Its preflight, threat model,
    and deterministic 2,486-row review worklist are recorded; discovery remains
    at 0/2,486 and no finding result is claimed. Because the scan snapshot
    predates the final outbound-URL edits, a final-snapshot refresh is required
    before P0-14 can close.
- **Implementation files changed:** M1 admission ownership audit; notification,
  finance, and platform provider outbound handling and focused tests; shared
  outbound URL guard and tests; shared API E2E Prisma harness and affected
  guardian/attendance/transport/M13 fixtures; platform settings export
  download and focused web contract; this roadmap. Rate-limit runtime,
  deployment preflight, guardian throttle metadata/tests, and the production
  runbook were completed earlier in this P0-14 slice.
- **Migrations added:** None. The P0-14 changes use the already-compiled P0-05
  guardian relationship schema and preserve existing lifecycle history.
- **Tests added or updated:** Production rate-limit enablement and numeric
  validation, app-throttler policy, sensitive guardian route metadata,
  lifecycle-preserving admissions HTTP behavior, capability/effective-window
  parent scope in attendance/transport/frozen-learning compatibility,
  metadata-only notification dev logging, private/reserved outbound target
  rejection, redirect denial, and authenticated platform export download.
- **Commands executed:**
  - `pnpm verify:tracked-artifacts`
  - `pnpm db:validate`
  - `pnpm verify:openapi`
  - focused rate-limit/security unit selection: 14 suites / 253 tests
  - focused non-network security E2E selection: 8 suites / 50 tests
  - focused M3 finance HTTP E2E: 1 suite / 3 tests
  - focused outbound/provider unit selection: 4 suites / 98 tests
  - `pnpm --filter @schoolos/api typecheck`
  - `pnpm --filter @schoolos/api test --runInBand`
  - `pnpm --filter @schoolos/api test:e2e --runInBand`
  - `pnpm --filter @schoolos/web typecheck`
  - `node --test test/platform-change-plan-contract.test.mjs`
- **Browser/device scenarios tested:** API HTTP and focused web contract tests
  only. No authenticated browser, physical Android, or physical iOS security
  scenario was executed in this batch.
- **Result:** Tracked-artifact, Prisma validation, OpenAPI, API typecheck, and
  web typecheck gates passed. The final API unit regression passed 227 suites /
  2,219 tests, and the complete API E2E regression passed 43 suites / 277
  tests. The focused platform web contract passed 14 tests. The repository
  security scan remains in discovery and is not a completed
  security-regression report.
- **Remaining limitations:** The static outbound URL guard does not by itself
  prove DNS resolution or network-egress enforcement; production allowlisting
  or egress controls and staging provider tests remain required. A clean
  migration replay and migration-status check against PostgreSQL, staging
  secrets/provider verification, and the required backup/restore drill could
  not be established from the available local services. The security
  workbench must be refreshed against the final working snapshot and then
  review and close every worklist file and candidate before its report can be
  sealed. P0-03 still owns offline revocation and stale-write proof; P0-10 owns
  complete shared/lost-device and remote-session proof; P0-15 owns
  authenticated browser, real-device, multi-user, staging, provider,
  operations, and pilot evidence.
- **Release decision:** P0-14 remains partial despite the reproducible local
  hardening and green regression gates. Keep the pilot release blocked and do
  not advance beyond Wave 1 until the repository security scan, clean migration
  replay, staging configuration/provider checks, and backup/restore drill pass.

### P0-14 — Clean migration replay and M1 guardian-removal throttle

- **Previous implementation status:** Partial; local hardening verified.
- **Problem or gap:** M1 `removeGuardianAccess` lacked the guardian-admin
  throttle applied to `StudentsController`; ownership-audit tests did not assert
  the active-relationship where-clause; clean empty-DB migration replay was not
  recorded for the current 89-migration history.
- **Implementation completed:**
  - throttled `DELETE admissions/m1/students/:studentId/guardians/:guardianId`
    at 10 requests / 60 seconds;
  - asserted ownership-audit guardian queries require ACTIVE + VERIFIED +
    APPROVED + effective-window predicates;
  - added AppThrottlerGuard coverage for the M1 removal decorator;
  - created empty database `schoolos_p014_migrate_replay`, applied all 89
    migrations with `prisma migrate deploy`, and confirmed
    `prisma migrate status` reports the schema up to date.
- **Evidence document:**
  `docs/production/evidence/p0-14-security-2026-07-31-local.md`
- **Migrations added:** None.
- **Commands executed:**
  - empty-DB `prisma migrate deploy` + `prisma migrate status` (89/89)
  - focused M1/throttler/security unit selection: 25 + 76 tests passed
  - platform export web contract: 14/14
  - `pnpm verify:openapi`, `pnpm db:validate`
- **Result:** Clean migration replay PASS locally. Focused security regression
  PASS. Staging secrets/provider checks, sealed repository security scan, and
  staging/pilot backup-restore drill remain open.
- **Release decision:** P0-14 remains **PARTIAL**. Keep pilot release blocked.
  Next ops actions: seal security scan, run `DEPLOY_ENV_FILE=… pnpm verify:env:staging`
  on the staging host, and complete the staging backup/restore drill.
