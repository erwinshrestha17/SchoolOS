'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { AlertTriangle, Bus, Download, MapPin, Navigation, ShieldCheck, Users } from 'lucide-react';
import type { StudentProfile } from '@schoolos/core';
import { api } from '../../lib/api';
import {
  transportApi,
  type TransportDriverAssignmentPayload,
  type TransportLocationPingPayload,
  type TransportRoutePayload,
  type TransportStopPayload,
  type TransportStudentAssignmentPayload,
  type TransportStudentAssignment,
  type TransportTrip,
  type TransportTripPayload,
  type TransportVehiclePayload,
  type TransportRoute,
  type TransportStop,
} from '../../lib/transport-api';
import { EmptyState } from '../ui/empty-state';
import { LoadingState } from '../ui/loading-state';
import { PageHeader } from '../ui/page-header';
import { StatCard } from '../ui/stat-card';
import { StatusBadge, type StatusTone } from '../ui/status-badge';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { cn } from '../../lib/utils';
const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

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
  fitnessCertificateExp: '',
  insuranceExpiry: '',
  registrationExpiry: '',
  pollutionExpiry: '',
  documentExpiry: '',
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
  const [confirmingTripAction, setConfirmingTripAction] = useState<{
    action: 'complete' | 'cancel';
    tripId: string;
  } | null>(null);
  const [delayingTrip, setDelayingTrip] = useState<{
    tripId: string;
    isDelayed: boolean;
    delayReason?: string;
  } | null>(null);
  const [viewingTripId, setViewingTripId] = useState<string | null>(null);
  const [reportRouteId, setReportRouteId] = useState('');
  const [reportVehicleId, setReportVehicleId] = useState('');
  const [reportDriverAssignmentId, setReportDriverAssignmentId] = useState('');

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
    queryKey: [
      'transport-report-trips',
      reportRouteId,
      reportVehicleId,
      reportDriverAssignmentId,
    ],
    queryFn: () =>
      transportApi.getTripHistoryReport({
        routeId: reportRouteId,
        vehicleId: reportVehicleId,
        driverAssignmentId: reportDriverAssignmentId,
      }),
    enabled: activeTab === 'reports'
  });
  const boardingReportQuery = useQuery({ 
    queryKey: ['transport-report-boarding'], 
    queryFn: () => transportApi.getBoardingReport(),
    enabled: activeTab === 'reports'
  });
  const schoolStudentsQuery = useQuery({ 
    queryKey: ['students-for-transport'], 
    queryFn: () => api.listStudents({ limit: 1000 }) 
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
  const markDelayMutation = useMutation({
    mutationFn: ({ tripId, body }: { tripId: string; body: { isDelayed: boolean; delayReason?: string; delayMinutes?: number } }) =>
      transportApi.markTripDelay(tripId, body),
    onSuccess: () => {
      setNotice('Trip delay status updated.');
      invalidateTransport();
    },
  });
  const tripHistoryCsvMutation = useMutation({
    mutationFn: transportApi.downloadTripHistoryCsv,
    onSuccess: () => setNotice('Trip history CSV downloaded.'),
  });
  const tripDetailsQuery = useQuery({
    queryKey: ['transport-trip-details', viewingTripId],
    queryFn: () => transportApi.getTripDetails(viewingTripId!),
    enabled: Boolean(viewingTripId),
  });

  const routes = routesQuery.data ?? [];
  const stops = stopsQuery.data ?? [];
  const vehicles = vehiclesQuery.data ?? [];
  const driverAssignments = driversQuery.data ?? [];
  const studentAssignments = studentsQuery.data ?? [];
  const activeTrips = activeTripsQuery.data ?? [];
  const trips = tripsQuery.data ?? [];
  const selectedTrip = activeTrips.find((trip) => trip.id === selectedTripId) ?? trips.find((trip) => trip.id === selectedTripId);
  const locationFreshness = getLocationFreshness(locationQuery.data?.recordedAt);
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
  const activeTripsMissingDriver = activeTrips.filter(
    (trip) => !trip.driverAssignmentId,
  ).length;
  const activeTripsMissingStudents = activeTrips.filter(
    (trip) => (trip.studentStatuses ?? []).length === 0,
  ).length;
  const delayedActiveTrips = activeTrips.filter((trip) => trip.isDelayed).length;

  const stats = {
    activeTrips: reportsQuery.data?.activeTrips ?? activeTrips.length,
    activeAssignments: reportsQuery.data?.activeAssignments ?? 0,
    logsToday: reportsQuery.data?.logsToday ?? 0,
    studentsOnboard,
    studentsNotBoarded,
    vehiclesActive: vehicles.filter((vehicle) => vehicle.status === 'ACTIVE').length,
    driversOnline,
    vehicleAlerts: vehicles.filter(v => {
      const dates = [
        v.fitnessCertificateExp,
        v.insuranceExpiry,
        v.registrationExpiry,
        v.pollutionExpiry,
        v.documentExpiry
      ].filter(Boolean) as string[];
      return dates.some(d => new Date(d) < addDays(new Date(), 30));
    }).length,
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
      {notice && (
        <Notice tone="success" message={notice} onDismiss={() => setNotice(null)} />
      )}
      {firstError && <Notice tone="error" message={(firstError as Error).message} />}

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Active Trips" value={stats.activeTrips} icon={<Navigation size={18} />} loading={activeTripsQuery.isLoading || reportsQuery.isLoading} />
            <StatCard title="Routes" value={routes.length} icon={<MapPin size={18} />} loading={routesQuery.isLoading} />
            <StatCard title="Vehicles" value={vehicles.length} icon={<Bus size={18} />} loading={vehiclesQuery.isLoading} />
            <StatCard title="Drivers Assigned" value={driverAssignments.length} icon={<ShieldCheck size={18} />} loading={driversQuery.isLoading} />
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

              <RouteOperationsPanel
                routes={routes}
                stops={stops}
                studentAssignments={studentAssignments}
                activeTrips={activeTrips}
              />

              <TripList 
                trips={activeTrips} 
                emptyTitle="No active trips" 
                onSelect={setViewingTripId} 
                onDelay={(tripId, isDelayed) => setDelayingTrip({ tripId, isDelayed })}
                onComplete={(tripId) => setConfirmingTripAction({ action: 'complete', tripId })}
              />
              
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
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-slate-400">
                        {vehicle.fitnessCertificateExp && (
                          <p>Fitness: {new Date(vehicle.fitnessCertificateExp).toLocaleDateString()}</p>
                        )}
                        {vehicle.insuranceExpiry && (
                          <p>Insurance: {new Date(vehicle.insuranceExpiry).toLocaleDateString()}</p>
                        )}
                        {vehicle.registrationExpiry && (
                          <p>Reg: {new Date(vehicle.registrationExpiry).toLocaleDateString()}</p>
                        )}
                        {vehicle.pollutionExpiry && (
                          <p>Pollution: {new Date(vehicle.pollutionExpiry).toLocaleDateString()}</p>
                        )}
                      </div>
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
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="Fitness Exp" type="date" value={vehicleForm.fitnessCertificateExp ?? ''} onChange={(fitnessCertificateExp) => setVehicleForm({ ...vehicleForm, fitnessCertificateExp })} />
                <TextInput label="Insurance Exp" type="date" value={vehicleForm.insuranceExpiry ?? ''} onChange={(insuranceExpiry) => setVehicleForm({ ...vehicleForm, insuranceExpiry })} />
                <TextInput label="Registration Exp" type="date" value={vehicleForm.registrationExpiry ?? ''} onChange={(registrationExpiry) => setVehicleForm({ ...vehicleForm, registrationExpiry })} />
                <TextInput label="Pollution Exp" type="date" value={vehicleForm.pollutionExpiry ?? ''} onChange={(pollutionExpiry) => setVehicleForm({ ...vehicleForm, pollutionExpiry })} />
              </div>
              <TextInput label="Other Doc Exp" type="date" value={vehicleForm.documentExpiry ?? ''} onChange={(documentExpiry) => setVehicleForm({ ...vehicleForm, documentExpiry })} />
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
              <SelectInput label="Student" value={studentForm.studentId} onChange={(studentId) => setStudentForm({ ...studentForm, studentId })} required options={(schoolStudentsQuery.data?.items ?? []).map((student) => ({ label: studentLabel(student) || student.id, value: student.id }))} />
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
            <TripList
              trips={activeTrips}
              emptyTitle="No active trips"
              onComplete={(tripId) => setConfirmingTripAction({ action: 'complete', tripId })}
              onCancel={(tripId) => setConfirmingTripAction({ action: 'cancel', tripId })}
              onSelect={setViewingTripId}
              onDelay={(tripId, isDelayed) => setDelayingTrip({ tripId, isDelayed })}
              showLocationWarning
            />
          </Panel>
          <Panel title="Trip History" description="Current trip history returned by the backend; live route replay can come later.">
            <TripList trips={trips.slice(0, 8)} emptyTitle="No trip history" compact />
          </Panel>
          <Panel title="Safety boundary" description="Current trip visibility and privacy checks for transport operators.">
            <div className="space-y-4" data-testid="transport-safety-boundary-panel">
              <div className="grid gap-3 sm:grid-cols-3">
                <SafetyMetric
                  label="Missing driver"
                  value={activeTripsMissingDriver}
                  warning={activeTripsMissingDriver > 0}
                />
                <SafetyMetric
                  label="No manifest"
                  value={activeTripsMissingStudents}
                  warning={activeTripsMissingStudents > 0}
                />
                <SafetyMetric
                  label="Delayed"
                  value={delayedActiveTrips}
                  warning={delayedActiveTrips > 0}
                />
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <p className="font-bold">Parent visibility stays scoped</p>
                <p className="mt-1">
                  Operators can verify latest coordinates and manifests here; parent-facing transport stays limited to each guardian&apos;s child, assigned trip, and safe status summaries.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary" onClick={() => setActiveTab('location')}>
                  Check latest location
                </button>
                <button type="button" className="btn-secondary" onClick={() => setActiveTab('assignments')}>
                  Review assignments
                </button>
              </div>
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
          <Panel title="Report filters" description="Filter backend report rows and download the audited full trip-history CSV export.">
            <div className="grid gap-4 lg:grid-cols-3">
              <SelectInput
                label="Route"
                value={reportRouteId}
                onChange={setReportRouteId}
                options={routes.map((route) => ({ label: route.name, value: route.id }))}
              />
              <SelectInput
                label="Vehicle"
                value={reportVehicleId}
                onChange={setReportVehicleId}
                options={vehicles.map((vehicle) => ({ label: vehicle.registrationNumber, value: vehicle.id }))}
              />
              <SelectInput
                label="Driver assignment"
                value={reportDriverAssignmentId}
                onChange={setReportDriverAssignmentId}
                options={driverAssignments.map((assignment) => ({
                  label: `${assignment.staff?.firstName ?? ''} ${assignment.staff?.lastName ?? ''}`.trim() || assignment.staffId,
                  value: assignment.id,
                }))}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="btn-secondary inline-flex items-center gap-2"
                disabled={tripHistoryCsvMutation.isPending}
                onClick={() => tripHistoryCsvMutation.mutate()}
                data-testid="transport-trip-history-csv-export"
              >
                <Download className="h-4 w-4" />
                {tripHistoryCsvMutation.isPending ? 'Exporting...' : 'Export full trip CSV'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setReportRouteId('');
                  setReportVehicleId('');
                  setReportDriverAssignmentId('');
                }}
              >
                Clear filters
              </button>
            </div>
            {tripHistoryCsvMutation.error ? (
              <Notice tone="error" message={tripHistoryCsvMutation.error.message} />
            ) : null}
          </Panel>
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
          <InfoCard title="Reporting boundary" lines={['Trip-history CSV export uses server-side generation and audit logging.', 'Reporting data is restricted to authorized transport administrators only.']} />
        </div>
      )}

      {activeTab === 'location' && (
        <TwoColumn>
          <Panel
            title="Latest location"
            description="Map and WebSocket live tracking will be added later; this reads the latest backend location."
          >
            <SelectInput
              label="Trip"
              value={selectedTripId}
              onChange={setSelectedTripId}
              options={[...activeTrips, ...trips].map((trip) => ({
                label: `${trip.route?.name ?? trip.routeId} • ${trip.status} (${trip.direction})`,
                value: trip.id,
              }))}
            />
            {locationQuery.isFetching ? (
              <LoadingState label="Loading latest location..." />
            ) : null}
            {locationQuery.data ? (
              <div className="mt-4 space-y-4">
                <div
                  className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                  data-testid="transport-location-freshness-panel"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                        Selected trip
                      </p>
                      <p className="mt-1 font-bold text-slate-900">
                        {selectedTrip?.route?.name ??
                          selectedTrip?.routeId ??
                          'Trip selected'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider',
                        locationFreshness.className,
                      )}
                    >
                      {locationFreshness.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <LocationMetric
                      label="Latitude"
                      value={locationQuery.data.latitude}
                    />
                    <LocationMetric
                      label="Longitude"
                      value={locationQuery.data.longitude}
                    />
                    <LocationMetric
                      label="Speed"
                      value={`${locationQuery.data.speedKph ?? '0'} km/h`}
                    />
                    <LocationMetric
                      label="Recorded"
                      value={formatDateTime(locationQuery.data.recordedAt)}
                    />
                  </div>
                  <div
                    className={cn(
                      'mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-bold',
                      locationFreshness.noticeClassName,
                    )}
                  >
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>{locationFreshness.message}</span>
                  </div>
                </div>
                <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-100 text-slate-400">
                  <MapPin size={32} />
                  <span className="ml-2 font-semibold">Map Preview Deferred</span>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No location selected"
                description="Select an active or recent trip to read its latest location."
              />
            )}
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

      <ConfirmDialog
        isOpen={Boolean(confirmingTripAction)}
        onClose={() => setConfirmingTripAction(null)}
        onConfirm={() => {
          if (confirmingTripAction?.action === 'complete') {
            completeTripMutation.mutate(confirmingTripAction.tripId);
          }
          if (confirmingTripAction?.action === 'cancel') {
            cancelTripMutation.mutate({ tripId: confirmingTripAction.tripId, reason: 'Cancelled from admin transport console' });
          }
          setConfirmingTripAction(null);
        }}
        title={confirmingTripAction?.action === 'cancel' ? 'Cancel active trip?' : 'Complete active trip?'}
        description={
          confirmingTripAction?.action === 'cancel'
            ? 'This cancels the trip and records the action through the backend. Use cancellation only when the trip will not continue.'
            : 'This completes the active trip and closes boarding/drop tracking for this route run.'
        }
        confirmLabel={confirmingTripAction?.action === 'cancel' ? 'Cancel trip' : 'Complete trip'}
        variant={confirmingTripAction?.action === 'cancel' ? 'destructive' : 'default'}
        isConfirming={completeTripMutation.isPending || cancelTripMutation.isPending}
      />

      <ConfirmDialog
        isOpen={Boolean(delayingTrip)}
        onClose={() => setDelayingTrip(null)}
        onConfirm={() => {
          if (delayingTrip) {
            markDelayMutation.mutate({
              tripId: delayingTrip.tripId,
              body: {
                isDelayed: delayingTrip.isDelayed,
                delayReason: delayingTrip.delayReason,
              },
            });
          }
          setDelayingTrip(null);
        }}
        title={delayingTrip?.isDelayed ? 'Mark trip as delayed?' : 'Remove delay status?'}
        description={
          delayingTrip?.isDelayed
            ? 'This will flag the trip as delayed for administrators and optionally notify parents if broadcasting is enabled.'
            : 'This will remove the delay flag from the trip.'
        }
        confirmLabel={delayingTrip?.isDelayed ? 'Mark Delayed' : 'Remove Delay'}
        variant="default"
        isConfirming={markDelayMutation.isPending}
      >
        {delayingTrip?.isDelayed && (
          <div className="mt-4">
            <TextInput
              label="Delay Reason"
              placeholder="Traffic, weather, vehicle issue..."
              value={delayingTrip.delayReason ?? ''}
              onChange={(delayReason) => setDelayingTrip({ ...delayingTrip, delayReason })}
            />
          </div>
        )}
      </ConfirmDialog>

      {viewingTripId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Trip Details</h2>
              <button type="button" onClick={() => setViewingTripId(null)} className="text-sm font-bold text-slate-400 hover:text-slate-900">Close</button>
            </div>

            {tripDetailsQuery.isLoading ? <LoadingState label="Loading details..." /> : null}
            {tripDetailsQuery.data && (
              <div className="mt-6 space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Route</p>
                    <p className="mt-1 font-bold text-slate-900">{tripDetailsQuery.data.route?.name}</p>
                    <p className="text-sm text-slate-500">{tripDetailsQuery.data.route?.code}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vehicle</p>
                    <p className="mt-1 font-bold text-slate-900">{tripDetailsQuery.data.vehicle?.registrationNumber}</p>
                    <p className="text-sm text-slate-500">{tripDetailsQuery.data.vehicle?.model}</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 mb-3">Stop Timeline</h3>
                  <div className="space-y-4">
                    {tripDetailsQuery.data.route?.stops?.map((stop: any, idx: number) => {
                      const studentStatus = tripDetailsQuery.data.studentStatuses?.find((s: any) => s.stopId === stop.id);
                      return (
                        <div key={stop.id} className="relative flex gap-4 pl-6">
                          {idx < (tripDetailsQuery.data.route?.stops?.length ?? 0) - 1 && (
                            <div className="absolute left-[7px] top-4 h-full w-0.5 bg-slate-200" />
                          )}
                          <div className="absolute left-0 top-1 h-4 w-4 rounded-full border-2 border-white bg-slate-400 shadow-sm" />
                          <div className="flex-1">
                            <p className="font-bold text-sm text-slate-900">{stop.name}</p>
                            <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                              <span>Pickup: {stop.estimatedPickup ?? '--'}</span>
                              <span>Drop: {stop.estimatedDrop ?? '--'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 mb-3">Onboard Students ({tripDetailsQuery.data.studentStatuses?.filter((s: any) => s.status === 'BOARDED').length})</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {tripDetailsQuery.data.studentStatuses?.map((status: any) => (
                      <div key={status.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-sm">
                        <span className="font-semibold text-slate-700">{status.student?.firstNameEn} {status.student?.lastNameEn}</span>
                        <TransportStatusBadge status={status.status} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
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

function RouteOperationsPanel({
  routes,
  stops,
  studentAssignments,
  activeTrips,
}: {
  routes: TransportRoute[];
  stops: TransportStop[];
  studentAssignments: TransportStudentAssignment[];
  activeTrips: TransportTrip[];
}) {
  if (routes.length === 0) {
    return <EmptyState title="No route dashboard" description="Create transport routes before route operations can be summarized." />;
  }

  return (
    <Panel title="Route Operations" description="Route-level stops, assigned students, active trips, and delay pressure." >
      <div className="space-y-3" data-testid="transport-route-dashboard-panel">
        {routes.slice(0, 6).map((route) => {
          const routeStops = route.stops ?? stops.filter((stop) => stop.routeId === route.id);
          const routeAssignments = studentAssignments.filter(
            (assignment) => assignment.routeId === route.id && assignment.status === 'ACTIVE',
          );
          const routeTrips = activeTrips.filter((trip) => trip.routeId === route.id);
          const delayedTrips = routeTrips.filter((trip) => trip.isDelayed).length;

          return (
            <div key={route.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">{route.name}</h3>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {route.code} - {route.vehicle?.registrationNumber ?? 'No vehicle linked'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <TransportStatusBadge status={route.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  {delayedTrips > 0 ? <TransportStatusBadge status="DELAYED" /> : null}
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <RouteMetric label="Stops" value={routeStops.length} />
                <RouteMetric label="Students" value={routeAssignments.length} />
                <RouteMetric label="Active trips" value={routeTrips.length} />
                <RouteMetric label="Delayed" value={delayedTrips} warning={delayedTrips > 0} />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function RouteMetric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div className={cn('rounded-xl border px-3 py-2', warning ? 'border-red-100 bg-red-50 text-red-700' : 'border-white bg-white text-slate-600')}>
      <p className="text-[10px] font-bold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}

function LocationMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 break-words font-bold text-slate-950">{value}</p>
    </div>
  );
}

function SafetyMetric({
  label,
  value,
  warning,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2',
        warning
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-slate-100 bg-slate-50 text-slate-600',
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function TripList({ trips, emptyTitle, onComplete, onCancel, onSelect, onDelay, compact, showLocationWarning }: { trips: TransportTrip[]; emptyTitle: string; onComplete?: (tripId: string) => void; onCancel?: (tripId: string) => void; onSelect?: (tripId: string) => void; onDelay?: (tripId: string, isDelayed: boolean) => void; compact?: boolean; showLocationWarning?: boolean }) {
  if (trips.length === 0) return <EmptyState title={emptyTitle} description="Trip records will appear here." />;

  return (
    <div className="space-y-3">
      {trips.map((trip) => (
        <div key={trip.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900">{trip.route?.name ?? trip.routeId}</h3>
                {trip.isDelayed && (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                    <AlertTriangle size={10} className="mr-1" /> DELAYED
                  </span>
                )}
              </div>
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
              {trip.isDelayed && trip.delayReason && (
                <p className="mt-2 text-xs font-bold text-red-600">Reason: {trip.delayReason}</p>
              )}
              {showLocationWarning ? (
                <p className="mt-2 text-xs font-semibold text-amber-600">
                  Open Details or Location to verify the latest backend coordinate before parent updates.
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              {onDelay && trip.status === 'ACTIVE' && (
                <button 
                  type="button" 
                  className={cn("text-xs font-bold", trip.isDelayed ? "text-slate-400" : "text-orange-600 hover:text-orange-700")}
                  onClick={() => onDelay(trip.id, !trip.isDelayed)}
                >
                  {trip.isDelayed ? 'Clear Delay' : 'Mark Delay'}
                </button>
              )}
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

function TextInput({ label, value, onChange, placeholder, type = 'text', required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input required={required} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="input-control mt-1" />
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

function getLocationFreshness(recordedAt?: string | null) {
  if (!recordedAt) {
    return {
      label: 'No ping',
      className: 'bg-slate-100 text-slate-600',
      noticeClassName: 'bg-slate-100 text-slate-700',
      message: 'No backend coordinate has been recorded for this trip yet.',
    };
  }

  const ageMs = Date.now() - new Date(recordedAt).getTime();
  const ageMinutes = Math.max(0, Math.round(ageMs / 60000));

  if (ageMs > 10 * 60 * 1000) {
    return {
      label: 'Stale',
      className: 'bg-red-100 text-red-700',
      noticeClassName: 'bg-red-100 text-red-700',
      message: `Last backend coordinate is ${ageMinutes} minutes old. Confirm with the driver before sharing transport updates.`,
    };
  }

  if (ageMs > 2 * 60 * 1000) {
    return {
      label: 'Delayed',
      className: 'bg-amber-100 text-amber-700',
      noticeClassName: 'bg-amber-100 text-amber-800',
      message: `Last backend coordinate is ${ageMinutes} minutes old. Treat the trip position as approximate.`,
    };
  }

  return {
    label: 'Fresh',
    className: 'bg-emerald-100 text-emerald-700',
    noticeClassName: 'bg-emerald-100 text-emerald-800',
    message: 'Latest backend coordinate is fresh enough for admin monitoring.',
  };
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
