import { redirect } from 'next/navigation';

export default function AttendanceReportsRedirect() {
  redirect('/dashboard/attendance');
}
