import { AppShell } from '../../../components/app-shell';
import { AttendanceForm } from '../../../components/forms/attendance-form';

export default function AttendancePage() {
  return (
    <AppShell
      eyebrow="Attendance"
      title="Present-by-default class submission"
      requiredPermissions={['attendance:mark']}
    >
      <section className="shell-card rounded-[32px] p-8">
        <AttendanceForm />
      </section>
    </AppShell>
  );
}
