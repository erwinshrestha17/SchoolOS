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

- [ ] P0-01 Shared Teacher Authorization and Scope Resolver
- [ ] P0-02 Temporary Substitute, Replacement, and Handover
- [ ] P0-03 Offline Revocation and Cache Purge
- [ ] P0-04 Effective-Dated Student Rosters
- [ ] P0-05 Guardian Capability Permission Model
- [ ] P0-06 Guardian Administration, Recovery, and Revocation
- [ ] P0-07 Wrong-Child Prevention
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
- [ ] P1-03 Principal Attention View
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
