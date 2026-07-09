import { DashboardPageShell } from "../../../../components/dashboard/dashboard-page-shell";
import { DocumentRequestCenter } from "../../../../components/m1/document-request-center";
import { M1PageHeader } from "../../../../components/m1/m1-page-header";
import { StudentDocumentsWorkspace } from "../../../../components/m1/student-documents-workspace";

export default async function StudentDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    student?: string;
    studentId?: string;
    documentId?: string;
    kind?: string;
  }>;
}) {
  const params = await searchParams;
  const opensStudentVault = Boolean(
    params.student || params.studentId || params.documentId || params.kind,
  );

  return (
    <DashboardPageShell>
      <M1PageHeader
        title={
          opensStudentVault
            ? "Student Documents & Guardians"
            : "Document Request Center"
        }
        description={
          opensStudentVault
            ? "Review student guardians, protected documents, verification state, expiry, and audit history."
            : "Track missing admission documents by policy, class, timing, and age without weakening protected-file rules."
        }
      />
      {opensStudentVault ? (
        <StudentDocumentsWorkspace />
      ) : (
        <DocumentRequestCenter />
      )}
    </DashboardPageShell>
  );
}
