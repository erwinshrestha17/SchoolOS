'use client';

import type {
  ActivityPost,
  AdmissionSummary,
  AttendanceOperationalSummary,
  GeneratedStudentDocumentMeta,
  InvoiceSummary,
  StudentDocument,
  StudentProfile,
  StudentProfileAttendanceRecord,
  StudentProfileInvoice,
} from '@schoolos/core';
import Link from 'next/link';

type StudentProfilePanelProps = {
  activityPosts: ActivityPost[];
  admission: AdmissionSummary | null;
  attendanceRecords: StudentProfileAttendanceRecord[];
  attendanceSummary: AttendanceOperationalSummary | undefined;
  documents: StudentDocument[];
  generatedDocuments: GeneratedStudentDocumentMeta[];
  invoices: Array<InvoiceSummary | StudentProfileInvoice>;
  isAttendanceLoading: boolean;
  onClose: () => void;
  onOpenPdf: (studentId: string, kind: string) => void;
  pdfError: string;
  student: StudentProfile;
};

const generatedDocumentActions = [
  ['id-card', 'ID card'],
  ['transfer-certificate', 'Transfer certificate'],
  ['leaving-certificate', 'Leaving certificate'],
  ['character-certificate', 'Character certificate'],
] as const;

export function StudentProfilePanel({
  activityPosts,
  admission,
  attendanceRecords,
  attendanceSummary,
  documents,
  generatedDocuments,
  invoices,
  isAttendanceLoading,
  onClose,
  onOpenPdf,
  pdfError,
  student,
}: StudentProfilePanelProps) {
  const guardians = student.guardians ?? admission?.guardians ?? [];
  const studentName = getStudentName(student, admission);
  const className = student.className ?? student.class?.name ?? admission?.className ?? 'Not assigned';
  const sectionName =
    student.sectionName ?? student.section ?? admission?.sectionName ?? 'No section';
  const rollNumber = student.rollNumber ?? admission?.rollNumber ?? null;

  return (
    <aside
      aria-label="Student profile panel"
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-lg font-bold text-primary-700">
            {initials(studentName)}
          </div>
          <div>
            <p className="label mb-1">Student Profile</p>
            <h2 className="text-xl font-bold text-gray-900">{studentName}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {student.studentSystemId} / {className} / {sectionName}
              {rollNumber ? ` / Roll ${rollNumber}` : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700"
          onClick={onClose}
        >
          Close profile
        </button>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <ProfileSection title="Guardians">
          {guardians.length > 0 ? (
            <div className="grid gap-3">
              {guardians.map((guardian) => {
                const email =
                  'email' in guardian && typeof guardian.email === 'string'
                    ? guardian.email
                    : null;

                return (
                  <div
                    key={guardian.id}
                    className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm"
                  >
                    <p className="font-semibold text-gray-900">
                      {guardian.fullName}
                      {guardian.isPrimary ? (
                        <span className="ml-2 rounded-full bg-success-50 px-2 py-0.5 text-xs text-success-600">
                          Primary
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-gray-500">
                      {guardian.relation} / {guardian.primaryPhone || 'No phone'}
                    </p>
                    {email ? <p className="mt-1 text-gray-500">{email}</p> : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyLine text="No guardian details available." />
          )}
        </ProfileSection>

        <ProfileSection title="Documents & Certificates">
          <p className="text-sm leading-6 text-gray-500">
            Open generated student documents through the existing secure PDF helper.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {generatedDocumentActions.map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700"
                onClick={() => onOpenPdf(student.id, kind)}
              >
                Open {label}
              </button>
            ))}
          </div>
          {pdfError ? <p className="mt-3 text-sm text-danger-600">{pdfError}</p> : null}
          <div className="mt-4 grid gap-2">
            {[...generatedDocuments, ...documents].slice(0, 5).map((document) => (
              <div
                key={document.id}
                className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600"
              >
                <p className="font-semibold text-gray-900">{document.fileName}</p>
                <p className="mt-1">
                  {document.kind} / {getDocumentSizeLabel(document)}
                </p>
              </div>
            ))}
            {generatedDocuments.length === 0 && documents.length === 0 ? (
              <p className="text-xs text-gray-500">No stored document history yet.</p>
            ) : null}
          </div>
        </ProfileSection>

        <ProfileSection title="Recent Invoices">
          {invoices.length > 0 ? (
            <div className="grid gap-3">
              {invoices.slice(0, 4).map((invoice) => (
                <div
                  key={invoice.id}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-gray-900">{invoice.invoiceNumber}</p>
                    <span className="rounded-full bg-white px-2 py-1 text-xs text-gray-500">
                    {invoice.status}
                  </span>
                </div>
                <p className="mt-1 text-gray-500">
                    Rs. {formatMoney(invoice.totalAmount)} / paid Rs.{' '}
                    {formatMoney(invoice.paidAmount ?? 0)}
                  </p>
                  {'outstandingAmount' in invoice ? (
                    <p className="mt-1 text-gray-500">
                      Outstanding Rs. {formatMoney(invoice.outstandingAmount)}
                    </p>
                  ) : null}
                </div>
              ))}
              <Link
                href="/dashboard/finance"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white"
              >
                Collect Fee
              </Link>
            </div>
          ) : (
            <EmptyLine text="No invoices available for this student yet." />
          )}
        </ProfileSection>

        <ProfileSection title="Attendance Summary">
          {isAttendanceLoading ? (
            <div className="h-20 animate-pulse rounded-xl bg-gray-100" />
          ) : attendanceSummary?.studentMonthly ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="font-semibold text-gray-900">
                {attendanceSummary.studentMonthly.attendancePercent}% monthly attendance
              </p>
              <p className="mt-1 text-gray-500">
                Consecutive absences:{' '}
                {attendanceSummary.studentMonthly.consecutiveAbsences}
              </p>
            </div>
          ) : (
            <EmptyLine text="Attendance summary is unavailable for the selected filters." />
          )}
          {attendanceRecords.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {attendanceRecords.slice(0, 5).map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs"
                >
                  <span className="font-semibold text-gray-900">
                    {record.attendanceDate}
                  </span>
                  <span className="rounded-full bg-white px-2 py-1 text-gray-600">
                    {record.status}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </ProfileSection>

        <ProfileSection title="Recent Activity">
          {activityPosts.length > 0 ? (
            <div className="grid gap-3">
              {activityPosts.slice(0, 4).map((post) => (
                <div
                  key={post.id}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm"
                >
                  <p className="font-semibold text-gray-900">{post.title}</p>
                  <p className="mt-1 text-gray-500">
                    {post.category} / {post.attachments.length} attachments
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyLine text="No recent activity posts found for this student." />
          )}
        </ProfileSection>
      </div>
    </aside>
  );
}

function ProfileSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
      {text}
    </div>
  );
}

function getStudentName(student: StudentProfile, admission: AdmissionSummary | null) {
  return (
    student.fullNameEn ||
    [student.firstNameEn, student.lastNameEn].filter(Boolean).join(' ') ||
    admission?.fullNameEn ||
    'Unnamed student'
  );
}

function getDocumentSizeLabel(
  document: StudentDocument | GeneratedStudentDocumentMeta,
) {
  if ('sizeBytes' in document) {
    return `${document.sizeBytes} bytes`;
  }

  return `version ${document.version}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-NP').format(amount);
}
