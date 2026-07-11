# Parent Timetable Design QA

- Source visual truth: `/var/folders/lk/djyr35kd33q6bthd8__cxtw00000gn/T/codex-clipboard-408c3edb-dce6-488c-a5ac-f1f3be688f74.png`
- Implementation screenshot: `apps/schoolos_mobile/test/goldens/parent_timetable_screen.png`
- Full-view comparison: `/tmp/parent-timetable-design-comparison.jpg`
- Viewport: 432 x 911 logical pixels
- State: Parent timetable, Monday selected, eight published periods

## Full-view comparison evidence

The reference and implementation were normalized to the same 432 x 911 viewport and inspected side by side. The implementation preserves the reference hierarchy: timetable title, linked-child summary, Sunday-first weekday selector, selected green day, day/count header, colored period cards, time column, subject icon, teacher/room metadata, period badge, and six-item parent navigation.

The source includes a photographed Android device frame and system status/navigation chrome. Those are intentionally outside the Flutter screen implementation. The production `ParentDetailScaffold` continues to own the actual SchoolOS top bar, notification/profile actions, safe areas, and parent bottom navigation.

## Focused region comparison evidence

A separate crop was not needed because the normalized full-view comparison keeps the header, selector, labels, icons, card spacing, typography, and badges readable at native logical resolution.

## Required fidelity surfaces

- Fonts and typography: The implementation uses the existing Flutter theme in production. The QA capture uses the macOS system font to avoid Flutter test's block-style Ahem font. Weight and hierarchy align with the reference, and long subject/metadata text truncates safely.
- Spacing and layout rhythm: Header, selector, day header, and period rows follow the reference's compact vertical rhythm while retaining 44-pixel weekday touch targets. Cards remain overflow-free at 320-pixel width.
- Colors and visual tokens: Existing Parent Portal emerald, navy, muted, and soft-surface tokens are retained. Subject colors closely follow the reference without changing semantic data.
- Image quality and asset fidelity: The design contains standard interface icons rather than raster imagery. Existing Material icons are used; no placeholder, emoji, custom SVG, or generated bitmap is substituted.
- Copy and content: All student, class, teacher, room, version, period, and schedule counts remain backend-derived. The fixture differs from the source only where it exercises actual dynamic content.

## Findings

No actionable P0, P1, or P2 mismatch remains.

Accepted differences:

- Device frame and Android system chrome belong to the reference capture, not the app screen.
- The test fixture reports 13 weekly slots rather than the reference's 40; production displays the backend-owned total.
- The production shell supplies the profile avatar and back behavior, while the isolated visual harness keeps the app bar minimal.

## Comparison history

1. Initial implementation: period cards used intrinsic sizing around a responsive layout and failed the compact-phone render test. The card structure was changed to a stack-based accent rail; the 320 x 700 interaction/overflow test then passed.
2. First visual capture: header, weekday selector, day heading, and period rows were taller than the source, leaving only six periods visible. Icon sizes, metadata type, padding, badges, and vertical gaps were tightened while preserving touch targets.
3. Final capture: eight Monday periods fit the 432 x 911 flow, the Sunday-first selector matches the source order, and the visible hierarchy, colors, icons, and density align with the source. Focused Flutter analysis and both timetable widget tests pass.

## Implementation checklist

- [x] Preserve the purpose-limited linked-child timetable API.
- [x] Add functional weekday filtering.
- [x] Use backend-owned period counts and labels.
- [x] Match the reference's child summary and period-card hierarchy.
- [x] Keep compact-phone layouts overflow-free.
- [x] Retain SchoolOS parent navigation and design tokens.

final result: passed
