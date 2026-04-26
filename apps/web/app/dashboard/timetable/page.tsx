import { AppShell } from '../../../components/app-shell';
import { TimetableHomeworkForm } from '../../../components/forms/timetable-homework-form';

export default function TimetablePage() {
  return (
    <AppShell
      eyebrow="Phase 2"
      title="Timetable and homework workflow"
      requiredPermissions={['timetable:manage']}
    >
      <TimetableHomeworkForm />
    </AppShell>
  );
}
