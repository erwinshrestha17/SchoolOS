'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  User, 
  FileText, 
  Calendar, 
  CreditCard, 
  Download, 
  Briefcase,
  MapPin,
  Phone,
  Mail,
  Clock,
  School
} from 'lucide-react';
import { api } from '../../lib/api';
import { MyPayslips } from './my-payslips';
import { MyAttendance } from './my-attendance';
import { MyContracts } from './my-contracts';
import { MyLeaveRequests } from './my-leave-requests';
import { useSession } from '../session-provider';

export function StaffDashboard() {
  const { session } = useSession();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMyProfile()
      .then(data => {
        setProfile(data);
        setLoading(false);
      })
      .catch(err => {
        if (err && (err.statusCode === 404 || err.status === 404)) {
          console.warn('No staff profile linked to this user account.');
        } else {
          console.error('Failed to fetch profile', err);
        }
        setProfile(null);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-medium">Loading profile...</div>;
  }

  if (!profile) {
    const initials = session?.user.email
      ? session.user.email
          .split('@')[0]
          .split('.')
          .map((p) => p[0]?.toUpperCase())
          .join('')
          .slice(0, 2)
      : 'A';
    const displayName = session?.user.email?.split('@')[0] ?? 'User';
    const primaryRole = session?.user.roles[0]?.replace(/_/g, ' ') ?? 'Administrator';

    return (
      <div className="space-y-6 p-6 animate-fade-in">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <Card className="w-full md:w-80 shrink-0 shell-card">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-24 h-24 rounded-full bg-[var(--primary-soft)] text-[var(--primary-dark)] flex items-center justify-center font-bold text-2xl shadow-inner border border-[var(--primary-soft)]">
                  {initials}
                </div>
                <div>
                  <h2 className="text-xl font-bold capitalize text-slate-900">{displayName}</h2>
                  <p className="text-sm text-slate-500 mt-1">{session?.user.email}</p>
                  <Badge className="mt-3 bg-[var(--primary-soft)] text-[var(--primary-dark)] hover:bg-[var(--primary-soft)] border border-[var(--primary-soft)]">
                    {primaryRole}
                  </Badge>
                </div>
                
                <div className="w-full pt-4 space-y-3 text-sm text-left border-t border-slate-100">
                  <div className="flex items-center gap-2.5 text-slate-700">
                    <School className="w-4 h-4 text-slate-400" />
                    <span className="truncate font-semibold">{session?.tenant.name}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-500">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Code</span>
                    <span className="font-semibold text-slate-700">{session?.tenant.slug}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex-1 space-y-6 w-full">
            <Card className="shell-card">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-900">Administrator Console Profile</CardTitle>
                <CardDescription>You are logged in with administrative roles. This account does not have a linked payroll or timetable staff record.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Roles & Group Scopes</h3>
                  <div className="flex flex-wrap gap-2">
                    {session?.user.roles.map((role) => (
                      <Badge key={role} className="bg-slate-100 text-slate-700 border border-slate-200 capitalize py-1 px-2.5">
                        {role.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Assigned Permissions ({session?.user.permissions.length ?? 0})</h3>
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-1.5">
                    {session?.user.permissions.map((perm) => (
                      <div key={perm} className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span>{perm}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <Card className="w-full md:w-80 shrink-0">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-24 h-24 rounded-full bg-[var(--primary-soft)] flex items-center justify-center">
                {profile.photoUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={profile.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                  </>
                ) : (
                  <User className="w-12 h-12 text-[var(--primary)]" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold">{profile.firstName} {profile.lastName}</h2>
                <p className="text-sm text-muted-foreground">{profile.employeeId}</p>
                <Badge variant="secondary" className="mt-2">
                  {profile.user?.userRoles?.[0]?.role?.name || 'Staff'}
                </Badge>
              </div>
              
              <div className="w-full pt-4 space-y-3 text-sm text-left border-t">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{profile.user?.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{profile.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>Joined {new Date(profile.joiningDate).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex-1 space-y-6 w-full">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid grid-cols-5 w-full md:w-[500px]">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="payslips">Payslips</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="leave">Leave</TabsTrigger>
              <TabsTrigger value="contracts">Contracts</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Current Assignment
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm"><span className="text-muted-foreground">Contract Type:</span> {profile.contractType}</p>
                      <p className="text-sm"><span className="text-muted-foreground">Bank:</span> {profile.bankName || 'Not set'}</p>
                      <p className="text-sm"><span className="text-muted-foreground">Account:</span> {profile.bankAccount || 'Not set'}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Check the tabs for detailed attendance and payslip history.</p>
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
              <MyContracts contracts={profile.staffContracts} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
