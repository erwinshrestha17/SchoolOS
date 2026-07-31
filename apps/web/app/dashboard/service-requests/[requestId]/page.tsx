import { ServiceRequestDetailWorkspace } from '@/components/service-requests/service-requests-workspace';

export default async function ServiceRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <ServiceRequestDetailWorkspace requestId={requestId} />;
}
