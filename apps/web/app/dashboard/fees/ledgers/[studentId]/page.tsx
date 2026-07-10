import { redirect } from "next/navigation";

export default async function StudentLedgerCompatibilityPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  redirect(`/dashboard/fees/ledgers?studentId=${encodeURIComponent(studentId)}`);
}
