**Design QA**

- Source visual truth: `/Users/erwin/Downloads/ParentAppScreens/More-ReportCards.png`
- Implementation screenshot: `/private/tmp/schoolos_report_cards_final.png`
- Viewport: Android emulator, 920 x 2048 physical pixels (approximately 418 x 930 logical pixels)
- State: Aarav Shrestha, First Terminal Examination published, Second Terminal Examination upcoming, More tab active

**Full-view comparison evidence**

The source and emulator capture were opened together in the same comparison input. The implementation preserves the reference hierarchy: title and account actions, child selector, published report summary, result and attendance metrics, subject grades, two report actions, upcoming examination state, and fixed five-tab navigation. The emulator viewport is materially narrower than the framed source, so grades responsively use a 2 x 2 grid rather than four columns and the teacher note remains below the first viewport.

**Focused region comparison evidence**

A separate crop was not required because the source and implementation full views kept typography, badges, grade cards, action buttons, and navigation labels readable at original resolution.

**Findings**

- No actionable P0, P1, or P2 findings remain.
- Expected responsive difference: the 418 logical-pixel implementation uses two grade columns to preserve readable labels and tap targets; the wider mock uses four.
- Expected preview-harness difference: the back button is absent because the screenshot was captured from a temporary root preview entrypoint. The production GoRouter route supplies normal back navigation.
- Expected token difference: the primary report action uses the portal purple action token, consistent with the supplied SchoolOS color rules for report cards, rather than the mock's green button.

**Required fidelity surfaces**

- Fonts and typography: existing SchoolOS Outfit/system fallback, strong navy hierarchy, readable status and metric weights; no clipping after compact fixes.
- Spacing and layout rhythm: 16-20 px cards, soft borders, consistent section gaps, safe scrolling, and fixed bottom navigation match the reference system.
- Colors and visual tokens: off-white page, white cards, navy headings, green success, purple academic actions, and muted upcoming state are consistent.
- Image quality and assets: no screenshot backgrounds or external imagery are used; UI is built from Flutter widgets and Material icons as requested.
- Copy and content: published date, overall Pass, 94% attendance, four grades, report actions, upcoming state, and teacher note match the supplied brief.

**Patches made during QA**

- Reduced grade-card density and button label wrapping on narrow phones.
- Fixed compact overflows in Calendar, Report Cards, Transport, Canteen Wallet, and Library.
- Added compact-device widget regression coverage for all new More screens.

**Implementation Checklist**

- [x] Reference hierarchy and content preserved.
- [x] More tab remains active.
- [x] Small-screen layout has no tested overflows.
- [x] Actions remain interactive.
- [x] Emulator build installs and renders without crash-buffer entries.

final result: passed
