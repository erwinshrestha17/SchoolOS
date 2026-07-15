import { notFound } from 'next/navigation';
import { WorkspaceStateFixture } from '@/components/test-fixtures/workspace-state-fixture';

export const dynamic = 'force-dynamic';

export default function WorkspaceStatesFixturePage() {
  if (process.env.SCHOOLOS_VISUAL_FIXTURES !== '1') {
    notFound();
  }

  return <WorkspaceStateFixture />;
}
