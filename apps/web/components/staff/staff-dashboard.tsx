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
  Clock
} from 'lucide-react';
import { api } from '../../lib/api';
import { MyPayslips } from './my-payslips';
import { MyAttendance } from './my-attendance';
import { MyContracts } from './my-contracts';
import { MyLeaveRequests } from './my-leave-requests';

export function StaffDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMyProfile()
      .then(data => {
        setProfile(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch profile', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8 text-center">Loading profile...</div>;
  if (!profile) return <div className="p-8 text-center text-red-500">Profile not found.</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <Card className="w-full md:w-80 shrink-0">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                {profile.photoUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={profile.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                  </>
                ) : (
                  <User className="w-12 h-12 text-primary" />
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
