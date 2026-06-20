import { SettingsDirectoryWorkspace } from '@/components/settings/settings-directory-workspace';

export default function HomeworkTimetableLearningSettingsPage() { return <SettingsDirectoryWorkspace title="Homework, Timetable & Learning" description="Open module-owned workflows and review school-controlled learning configuration boundaries." areas={[
  { title: 'Homework', description: 'Homework publishing, reminders, assignments, and protected attachments remain in Homework.', href: '/dashboard/homework', status: 'module-owned' },
  { title: 'Timetable', description: 'Periods, rooms, shifts, conflicts, and substitute workflows remain in Timetable.', href: '/dashboard/timetable', status: 'module-owned' },
  { title: 'Learning', description: 'Teacher-led learning activities, controlled sessions, and parent summaries remain in Learning.', href: '/dashboard/learning', status: 'module-owned' },
  { title: 'School-wide learning policy', description: 'Session modes, smart-board, lab, worksheet fallback, and parent visibility need a purpose-limited contract.', status: 'contract-needed' },
]} note="Learning remains teacher-led and school-controlled. No AI tutor, open student chat, public leaderboard, or broad student-home learning controls are introduced." />; }
