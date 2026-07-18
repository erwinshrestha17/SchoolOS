'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatBsDate, type StaffDetail } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Calendar,
  CreditCard,
  Briefcase,
  History,
  School,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { ApiRequestError, api } from '../../lib/api';
import { MyPayslips } from './my-payslips';
import { MyAttendance } from './my-attendance';
import { MyContracts } from './my-contracts';
import { MyLeaveRequests } from './my-leave-requests';
import { useSession } from '../session-provider';

export function StaffDashboard() {
  const { session } = useSession();
  const [profile, setProfile] = useState<StaffDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notLinked, setNotLinked] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const timelineQuery = useQuery({
    queryKey: ['my-staff-timeline'],
    queryFn: () => api.getMyStaffTimeline(),
    enabled: Boolean(profile),
  });

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setNotLinked(false);

    try {
      const data = await api.getMyProfile();
      setProfile(data);
    } catch (error) {
      setProfile(null);
      if (error instanceof ApiRequestError && error.statusCode === 404) {
        setNotLinked(true);
      } else {
        setLoadError(
          error instanceof Error
            ? error
            : new Error('The employment record could not be loaded.'),
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (loading) {
    return (
      <LoadingState
        variant="page"
        label="Loading your employment workspace..."
      />
    );
  }

  if (notLinked) {
    return (
      <EmptyState
        title="No linked employment record"
        description="This signed-in account is not linked to a staff record for the current school. Employment, attendance, leave, contract, and payslip information will appear here after an authorised administrator links the record."
        icon={<Briefcase className="h-7 w-7" />}
      />
    );
  }

  if (loadError || !profile) {
    return (
      <ErrorState
        title="Could not load My Workspace"
        message="Your employment information could not be loaded. Please retry. If this continues, contact your school administrator."
        error={loadError}
        onRetry={() => void loadProfile()}
      />
    );
  }

  const staffName = [profile.firstName, profile.lastName]
    .filter(Boolean)
    .join(' ');
  const staffRole = profile.roles[0] ?? 'Staff';
  const employment = profile.employment;
  const hasBankDetails = Boolean(profile.bankName || profile.bankAccount);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <Card className="w-full shrink-0 md:w-80">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-[var(--primary-soft)] bg-[var(--primary-soft)]">
                {profile.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.photoUrl}
                    alt={`${staffName} profile`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-[var(--primary)]" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold">{staffName}</h2>
                <p className="text-sm text-muted-foreground">
                  Employee ID · {profile.employeeId}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-[var(--primary-soft)] bg-[var(--primary-soft)] text-[var(--primary-dark)]"
                  >
                    {formatRecordValue(staffRole)}
                  </Badge>
                  {profile.status ? (
                    <Badge variant="outline">
                      {formatRecordValue(profile.status)}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="w-full pt-4 space-y-3 text-sm text-left border-t">
                {session?.tenant.name ? (
                  <div className="flex items-center gap-2">
                    <School className="h-4 w-4 text-muted-foreground" />
                    <span>{session.tenant.name}</span>
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>Joined {formatBsDate(profile.joiningDate)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex-1 space-y-6 w-full">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList
              className="flex h-auto w-full justify-start overflow-x-auto p-1 md:w-fit"
              aria-label="My Workspace sections"
            >
              <TabsTrigger className="shrink-0" value="overview">
                Overview
              </TabsTrigger>
              <TabsTrigger className="shrink-0" value="payslips">
                Payslips
              </TabsTrigger>
              <TabsTrigger className="shrink-0" value="attendance">
                Attendance
              </TabsTrigger>
              <TabsTrigger className="shrink-0" value="leave">
                Leave
              </TabsTrigger>
              <TabsTrigger className="shrink-0" value="contracts">
                Contracts
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <div
                className={
                  hasBankDetails
                    ? 'grid grid-cols-1 gap-4 lg:grid-cols-2'
                    : 'grid grid-cols-1 gap-4'
                }
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Employment summary
                    </CardTitle>
                    <CardDescription>
                      Your current assignment and contract status.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <dl className="space-y-3">
                      <DetailRow
                        label="Current assignment"
                        value={employment?.designation ?? profile.designation}
                      />
                      <DetailRow
                        label="Department"
                        value={employment?.department ?? profile.department}
                      />
                      <DetailRow
                        label="Employment type"
                        value={
                          employment?.employmentType ?? profile.contractType
                        }
                      />
                      <DetailRow
                        label="Contract status"
                        value={employment?.contractStatus}
                      />
                    </dl>
                  </CardContent>
                </Card>

                {hasBankDetails ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        Payroll details
                      </CardTitle>
                      <CardDescription>
                        Bank information is shown only when your access allows
                        it.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <dl className="space-y-3">
                        <DetailRow label="Bank" value={profile.bankName} />
                        <DetailRow
                          label="Account (masked)"
                          value={maskStaffBankAccount(profile.bankAccount)}
                        />
                      </dl>
                    </CardContent>
                  </Card>
                ) : null}

                <Card className={hasBankDetails ? 'lg:col-span-2' : undefined}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <History className="w-4 h-4" />
                      Recent employment activity
                    </CardTitle>
                    <CardDescription>
                      Recent contract, leave, payroll, document, and employment
                      record events.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {timelineQuery.isLoading ? (
                      <LoadingState label="Loading recent activity..." />
                    ) : timelineQuery.isError ? (
                      <div
                        className="flex flex-col items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                        role="status"
                      >
                        <p className="text-sm text-slate-600">
                          Recent activity could not be loaded. Your other
                          employment information is still available.
                        </p>
                        <button
                          type="button"
                          onClick={() => void timelineQuery.refetch()}
                          className="text-sm font-bold text-[var(--primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                        >
                          Try again
                        </button>
                      </div>
                    ) : timelineQuery.data?.items.length ? (
                      <ol className="divide-y divide-slate-100">
                        {timelineQuery.data.items.slice(0, 5).map((event) => (
                          <li
                            key={`${event.type}-${event.id}`}
                            className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                          >
                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold text-slate-900">
                                {formatTimelineTitle(event.title)}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {formatRecordValue(event.type)}
                                {event.reason
                                  ? ` · ${formatRecordValue(event.reason)}`
                                  : ''}
                              </p>
                            </div>
                            <time
                              dateTime={event.occurredAt}
                              className="shrink-0 text-xs font-medium text-slate-500"
                            >
                              {formatBsDate(event.occurredAt)}
                            </time>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No recent employment activity is recorded.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="payslips" className="mt-6">
              <MyPayslips />
            </TabsContent>

            <TabsContent value="attendance" className="mt-6">
              <MyAttendance />
            </TabsContent>

            <TabsContent value="leave" className="mt-6">
              <MyLeaveRequests staffId={profile.id} />
            </TabsContent>

            <TabsContent value="contracts" className="mt-6">
              <MyContracts contracts={profile.staffContracts ?? []} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid gap-1 text-sm sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">
        {value ? formatRecordValue(value) : 'Not recorded'}
      </dd>
    </div>
  );
}

function formatRecordValue(value: string) {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTimelineTitle(value: string) {
  return /^[A-Z0-9_]+$/.test(value) ? formatRecordValue(value) : value;
}

function maskStaffBankAccount(value?: string | null) {
  const normalized = value?.trim();

  if (!normalized) {
    return 'Not recorded';
  }

  if (normalized.includes('****')) {
    return normalized;
  }

  if (normalized.length <= 4) {
    return '****';
  }

  return `${normalized.slice(0, 2)}****${normalized.slice(-2)}`;
}
