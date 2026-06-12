import { SmartBoardSessionView } from '../../../../../components/learning/learning-runtime';

export default async function SmartBoardSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return <SmartBoardSessionView sessionId={sessionId} />;
}
