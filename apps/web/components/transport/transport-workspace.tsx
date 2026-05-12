'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { AlertTriangle, Bus, MapPin, Navigation, ShieldCheck, Users } from 'lucide-react';
import type { StudentProfile } from '@schoolos/core';
import { api } from '../../lib/api';
import {
  transportApi,
  type TransportDriverAssignmentPayload,
  type TransportLocationPingPayload,
  type TransportRoutePayload,
  type TransportStopPayload,
  type TransportStudentAssignmentPayload,
  type TransportTrip,
  type TransportTripPayload,
  type TransportVehiclePayload,
} from '../../lib/transport-api';
import { EmptyState } from '../ui/empty-state';
import { LoadingState } from '../ui/loading-state';
import { PageHeader } from '../ui/page-header';
import { StatCard } from '../ui/stat-card';
import { StatusBadge, type StatusTone } from '../ui/status-badge';
import { cn } from '../../lib/utils';

type TransportTab =
  | 'overview'
  | 'routes'
  | 'vehicles'
  | 'assignments'
  | 'trips'
  | 'location'
  | 'reports';

type TransportWorkspaceProps = {
  initialTab?: TransportTab;
};

const tabs: Array<{ key: TransportTab; label: string; href: string }> = [
  { key: 'overview', label: 'Overview', href: '/dashboard/transport' },
  { key: 'routes', label: 'Routes & Stops', href: '/dashboard/transport/routes' },
  { key: 'vehicles', label: 'Vehicles', href: '/dashboard/transport/vehicles' },
  { key: 'assignments', label: 'Assignments', href: '/dashboard/transport/assignments' },
  { key: 'trips', label: 'Trips', href: '/dashboard/transport/trips' },
  { key: 'location', label: 'Location', href: '/dashboard/transport/location' },
  { key: 'reports', label: 'Reports', href: '/dashboard/transport/reports' },
];

const today = new Date().toISOString().slice(0, 10);

const emptyRouteForm: TransportRoutePayload = {
  name: '',
  code: '',
  isActive: true,
  stops: [{ routeId: '', name: 'Main stop', sequence: 1 }],
};

const emptyStopForm: TransportStopPayload = {
  routeId: '',
  name: '',
  sequence: 1,
};

const emptyVehicleForm: TransportVehiclePayload = {
  registrationNumber: '',
  model: '',
  capacity: 1,
};

const emptyDriverForm: TransportDriverAssignmentPayload = {
  vehicleId: '',
  routeId: '',
  staffId: '',
  startsAt: today,
};

const emptyStudentForm: TransportStudentAssignmentPayload = {
  studentId: '',
  routeId: '',
  stopId: '',
  startedAt: today,
};

const emptyTripForm: TransportTripPayload = {
  routeId: '',
  vehicleId: '',
  driverAssignmentId: '',
  direction: 'PICKUP',
};

const emptyPingForm: TransportLocationPingPayload = {
  latitude: 27.7172,
  longitude: 85.324,
};

export function TransportWorkspace({ initialTab = 'overview' }: TransportWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TransportTab>(initialTab);
  const [routeForm, setRouteForm] = useState<TransportRoutePayload>(emptyRouteForm);
  const [stopForm, setStopForm] = useState<TransportStopPayload>(emptyStopForm);
  const [vehicleForm, setVehicleForm] = useState<TransportVehiclePayload>(emptyVehicleForm);
  const [driverForm, setDriverForm] = useState<TransportDriverAssignmentPayload>(emptyDriverForm);
  const [studentForm, setStudentForm] = useState<TransportStudentAssignmentPayload>(emptyStudentForm);
  const [tripForm, setTripForm] = useState<TransportTripPayload>(emptyTripForm);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [pingForm, setPingForm] = useState<TransportLocationPingPayload>(emptyPingForm);
  const [notice, setNotice] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const routesQuery = useQuery({ queryKey: ['transport-routes'], queryFn: () => transportApi.listRoutes() });
  const stopsQuery = useQuery({ queryKey: ['transport-stops'], queryFn: () => transportApi.listStops() });
  const vehiclesQuery = useQuery({ queryKey: ['transport-vehicles'], queryFn: () => transportApi.listVehicles() });
  const driversQuery = useQuery({ queryKey: ['transport-driver-assignments'], queryFn: () => transportApi.listDriverAssignments() });
  const studentsQuery = useQuery({ queryKey: ['transport-student-assignments'], queryFn: () => transportApi.listStudentAssignments() });
  const activeTripsQuery = useQuery({ queryKey: ['transport-active-trips'], queryFn: () => transportApi.listActiveTrips() });
  const tripsQuery = useQuery({ queryKey: ['transport-trips'], queryFn: () => transportApi.listTrips() });
  const reportsQuery = useQuery({ queryKey: ['transport-reports'], queryFn: () => transportApi.getReports() });
  const tripHistoryReportQuery = useQuery({ 
    queryKey: ['transport-report-trips'], 
    queryFn: () => transportApi.getTripHistoryReport(),
    enabled: activeTab === 'reports'
  });
  const boardingReportQuery = useQuery({ 
    queryKey: ['transport-report-boarding'], 
    queryFn: () => transportApi.getBoardingReport(),
    enabled: activeTab === 'reports'
  });
  const schoolStudentsQuery = useQuery<StudentProfile[], Error>({ 
    queryKey: ['students-for-transport'], 
    queryFn: () => api.listStudents() 
  });
  const staffQuery = useQuery({ queryKey: ['staff-for-transport'], queryFn: () => api.listStaff() });
  const locationQuery = useQuery({
    queryKey: ['transport-latest-location', selectedTripId],
    queryFn: () => transportApi.getLatestLocation(selectedTripId),
    enabled: Boolean(selectedTripId),
  });

  const invalidateTransport = () => {
    void queryClient.invalidateQueries({ queryKey: ['transport-routes'] });
    void queryClient.invalidateQueries({ queryKey: ['transport-stops'] });
    void queryClient.invalidateQueries({ queryKey: ['transport-vehicles'] });
    void queryClient.invalidateQueries({ queryKey: ['transport-driver-assignments'] });
    void queryClient.invalidateQueries({ queryKey: ['transport-student-assignments'] });
    void queryClient.invalidateQueries({ queryKey: ['transport-active-trips'] });
    void queryClient.invalidateQueries({ queryKey: ['transport-trips'] });
    void queryClient.invalidateQueries({ queryKey: ['transport-reports'] });
    void queryClient.invalidateQueries({ queryKey: ['transport-latest-location'] });
  };

  const createRouteMutation = useMutation({
    mutationFn: transportApi.createRoute,
    onSuccess: () => {
      setRouteForm(emptyRouteForm);
      setNotice('Route created.');
      invalidateTransport();
    },
  });
  const createStopMutation = useMutation({
    mutationFn: transportApi.createStop,
    onSuccess: () => {
      setStopForm(emptyStopForm);
      setNotice('Stop added.');
      invalidateTransport();
    },
  });
  const createVehicleMutation = useMutation({
    mutationFn: transportApi.createVehicle,
    onSuccess: () => {
      setVehicleForm(emptyVehicleForm);
      setNotice('Vehicle created.');
      invalidateTransport();
    },
  });
  const assignDriverMutation = useMutation({
    mutationFn: transportApi.createDriverAssignment,
    onSuccess: () => {
      setDriverForm(emptyDriverForm);
      setNotice('Driver assignment created.');
      invalidateTransport();
    },
  });
  const assignStudentMutation = useMutation({
    mutationFn: transportApi.createStudentAssignment,
    onSuccess: () => {
      setStudentForm(emptyStudentForm);
      setNotice('Student assigned to route.');
      invalidateTransport();
    },
  });
  const startTripMutation = useMutation({
    mutationFn: transportApi.startTrip,
    onSuccess: (trip) => {
      setTripForm(emptyTripForm);
      setSelectedTripId(trip.id);
      setNotice('Trip started.');
      invalidateTransport();
    },
  });
  const completeTripMutation = useMutation({
    mutationFn: (tripId: string) => transportApi.completeTrip(tripId),
    onSuccess: () => {
      setNotice('Trip completed.');
      invalidateTransport();
    },
  });
  const markBoardedMutation = useMutation({
    mutationFn: ({ tripId, studentId }: { tripId: string; studentId: string }) =>
      transportApi.markStudentBoarded(tripId, { studentId }),
    onSuccess: () => {
      setNotice('Student marked boarded.');
      invalidateTransport();
    },
  });
  const markDroppedMutation = useMutation({
    mutationFn: ({ tripId, studentId }: { tripId: string; studentId: string }) =>
      transportApi.markStudentDropped(tripId, { studentId }),
    onSuccess: () => {
      setNotice('Student marked dropped.');
      invalidateTransport();
    },
  });
  const pingMutation = useMutation({
    mutationFn: ({ tripId, body }: { tripId: string; body: TransportLocationPingPayload }) =>
      transportApi.createLocationPing(tripId, body),
    onSuccess: () => {
      setNotice('Location ping recorded.');
      invalidateTransport();
    },
  });
  const cancelTripMutation = useMutation({
    mutationFn: ({ tripId, reason }: { tripId: string; reason?: string }) =>
      transportApi.cancelTrip(tripId, { reason }),
    onSuccess: () => {
      setNotice('Trip cancelled.');
      invalidateTransport();
    },
  });
  const pauseStudentMutation = useMutation({
    mutationFn: transportApi.pauseStudentAssignment,
    onSuccess: () => {
      setNotice('Student assignment paused.');
      invalidateTransport();
    },
  });
  const endStudentMutation = useMutation({
    mutationFn: transportApi.endStudentAssignment,
    onSuccess: () => {
      setNotice('Student assignment ended.');
      invalidateTransport();
    },
  });
  const updateRouteMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<TransportRoutePayload> }) =>
      transportApi.updateRoute(id, body),
    onSuccess: () => {
      setNotice('Route updated.');
      invalidateTransport();
    },
  });
  const updateVehicleMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<TransportVehiclePayload> }) =>
      transportApi.updateVehicle(id, body),
    onSuccess: () => {
      setNotice('Vehicle updated.');
      invalidateTransport();
    },
  });

  const routes = routesQuery.data ?? [];
  const stops = stopsQuery.data ?? [];
  const vehicles = vehiclesQuery.data ?? [];
  const driverAssignments = driversQuery.data ?? [];
  const studentAssignments = studentsQuery.data ?? [];
  const activeTrips = activeTripsQuery.data ?? [];
  const trips = tripsQuery.data ?? [];
  const selectedTrip = activeTrips.find((trip) => trip.id === selectedTripId) ?? trips.find((trip) => trip.id === selectedTripId);
  const activeTripStudentStatuses = activeTrips.flatMap(
    (trip) => trip.studentStatuses ?? [],
  );
  const studentsOnboard = activeTripStudentStatuses.filter(
    (status) => status.status === 'BOARDED',
  ).length;
  const studentsNotBoarded = activeTripStudentStatuses.filter((status) =>
    ['PENDING', 'ABSENT'].includes(status.status),
  ).length;
  const driversOnline = new Set(
    activeTrips.map((trip) => trip.driverAssignmentId).filter(Boolean),
  ).size;

  const stats = {
    activeTrips: reportsQuery.data?.activeTrips ?? activeTrips.length,
    activeAssignments: reportsQuery.data?.activeAssignments ?? 0,
    logsToday: reportsQuery.data?.logsToday ?? 0,
    delayedRoutes: 0,
    studentsOnboard,
    studentsNotBoarded,
    vehiclesActive: vehicles.filter((vehicle) => vehicle.status === 'ACTIVE').length,
    driversOnline,
    vehicleAlerts: (reportsQuery.data?.vehicleFitnessAlerts as any[])?.length ?? 0,
    driverAlerts: (reportsQuery.data?.driverLicenseAlerts as any[])?.length ?? 0,
  };

  const firstError =
    routesQuery.error ||
    stopsQuery.error ||
    vehiclesQuery.error ||
    driversQuery.error ||
    studentsQuery.error ||
    activeTripsQuery.error ||
    tripsQuery.error ||
    reportsQuery.error;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transport Management"
        description="Manage routes, stops, vehicles, assignments, trips, and GPS location monitoring for school operations."
        actions={
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'inline-flex min-h-10 items-center rounded-2xl px-4 text-sm font-semibold transition',
                  activeTab === tab.key
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900',
                )}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        }
      />

      {notice && (
        <Notice tone="success" message={notice} onDismiss={() => setNotice(null)} />
      )}
      {firstError && <Notice tone="error" message={(firstError as Error).message} />}

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Active Trips" value={stats.activeTrips} icon={<Navigation size={18} />} loading={activeTripsQuery.isLoading || reportsQuery.isLoading} />
            <StatCard title="Active Enrollments" value={stats.activeAssignments} icon={<Users size={18} />} loading={reportsQuery.isLoading} />
            <StatCard title="Logs Today" value={stats.logsToday} icon={<Bus size={18} />} loading={reportsQuery.isLoading} />
            <StatCard title="Vehicles Active" value={stats.vehiclesActive} icon={<Bus size={18} />} loading={vehiclesQuery.isLoading} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              {(stats.vehicleAlerts > 0 || stats.driverAlerts > 0) && (
                <section className="rounded-[2rem] border border-red-200 bg-red-50 p-5">
                  <h3 className="flex items-center gap-2 font-bold text-red-900">
                    <AlertTriangle size={18} />
                    Operational Alerts
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm text-red-800">
                    {stats.vehicleAlerts > 0 && (
                      <li>• {stats.vehicleAlerts} vehicles have documents expiring within 30 days.</li>
                    )}
                    {stats.driverAlerts > 0 && (
                      <li>• {stats.driverAlerts} drivers have licenses expiring within 30 days.</li>
                    )}
                  </ul>
                </section>
              )}

              <TripList trips={activeTrips} emptyTitle="No active trips" onSelect={(id) => { setSelectedTripId(id); setActiveTab('trips'); }} />
              
              <InfoCard title="Privacy and safety rules" lines={['Parents will only see their own child’s assigned vehicle/trip in the future parent view.', 'Driver app will only expose trips assigned to that driver later.', 'Never expose a full bus passenger list to parents.', 'Live map/WebSocket tracking is intentionally deferred; this admin slice shows latest coordinates only.']} />
            </div>

            <section className="space-y-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-slate-900">Quick Actions</h3>
              <div className="grid gap-2">
                <button type="button" onClick={() => setActiveTab('routes')} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-left transition hover:bg-slate-100">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600"><MapPin size={20} /></div>
                  <div><p className="text-sm font-bold text-slate-900">Add Route</p><p className="text-xs text-slate-500">Create new bus path</p></div>
                </button>
                <button type="button" onClick={() => setActiveTab('vehicles')} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-left transition hover:bg-slate-100">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><Bus size={20} /></div>
                  <div><p className="text-sm font-bold text-slate-900">Add Vehicle</p><p className="text-xs text-slate-500">Register new bus</p></div>
                </button>
                <button type="button" onClick={() => setActiveTab('assignments')} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-left transition hover:bg-slate-100">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600"><Users size={20} /></div>
                  <div><p className="text-sm font-bold text-slate-900">Assign Student</p><p className="text-xs text-slate-500">Enrol student to route</p></div>
                </button>
                <button type="button" onClick={() => setActiveTab('trips')} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-left transition hover:bg-slate-100">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600"><Navigation size={20} /></div>
                  <div><p className="text-sm font-bold text-slate-900">Monitor Trip</p><p className="text-xs text-slate-500">Start or track trip</p></div>
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'routes' && (
        <TwoColumn>
          <Panel title="Routes & stops" description="Create route setup and maintain ordered stops.">
            {routesQuery.isLoading ? <LoadingState label="Loading routes..." /> : null}
            {routes.length === 0 && !routesQuery.isLoading ? <EmptyState title="No routes" description="Create a route with at least one stop." /> : null}
            <div className="space-y-3">
              {routes.map((route) => (
                <div key={route.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900">{route.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-sm text-slate-500">{route.code}</p>
                        <TransportStatusBadge status={route.isActive ? 'ACTIVE' : 'INACTIVE'} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">{route.stops?.length ?? stops.filter((stop) => stop.routeId === route.id).length} stops</span>
                      <button type="button" onClick={() => updateRouteMutation.mutate({ id: route.id, body: { isActive: !route.isActive } })} className="text-xs font-bold text-blue-600 hover:underline">{route.isActive ? 'Deactivate' : 'Activate'}</button>
                    </div>
                  </div>
                  {route.stops && route.stops.length > 0 && (
                    <div className="mt-4 space-y-1">
                      {route.stops.slice(0, 3).map((stop) => (
                        <div key={stop.id} className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 font-bold">{stop.sequence}</span>
                          <span>{stop.name}</span>
                          {(stop.estimatedPickup || stop.estimatedDrop) && (
                            <span className="text-slate-400">({stop.estimatedPickup ?? '--'} / {stop.estimatedDrop ?? '--'})</span>
                          )}
                        </div>
                      ))}
                      {route.stops.length > 3 && <p className="pl-7 text-[10px] text-slate-400">...and {route.stops.length - 3} more stops</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Create route / stop" description="Start with one stop, then add more stops to an existing route.">
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); createRouteMutation.mutate(cleanRoute(routeForm)); }}>
              <TextInput label="Route name" value={routeForm.name} onChange={(name) => setRouteForm({ ...routeForm, name })} required />
              <TextInput label="Route code" value={routeForm.code} onChange={(code) => setRouteForm({ ...routeForm, code })} required />
              <TextInput label="First stop name" value={routeForm.stops[0]?.name ?? ''} onChange={(name) => setRouteForm({ ...routeForm, stops: [{ ...routeForm.stops[0], name, sequence: 1 }] })} required />
              <button type="submit" className="btn-primary" disabled={createRouteMutation.isPending}>{createRouteMutation.isPending ? 'Saving...' : 'Create route'}</button>
            </form>
            <hr className="my-5" />
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); createStopMutation.mutate(cleanStop(stopForm)); }}>
              <SelectInput label="Route" value={stopForm.routeId} onChange={(routeId) => setStopForm({ ...stopForm, routeId })} required options={routes.map((route) => ({ label: route.name, value: route.id }))} />
              <TextInput label="Stop name" value={stopForm.name} onChange={(name) => setStopForm({ ...stopForm, name })} required />
              <TextInput label="Sequence" type="number" value={String(stopForm.sequence)} onChange={(value) => setStopForm({ ...stopForm, sequence: Number(value) || 1 })} />
              <button type="submit" className="btn-secondary" disabled={createStopMutation.isPending}>{createStopMutation.isPending ? 'Adding...' : 'Add stop'}</button>
            </form>
          </Panel>
        </TwoColumn>
      )}

      {activeTab === 'vehicles' && (
        <TwoColumn>
          <Panel title="Vehicles" description="Manage registration, capacity, status, and document dates.">
            {vehiclesQuery.isLoading ? <LoadingState label="Loading vehicles..." /> : null}
            <div className="space-y-3">
              {vehicles.map((vehicle) => (
                <div key={vehicle.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">{vehicle.registrationNumber}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-sm text-slate-500">{vehicle.model || 'Model not set'} • {vehicle.capacity} seats</p>
                        <TransportStatusBadge status={vehicle.status} />
                      </div>
                      {vehicle.documentExpiry && (
                        <p className={cn("mt-2 text-xs", new Date(vehicle.documentExpiry) < addDays(new Date(), 30) ? "font-bold text-red-600" : "text-slate-400")}>
                          Docs expire: {new Date(vehicle.documentExpiry).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => updateVehicleMutation.mutate({ id: vehicle.id, body: { status: vehicle.status === 'ACTIVE' ? 'MAINTENANCE' : 'ACTIVE' } })} className="text-xs font-bold text-blue-600 hover:underline">
                        {vehicle.status === 'ACTIVE' ? 'Maintenance' : 'Set Active'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {vehicles.length === 0 && !vehiclesQuery.isLoading ? <EmptyState title="No vehicles" description="Create the first school vehicle." /> : null}
          </Panel>
          <Panel title="Create vehicle" description="Document expiry dates help produce operational alerts.">
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); createVehicleMutation.mutate(cleanVehicle(vehicleForm)); }}>
              <TextInput label="Registration number" value={vehicleForm.registrationNumber} onChange={(registrationNumber) => setVehicleForm({ ...vehicleForm, registrationNumber })} required />
              <TextInput label="Model" value={vehicleForm.model ?? ''} onChange={(model) => setVehicleForm({ ...vehicleForm, model })} />
              <TextInput label="Capacity" type="number" value={String(vehicleForm.capacity)} onChange={(value) => setVehicleForm({ ...vehicleForm, capacity: Number(value) || 1 })} required />
              <TextInput label="Document expiry" type="date" value={vehicleForm.documentExpiry ?? ''} onChange={(documentExpiry) => setVehicleForm({ ...vehicleForm, documentExpiry })} />
              <button type="submit" className="btn-primary" disabled={createVehicleMutation.isPending}>{createVehicleMutation.isPending ? 'Saving...' : 'Create vehicle'}</button>
            </form>
          </Panel>
        </TwoColumn>
      )}

      {activeTab === 'assignments' && (
        <TwoColumn>
          <Panel title="Assignments" description="Assign drivers and students to operational transport routes.">
            <h3 className="text-sm font-bold text-slate-700">Driver assignments</h3>
            <div className="mt-3 space-y-3">
              {driverAssignments.map((assignment) => (
                <RecordCard key={assignment.id} title={assignment.staff ? `${assignment.staff.firstName ?? ''} ${assignment.staff.lastName ?? ''}`.trim() : assignment.staffId} subtitle={`${assignment.vehicle?.registrationNumber ?? assignment.vehicleId} • ${assignment.route?.name ?? 'Any route'}`} />
              ))}
            </div>
            <h3 className="mt-6 text-sm font-bold text-slate-700">Student assignments</h3>
            <div className="mt-3 space-y-3">
              {studentAssignments.map((assignment) => (
                <div key={assignment.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900">{studentLabel(assignment.student) || assignment.studentId}</h3>
                      <p className="text-sm text-slate-500">{assignment.route?.name ?? assignment.routeId} • {assignment.stop?.name ?? assignment.stopId}</p>
                      <div className="mt-2">
                        <TransportStatusBadge status={assignment.status} />
                      </div>
                    </div>
                    {assignment.status === 'ACTIVE' && (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => pauseStudentMutation.mutate(assignment.id)} className="text-xs font-bold text-slate-500 hover:text-slate-900">Pause</button>
                        <button type="button" onClick={() => endStudentMutation.mutate(assignment.id)} className="text-xs font-bold text-red-500 hover:text-red-700">End</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Create assignments" description="Use real staff and student records from the school directory.">
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); assignDriverMutation.mutate(cleanDriver(driverForm)); }}>
              <SelectInput label="Driver/staff" value={driverForm.staffId} onChange={(staffId) => setDriverForm({ ...driverForm, staffId })} required options={(staffQuery.data ?? []).map((staff) => ({ label: `${staff.firstName ?? ''} ${staff.lastName ?? ''} ${staff.employeeId ? `(${staff.employeeId})` : ''}`.trim(), value: staff.id }))} />
              <SelectInput label="Vehicle" value={driverForm.vehicleId} onChange={(vehicleId) => setDriverForm({ ...driverForm, vehicleId })} required options={vehicles.map((vehicle) => ({ label: vehicle.registrationNumber, value: vehicle.id }))} />
              <SelectInput label="Route" value={driverForm.routeId ?? ''} onChange={(routeId) => setDriverForm({ ...driverForm, routeId })} options={routes.map((route) => ({ label: route.name, value: route.id }))} />
              <button type="submit" className="btn-primary" disabled={assignDriverMutation.isPending}>{assignDriverMutation.isPending ? 'Assigning...' : 'Assign driver'}</button>
            </form>
            <hr className="my-5" />
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); assignStudentMutation.mutate(cleanStudentAssignment(studentForm)); }}>
              <SelectInput label="Student" value={studentForm.studentId} onChange={(studentId) => setStudentForm({ ...studentForm, studentId })} required options={(schoolStudentsQuery.data ?? []).map((student) => ({ label: studentLabel(student) || student.id, value: student.id }))} />
              <SelectInput label="Route" value={studentForm.routeId} onChange={(routeId) => setStudentForm({ ...studentForm, routeId, stopId: '' })} required options={routes.map((route) => ({ label: route.name, value: route.id }))} />
              <SelectInput label="Stop" value={studentForm.stopId} onChange={(stopId) => setStudentForm({ ...studentForm, stopId })} required options={stops.filter((stop) => !studentForm.routeId || stop.routeId === studentForm.routeId).map((stop) => ({ label: `${stop.sequence}. ${stop.name}`, value: stop.id }))} />
              <TextInput label="Fee amount" type="number" value={studentForm.feeAmount?.toString() ?? ''} onChange={(value) => setStudentForm({ ...studentForm, feeAmount: value ? Number(value) : undefined })} />
              <button type="submit" className="btn-secondary" disabled={assignStudentMutation.isPending}>{assignStudentMutation.isPending ? 'Assigning...' : 'Assign student'}</button>
            </form>
          </Panel>
        </TwoColumn>
      )}

      {activeTab === 'trips' && (
        <TwoColumn>
          <div className="space-y-6">
          <Panel title="Trip Monitor" description="Active trips, student boarding state, and safe completion controls for admin operations.">
            <TripList trips={activeTrips} emptyTitle="No active trips" onComplete={(tripId) => completeTripMutation.mutate(tripId)} onCancel={(tripId) => { if (confirm('Cancel this trip?')) cancelTripMutation.mutate({ tripId }); }} onSelect={setSelectedTripId} showLocationWarning />
          </Panel>
          <Panel title="Trip History" description="Current trip history returned by the backend; live route replay can come later.">
            <TripList trips={trips.slice(0, 8)} emptyTitle="No trip history" compact />
          </Panel>
          <Panel title="Safety boundary" description="Foundation placeholder for future school-level visibility controls.">
            <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-bold">Live Tracking Boundary</p>
              <p className="mt-1">Live map/WebSocket UI and driver app controls are deferred. This admin slice shows latest coordinates only to ensure privacy and system stability.</p>
            </div>
          </Panel>
          </div>
          <Panel title="Start trip / mark student" description="Boarding and drop actions use real backend status endpoints.">
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); startTripMutation.mutate(cleanTrip(tripForm)); }}>
              <SelectInput label="Route" value={tripForm.routeId} onChange={(routeId) => setTripForm({ ...tripForm, routeId })} required options={routes.map((route) => ({ label: route.name, value: route.id }))} />
              <SelectInput label="Vehicle" value={tripForm.vehicleId} onChange={(vehicleId) => setTripForm({ ...tripForm, vehicleId })} required options={vehicles.map((vehicle) => ({ label: vehicle.registrationNumber, value: vehicle.id }))} />
              <SelectInput label="Driver assignment" value={tripForm.driverAssignmentId ?? ''} onChange={(driverAssignmentId) => setTripForm({ ...tripForm, driverAssignmentId })} options={driverAssignments.map((assignment) => ({ label: `${assignment.vehicle?.registrationNumber ?? assignment.vehicleId} • ${assignment.staff?.firstName ?? 'Driver'}`, value: assignment.id }))} />
              <SelectInput label="Direction" value={tripForm.direction} onChange={(direction) => setTripForm({ ...tripForm, direction: direction === 'DROP' ? 'DROP' : 'PICKUP' })} options={[{ label: 'Pickup', value: 'PICKUP' }, { label: 'Drop', value: 'DROP' }]} />
              <button type="submit" className="btn-primary" disabled={startTripMutation.isPending}>{startTripMutation.isPending ? 'Starting...' : 'Start trip'}</button>
            </form>
            <hr className="my-5" />
            <SelectInput label="Active trip" value={selectedTripId} onChange={setSelectedTripId} options={activeTrips.map((trip) => ({ label: `${trip.route?.name ?? trip.routeId} • ${trip.direction}`, value: trip.id }))} />
            {selectedTrip ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <TransportStatusBadge status={selectedTrip.status} />
                  <TransportStatusBadge status={selectedTrip.direction === 'PICKUP' ? 'BUS_ARRIVING' : 'ROUTE_COMPLETED'} />
                </div>
                <div className="mt-3 space-y-2">
                  {(selectedTrip.studentStatuses ?? []).slice(0, 6).map((status) => (
                    <div key={status.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm">
                      <span className="font-semibold text-slate-700">{studentLabel(status.student) || status.studentId}</span>
                      <TransportStatusBadge status={status.status} />
                    </div>
                  ))}
                  {(selectedTrip.studentStatuses ?? []).length === 0 ? (
                    <p className="text-sm text-slate-500">No student status records returned for this trip yet.</p>
                  ) : null}
                </div>
              </div>
            ) : null}
            <SelectInput label="Student" value={selectedStudentId} onChange={setSelectedStudentId} options={(selectedTrip?.studentStatuses ?? []).map((status) => ({ label: studentLabel(status.student) || status.studentId, value: status.studentId }))} />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" disabled={!selectedTripId || !selectedStudentId || markBoardedMutation.isPending} onClick={() => markBoardedMutation.mutate({ tripId: selectedTripId, studentId: selectedStudentId })}>Mark boarded</button>
              <button type="button" className="btn-secondary" disabled={!selectedTripId || !selectedStudentId || markDroppedMutation.isPending} onClick={() => markDroppedMutation.mutate({ tripId: selectedTripId, studentId: selectedStudentId })}>Mark dropped</button>
            </div>
          </Panel>
        </TwoColumn>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          <TwoColumn>
            <Panel title="Trip History Report" description="Comprehensive history of all transport trips.">
               {tripHistoryReportQuery.isLoading ? <LoadingState label="Loading report..." /> : null}
               <div className="space-y-3">
                  {((tripHistoryReportQuery.data as any)?.items ?? []).map((item: any) => (
                    <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm">
                       <div className="flex justify-between font-bold text-slate-900">
                          <span>{item.route?.name}</span>
                          <TransportStatusBadge status={item.status} />
                       </div>
                       <p className="mt-1 text-slate-500">{item.vehicle?.registrationNumber} • {item.direction} • {new Date(item.startedAt).toLocaleDateString()}</p>
                       <p className="mt-2 text-xs font-semibold text-slate-400">Driver: {item.driverAssignment?.staff?.firstName} {item.driverAssignment?.staff?.lastName}</p>
                    </div>
                  ))}
                  {((tripHistoryReportQuery.data as any)?.items ?? []).length === 0 && !tripHistoryReportQuery.isLoading && (
                    <EmptyState title="No history" description="No trip records found for the selected period." />
                  )}
               </div>
            </Panel>
            <Panel title="Boarding Summary" description="Student-level boarding and drop history.">
               {boardingReportQuery.isLoading ? <LoadingState label="Loading report..." /> : null}
               <div className="space-y-3">
                  {((boardingReportQuery.data as any)?.items ?? []).map((item: any) => (
                    <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm">
                       <div className="flex justify-between font-bold text-slate-900">
                          <span>{studentLabel(item.student)}</span>
                          <TransportStatusBadge status={item.status} />
                       </div>
                       <p className="mt-1 text-slate-500">{item.trip?.route?.name} • {item.stop?.name}</p>
                       <p className="mt-2 text-xs text-slate-400">{formatDateTime(item.createdAt)}</p>
                    </div>
                  ))}
               </div>
            </Panel>
          </TwoColumn>
          <InfoCard title="Export Controls" lines={['PDF and CSV exports use server-side generation to ensure data integrity.', 'Reporting data is restricted to authorized transport administrators only.']} />
        </div>
      )}

      {activeTab === 'location' && (
        <TwoColumn>
          <Panel title="Latest location" description="Map and WebSocket live tracking will be added later; this reads the latest backend location.">
            <SelectInput label="Trip" value={selectedTripId} onChange={setSelectedTripId} options={[...activeTrips, ...trips].map((trip) => ({ label: `${trip.route?.name ?? trip.routeId} • ${trip.status} (${trip.direction})`, value: trip.id }))} />
            {locationQuery.isFetching ? <LoadingState label="Loading latest location..." /> : null}
            {locationQuery.data ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                   <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><p className="text-slate-500">Latitude</p><p className="font-bold">{locationQuery.data.latitude}</p></div>
                      <div><p className="text-slate-500">Longitude</p><p className="font-bold">{locationQuery.data.longitude}</p></div>
                      <div><p className="text-slate-500">Speed</p><p className="font-bold">{locationQuery.data.speedKph ?? '0'} km/h</p></div>
                      <div><p className="text-slate-500">Recorded</p><p className="font-bold">{formatDateTime(locationQuery.data.recordedAt)}</p></div>
                   </div>
                   {new Date().getTime() - new Date(locationQuery.data.recordedAt).getTime() > 120000 && (
                     <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-100 px-3 py-2 text-xs font-bold text-red-700">
                        <AlertTriangle size={14} />
                        Stale Data: Last update was over 2 minutes ago.
                     </div>
                   )}
                </div>
                <div className="flex h-48 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <MapPin size={32} />
                  <span className="ml-2 font-semibold">Map Preview Deferred</span>
                </div>
              </div>
            ) : <EmptyState title="No location selected" description="Select an active or recent trip to read its latest location." />}
          </Panel>
          <div className="space-y-6">
            <Panel title="Manual location ping" description="Useful for API smoke testing until the driver app sends GPS automatically.">
              <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (selectedTripId) pingMutation.mutate({ tripId: selectedTripId, body: pingForm }); }}>
                <TextInput label="Latitude" type="number" value={String(pingForm.latitude)} onChange={(value) => setPingForm({ ...pingForm, latitude: Number(value) })} />
                <TextInput label="Longitude" type="number" value={String(pingForm.longitude)} onChange={(value) => setPingForm({ ...pingForm, longitude: Number(value) })} />
                <button type="submit" className="btn-primary w-full" disabled={!selectedTripId || pingMutation.isPending}>{pingMutation.isPending ? 'Recording...' : 'Record ping'}</button>
              </form>
            </Panel>
            <InfoCard title="Safety warning" lines={['Location data is read-only for admins.', 'Manual pings are for testing purposes only.', 'Real-time GPS flow requires the driver mobile application.']} />
          </div>
        </TwoColumn>
      )}
    </div>
  );
}

function TwoColumn({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">{children}</div>;
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Notice({ tone, message, onDismiss }: { tone: 'success' | 'error'; message: string; onDismiss?: () => void }) {
  return (
    <div className={cn('flex items-center justify-between rounded-2xl border px-4 py-3 text-sm', tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700')}>
      <span>{message}</span>
      {onDismiss ? <button type="button" className="font-semibold" onClick={onDismiss}>Dismiss</button> : null}
    </div>
  );
}

function InfoCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      <h2 className="font-bold">{title}</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {lines.map((line) => <li key={line}>{line}</li>)}
      </ul>
    </section>
  );
}

function TripList({ trips, emptyTitle, onComplete, onCancel, onSelect, compact, showLocationWarning }: { trips: TransportTrip[]; emptyTitle: string; onComplete?: (tripId: string) => void; onCancel?: (tripId: string) => void; onSelect?: (tripId: string) => void; compact?: boolean; showLocationWarning?: boolean }) {
  if (trips.length === 0) return <EmptyState title={emptyTitle} description="Trip records will appear here." />;

  return (
    <div className="space-y-3">
      {trips.map((trip) => (
        <div key={trip.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900">{trip.route?.name ?? trip.routeId}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-sm text-slate-500">{trip.vehicle?.registrationNumber ?? trip.vehicleId} • {trip.direction}</p>
                <TransportStatusBadge status={trip.status} />
              </div>
              {!compact && (
                <div className="mt-2 flex items-center gap-4">
                  <p className="text-xs text-slate-400 font-semibold">Students: {trip.studentStatuses?.length ?? 0}</p>
                  {trip.driverAssignment?.staff && (
                    <p className="text-xs text-slate-400 font-semibold">Driver: {trip.driverAssignment.staff.firstName} {trip.driverAssignment.staff.lastName}</p>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {onSelect ? <button type="button" className="btn-secondary" onClick={() => onSelect(trip.id)}>Details</button> : null}
              {onComplete && trip.status === 'ACTIVE' ? <button type="button" className="btn-primary" onClick={() => onComplete(trip.id)}>Complete</button> : null}
              {onCancel && trip.status === 'ACTIVE' ? <button type="button" className="text-xs font-bold text-red-500 hover:text-red-700 ml-2" onClick={() => onCancel(trip.id)}>Cancel</button> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecordCard({ title, subtitle, badge }: { title: string; subtitle: string; badge?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        {badge}
      </div>
    </div>
  );
}

function TransportStatusBadge({ status }: { status: string }) {
  const badgeMap: Record<string, { label: string; tone: StatusTone }> = {
    READY: { label: 'Ready', tone: 'pending' },
    BUS_ARRIVING: { label: 'Bus arriving', tone: 'published' },
    PENDING: { label: 'Ready', tone: 'pending' },
    BOARDED: { label: 'Onboard', tone: 'published' },
    DROPPED: { label: 'Dropped', tone: 'approved' },
    ABSENT: { label: 'Delayed', tone: 'pending' },
    MISSED: { label: 'Delayed', tone: 'pending' },
    DELAYED: { label: 'Delayed', tone: 'pending' },
    ROUTE_COMPLETED: { label: 'Route completed', tone: 'approved' },
    COMPLETED: { label: 'Completed', tone: 'approved' },
    ACTIVE: { label: 'Active', tone: 'active' },
    CANCELLED: { label: 'Cancelled', tone: 'inactive' },
    INACTIVE: { label: 'Inactive', tone: 'inactive' },
    MAINTENANCE: { label: 'Delayed', tone: 'pending' },
    RETIRED: { label: 'Cancelled', tone: 'inactive' },
    PAUSED: { label: 'Delayed', tone: 'pending' },
    ENDED: { label: 'Completed', tone: 'approved' },
  };
  const normalized = status.trim().toUpperCase();
  const config = badgeMap[normalized] ?? {
    label: formatStatus(normalized),
    tone: 'info' as StatusTone,
  };

  return <StatusBadge status={normalized} label={config.label} tone={config.tone} />;
}

function formatStatus(status: string) {
  return status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function TextInput({ label, value, onChange, type = 'text', required }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="input-control mt-1" />
    </label>
  );
}

function SelectInput({ label, value, onChange, options, required }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }>; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <select required={required} value={value} onChange={(event) => onChange(event.target.value)} className="input-control mt-1">
        <option value="">Select...</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function studentLabel(student?: { firstNameEn?: string; lastNameEn?: string; studentSystemId?: string } | null) {
  if (!student) return '';
  return `${student.firstNameEn ?? ''} ${student.lastNameEn ?? ''} ${student.studentSystemId ? `(${student.studentSystemId})` : ''}`.trim();
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString();
}

function cleanRoute(form: TransportRoutePayload): TransportRoutePayload {
  return { ...form, vehicleId: form.vehicleId || undefined, stops: form.stops.filter((stop) => stop.name.trim()) };
}

function cleanStop(form: TransportStopPayload): TransportStopPayload {
  return { ...form, estimatedPickup: form.estimatedPickup || undefined, estimatedDrop: form.estimatedDrop || undefined };
}

function cleanVehicle(form: TransportVehiclePayload): TransportVehiclePayload {
  return { ...form, model: form.model || undefined, documentExpiry: form.documentExpiry || undefined, fitnessCertificateExp: form.fitnessCertificateExp || undefined };
}

function cleanDriver(form: TransportDriverAssignmentPayload): TransportDriverAssignmentPayload {
  return { ...form, routeId: form.routeId || undefined, licenseNumber: form.licenseNumber || undefined, licenseExpires: form.licenseExpires || undefined, endsAt: form.endsAt || undefined };
}

function cleanStudentAssignment(form: TransportStudentAssignmentPayload): TransportStudentAssignmentPayload {
  return { ...form, startedAt: form.startedAt || undefined };
}

function cleanTrip(form: TransportTripPayload): TransportTripPayload {
  return { ...form, driverAssignmentId: form.driverAssignmentId || undefined, notes: form.notes || undefined };
}
