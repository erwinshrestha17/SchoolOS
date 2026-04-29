'use client';

import type {
  ActivityPost,
  GeneratedStudentDocumentMeta,
  GuardianProfile,
  StudentDocument,
  StudentProfileAttendanceRecord,
  StudentProfileDetail,
  StudentProfileInvoice,
} from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '../../lib/api';

type StudentDetailPageProps = {
  studentId: string;
};

const detailTabs = [
  'Overview',
  'Guardians',
  'Documents',
  'Fees',
  'Attendance',
  'Activity',
  'History',
] as const;

type DetailTab = (typeof detailTabs)[number];

const generatedDocumentActions = [
  ['id-card', 'ID card'],
  ['transfer-certificate', 'Transfer certificate'],
  ['leaving-certificate', 'Leaving certificate'],
  ['character-certificate', 'Character certificate'],
] as const;

export function StudentDetailPage({ studentId }: StudentDetailPageProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('Overview');
  const [pdfError, setPdfError] = useState('');
  const profileQuery = useQuery({
    queryKey: ['student-profile', studentId],
    queryFn: () => api.getStudentProfile(studentId),
    enabled: Boolean(studentId),
  });

  async function openStudentPdf(kind: string) {
    if (!profileQuery.data?.student.id) {
      return;
    }

    setPdfError('');

    try {
      await api.openStudentDocumentPdf(profileQuery.data.student.id, kind);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'Could not open PDF.');
    }
  }

  if (!studentId) {
    return (
      <StudentDetailShell title="Student profile unavailable">
        <ErrorCard message="No student ID was provided in the route." />
      </StudentDetailShell>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <StudentDetailShell title="Loading student profile">
        <ProfileSkeleton />
      </StudentDetailShell>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <StudentDetailShell title="Student profile unavailable">
        <ErrorCard
          message={
            (profileQuery.error as Error | null)?.message ||
            'Student profile could not be loaded.'
          }
        />
      </StudentDetailShell>
    );
  }

  const profile = profileQuery.data;
  const studentName = getStudentName(profile);

  return (
    <StudentDetailShell title={studentName}>
      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-primary-50 text-xl font-bold text-primary-700">
              {initials(studentName)}
            </div>
            <div>
              <p className="label mb-2">Student Profile</p>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                {studentName}
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                {profile.student.studentSystemId} /{' '}
                {profile.student.className ?? profile.student.class?.name ?? 'No class'} /{' '}
                {profile.student.sectionName ?? profile.student.section ?? 'No section'}
                {profile.student.rollNumber ? ` / Roll ${profile.student.rollNumber}` : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge>{profile.student.lifecycleStatus ?? 'ACTIVE'}</Badge>
                <Badge>{profile.student.gender ?? 'Gender not set'}</Badge>
                {profile.student.disabilityFlag ? (
                  <Badge>{profile.student.disabilityFlag}</Badge>
                ) : (
                  <Badge>No known disability</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/admissions"
              className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
            >
              Back to Directory
            </Link>
            <Link
              href={`/dashboard/finance?studentId=${encodeURIComponent(profile.student.id)}`}
              className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
            >
              Collect Fee
            </Link>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white"
              onClick={() => void openStudentPdf('id-card')}
            >
              Open ID Card
            </button>
          </div>
        </div>

        {pdfError ? (
          <p className="mt-4 rounded-2xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-600">
            {pdfError}
          </p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-2 shadow-sm">
        <div
          aria-label="Student profile sections"
          className="grid gap-2 md:grid-cols-4 xl:grid-cols-7"
        >
          {detailTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`min-h-11 rounded-2xl px-3 text-sm font-semibold transition-colors ${
                activeTab === tab
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'Overview' ? <OverviewTab profile={profile} /> : null}
      {activeTab === 'Guardians' ? (
        <GuardiansTab guardians={profile.guardians} />
      ) : null}
      {activeTab === 'Documents' ? (
        <DocumentsTab
          documents={profile.documents}
          generatedDocuments={profile.generatedDocuments}
          onOpenPdf={openStudentPdf}
        />
      ) : null}
      {activeTab === 'Fees' ? <FeesTab invoices={profile.invoices} /> : null}
      {activeTab === 'Attendance' ? (
        <AttendanceTab records={profile.attendanceRecords} />
      ) : null}
      {activeTab === 'Activity' ? (
        <ActivityTab posts={profile.activityPosts} />
      ) : null}
      {activeTab === 'History' ? <HistoryTab profile={profile} /> : null}
    </StudentDetailShell>
  );
}

function StudentDetailShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-primary-700">Students</p>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          {title}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Full Phase 1 student profile across admissions, guardians, documents,
          fees, attendance, activity, and history.
        </p>
      </div>
      {children}
    </div>
  );
}

function OverviewTab({ profile }: { profile: StudentProfileDetail }) {
  const primaryGuardian = profile.guardians.find((guardian) => guardian.isPrimary) ?? profile.guardians[0];
  const outstanding = profile.invoices.reduce(
    (sum, invoice) => sum + invoice.outstandingAmount,
    0,
  );
  const presentCount = profile.attendanceRecords.filter(
    (record) => record.status === 'PRESENT',
  ).length;

  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <SectionCard title="Student Overview">
        <dl className="grid gap-4 md:grid-cols-2">
          <DetailItem label="Student ID" value={profile.student.studentSystemId} />
          <DetailItem label="Lifecycle status" value={profile.student.lifecycleStatus ?? 'ACTIVE'} />
          <DetailItem
            label="Date of birth"
            value={
              profile.student.dateOfBirth
                ? formatDate(profile.student.dateOfBirth)
                : 'Not recorded'
            }
          />
          <DetailItem label="Gender" value={profile.student.gender ?? 'Not set'} />
          <DetailItem label="Class" value={profile.student.className ?? profile.student.class?.name ?? 'Not assigned'} />
          <DetailItem label="Section" value={profile.student.sectionName ?? profile.student.section ?? 'No section'} />
          <DetailItem label="Roll number" value={profile.student.rollNumber ?? 'Not assigned'} />
          <DetailItem label="National student ID" value={profile.student.nationalStudentId ?? 'Not recorded'} />
        </dl>
      </SectionCard>

      <SectionCard title="Pilot Snapshot">
        <div className="grid gap-3">
          <Metric label="Guardians" value={profile.guardians.length} />
          <Metric label="Open invoices" value={profile.invoices.length} />
          <Metric label="Outstanding fees" value={`Rs. ${formatMoney(outstanding)}`} />
          <Metric label="Recent present records" value={presentCount} />
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Primary guardian:{' '}
          <span className="font-semibold text-gray-900">
            {primaryGuardian?.fullName ?? 'Not available'}
          </span>
          {primaryGuardian?.primaryPhone ? ` / ${primaryGuardian.primaryPhone}` : ''}
        </p>
      </SectionCard>
    </div>
  );
}

function GuardiansTab({ guardians }: { guardians: GuardianProfile[] }) {
  return (
    <SectionCard title="Guardians">
      {guardians.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {guardians.map((guardian) => (
            <article
              key={guardian.id}
              className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{guardian.fullName}</p>
                  <p className="mt-1 text-sm text-gray-500">{guardian.relation}</p>
                </div>
                {guardian.isPrimary ? <Badge>Primary</Badge> : null}
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Phone: {guardian.primaryPhone || 'Not available'}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Email: {guardian.email || 'Not available'}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Ward: {guardian.wardNumber || 'Not recorded'}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState message="No guardians linked to this student yet." />
      )}
    </SectionCard>
  );
}

function DocumentsTab({
  documents,
  generatedDocuments,
  onOpenPdf,
}: {
  documents: StudentDocument[];
  generatedDocuments: GeneratedStudentDocumentMeta[];
  onOpenPdf: (kind: string) => Promise<void>;
}) {
  return (
    <div className="grid gap-5">
      <SectionCard title="PDF Actions">
        <div className="flex flex-wrap gap-2">
          {generatedDocumentActions.map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
              onClick={() => void onOpenPdf(kind)}
            >
              Open {label}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Document History">
        {generatedDocuments.length > 0 || documents.length > 0 ? (
          <div className="grid gap-3">
            {generatedDocuments.map((document) => (
              <DocumentRow
                key={document.id}
                title={document.fileName}
                meta={`${document.kind} / version ${document.version}`}
                status={document.revokedAt ? 'Revoked' : 'Current'}
              />
            ))}
            {documents.map((document) => (
              <DocumentRow
                key={document.id}
                title={document.fileName}
                meta={`${document.kind} / ${document.contentType} / ${document.sizeBytes} bytes`}
                status="Uploaded"
              />
            ))}
          </div>
        ) : (
          <EmptyState message="No uploaded or generated document history yet." />
        )}
      </SectionCard>
    </div>
  );
}

function FeesTab({ invoices }: { invoices: StudentProfileInvoice[] }) {
  return (
    <SectionCard title="Fees">
      {invoices.length > 0 ? (
        <div className="grid gap-3">
          {invoices.map((invoice) => (
            <article
              key={invoice.id}
              className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{invoice.invoiceNumber}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Due {formatDate(invoice.dueDate)} / issued {formatDate(invoice.issuedAt)}
                  </p>
                </div>
                <Badge>{invoice.status}</Badge>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Metric label="Total" value={`Rs. ${formatMoney(invoice.totalAmount)}`} />
                <Metric label="Paid" value={`Rs. ${formatMoney(invoice.paidAmount)}`} />
                <Metric label="Outstanding" value={`Rs. ${formatMoney(invoice.outstandingAmount)}`} />
              </div>
              {invoice.lines.length > 0 ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="py-2 pr-3">Fee Head</th>
                        <th className="py-2 pr-3">Description</th>
                        <th className="py-2 pr-3">VAT</th>
                        <th className="py-2 pr-3">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {invoice.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="py-2 pr-3 font-medium text-gray-900">
                            {line.feeHeadName}
                          </td>
                          <td className="py-2 pr-3 text-gray-600">{line.description}</td>
                          <td className="py-2 pr-3 text-gray-600">
                            Rs. {formatMoney(line.vatAmount)}
                          </td>
                          <td className="py-2 pr-3 text-gray-600">
                            Rs. {formatMoney(line.totalAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState message="No invoices found for this student." />
      )}
    </SectionCard>
  );
}

function AttendanceTab({ records }: { records: StudentProfileAttendanceRecord[] }) {
  return (
    <SectionCard title="Attendance">
      {records.length > 0 ? (
        <div className="grid gap-2">
          {records.map((record) => (
            <div
              key={record.id}
              className="grid gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-[1fr_auto]"
            >
              <div>
                <p className="font-semibold text-gray-900">
                  {formatDate(record.attendanceDate)}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Submitted {record.submittedAt ? formatDate(record.submittedAt) : 'not recorded'}
                  {record.lateAt ? ` / late at ${formatDate(record.lateAt)}` : ''}
                </p>
                {record.remark ? (
                  <p className="mt-1 text-sm text-gray-600">{record.remark}</p>
                ) : null}
              </div>
              <Badge>{record.status}</Badge>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="No attendance records found for this student." />
      )}
    </SectionCard>
  );
}

function ActivityTab({ posts }: { posts: ActivityPost[] }) {
  return (
    <SectionCard title="Activity">
      {posts.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {posts.map((post) => (
            <article
              key={post.id}
              className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{post.title}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {post.category} / {post.audienceType}
                  </p>
                </div>
                <Badge>{post.attachments.length} files</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                {post.caption || post.body || 'No caption recorded.'}
              </p>
              {post.studentTags.length > 0 ? (
                <p className="mt-3 text-xs font-semibold text-gray-500">
                  Tagged students: {post.studentTags.length}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState message="No activity posts found for this student." />
      )}
    </SectionCard>
  );
}

function HistoryTab({ profile }: { profile: StudentProfileDetail }) {
  return (
    <SectionCard title="History">
      <div className="grid gap-3">
        {profile.enrollments.map((enrollment) => (
          <TimelineRow
            key={enrollment.id}
            title={`Enrollment ${enrollment.academicYear}`}
            meta={`${enrollment.className} / ${enrollment.sectionName ?? 'No section'} / ${enrollment.status}`}
            date={enrollment.admissionDate}
          />
        ))}
        {profile.generatedDocuments.map((document) => (
          <TimelineRow
            key={document.id}
            title={`Generated ${document.kind}`}
            meta={`Version ${document.version}${document.revokedAt ? ' / revoked' : ''}`}
            date={document.signedAt ?? document.retentionUntil}
          />
        ))}
        {profile.attendanceRecords.slice(0, 8).map((record) => (
          <TimelineRow
            key={record.id}
            title={`Attendance ${record.status}`}
            meta={record.remark ?? 'No remark'}
            date={record.attendanceDate}
          />
        ))}
        {profile.enrollments.length === 0 &&
        profile.generatedDocuments.length === 0 &&
        profile.attendanceRecords.length === 0 ? (
          <EmptyState message="No profile history is available yet." />
        ) : null}
      </div>
    </SectionCard>
  );
}

function SectionCard({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <dt className="label mb-2">{label}</dt>
      <dd className="text-sm font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
      {children}
    </span>
  );
}

function DocumentRow({
  meta,
  status,
  title,
}: {
  meta: string;
  status: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-4 md:flex-row md:items-start md:justify-between">
      <div>
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="mt-1 text-sm text-gray-500">{meta}</p>
      </div>
      <Badge>{status}</Badge>
    </div>
  );
}

function TimelineRow({
  date,
  meta,
  title,
}: {
  date: string | null;
  meta: string;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{meta}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
        {date ? formatDate(date) : 'Date not recorded'}
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
      {message}
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <section className="rounded-3xl border border-danger-200 bg-danger-50 p-5 text-sm text-danger-600">
      {message}
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="rounded-3xl border border-gray-200 bg-white p-5">
        <div className="h-16 w-16 animate-pulse rounded-3xl bg-gray-100" />
        <div className="mt-5 h-5 w-56 animate-pulse rounded-full bg-gray-100" />
        <div className="mt-3 h-4 w-80 animate-pulse rounded-full bg-gray-100" />
      </div>
      <div className="h-20 animate-pulse rounded-3xl bg-gray-100" />
      <div className="h-64 animate-pulse rounded-3xl bg-gray-100" />
    </div>
  );
}

function getStudentName(profile: StudentProfileDetail) {
  return (
    profile.student.fullNameEn ||
    [profile.student.firstNameEn, profile.student.lastNameEn]
      .filter(Boolean)
      .join(' ') ||
    'Unnamed student'
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}
