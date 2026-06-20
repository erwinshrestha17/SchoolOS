'use client';

import { useParams } from 'next/navigation';
import { SettingsPolicyWorkspace } from '../../../../../components/settings/settings-policy-workspace';

export default function SchoolSettingsPolicyPage() {
  const params = useParams<{ policyId: string }>();
  return <SettingsPolicyWorkspace policyId={params.policyId} />;
}
