import { StudentLearningSessionView } from '../../../../../components/learning/learning-runtime';

export default async function StudentLearningSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return <StudentLearningSessionView sessionId={sessionId} />;
}
