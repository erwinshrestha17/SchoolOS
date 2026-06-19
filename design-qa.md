**Source visual truth**

- `/Users/erwin/Downloads/WebAllScreens/M1-screens/ChatGPT Image Jun 19, 2026, 04_53_06 PM (1).png`
- `/Users/erwin/Downloads/WebAllScreens/M1-screens/ChatGPT Image Jun 19, 2026, 04_53_15 PM (10).png`

**Implementation evidence**

- `/private/tmp/m1-students.png`
- `/private/tmp/m1-iemis.png`
- `/private/tmp/m1-students-comparison.png`
- `/private/tmp/m1-iemis-comparison.png`

**Viewport and state**

- 1536 x 1086 desktop viewport.
- Authenticated school administrator using the seeded `default-school` tenant.
- Student directory and iEMIS validation workspaces with real seeded API data.

**Full-view comparison evidence**

- The implementation preserves the reference hierarchy: persistent SchoolOS shell, white/soft-blue workspace, six KPI cards, module tabs, compact filters, operational rows, and contextual work areas.
- The iEMIS implementation closely follows the source composition with validation KPIs, issue table, export checklist, protected export actions, and persisted import sections.
- The student directory currently uses compact roster rows rather than the reference's denser multi-column table and opens its contextual inspector after row selection rather than selecting a row by default.

**Focused region comparison evidence**

- KPI typography was reduced for unsupported values by replacing long `Unavailable` values with an em dash while retaining explanatory copy.
- Secondary readiness and duplicate panels were collapsed so the main student roster appears directly after filters, matching the source task hierarchy.
- Status colors, border radii, control sizing, protected-file actions, and module blue tokens follow the supplied reference and existing SchoolOS design system.

**Findings**

- [P2] Student roster density differs from the reference table.
  - Location: `apps/web/components/forms/student-directory.tsx`.
  - Evidence: the reference exposes persistent column headers and more records per viewport; the implementation uses responsive roster rows with the same core data and actions.
  - Impact: desktop scanning is less compact than the supplied visual target.
  - Fix: convert the roster row grid to a semantic table while retaining the current mobile row layout and URL-backed inspector selection.

**Patches made during QA**

- Replaced invalid pending-admission status calls with an honest unavailable KPI.
- Moved readiness and duplicate attention content behind a collapsed disclosure so the roster remains the main task.
- Added persisted CSV import history and import-review queue.
- Added document expiry policy visibility and audited guardian-access revocation.
- Added focused M1 contract tests.

**Blocking condition**

- Further browser comparison was stopped after the in-app browser security policy rejected continued localhost use.
- The final production build rerun was also blocked by the execution approval usage limit; the preceding production build passed before the final workflow-coverage additions, and the final TypeScript, ESLint, and unit/contract gates pass.

final result: blocked
