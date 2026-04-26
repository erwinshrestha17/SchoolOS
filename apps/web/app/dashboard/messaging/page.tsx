import { AppShell } from '../../../components/app-shell';
import { MessagingForm } from '../../../components/forms/messaging-form';

export default function MessagingPage() {
  return (
    <AppShell
      eyebrow="Phase 2"
      title="Parent-teacher messaging"
      requiredPermissions={['messaging:create']}
    >
      <MessagingForm />
    </AppShell>
  );
}
