'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { AlertTriangle, Bus, MapPin, Navigation, ShieldCheck, Users } from 'lucide-react';
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
  | 'location';

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
  const activeTripsQuery = useQuery({ queryKey: ['transport-active-trips'], queryFn: transportApi.listActiveTrips });
  const tripsQuery = useQuery({ queryKey: ['transport-trips'], queryFn: () => transportApi.listTrips() });
  const reportsQuery = useQuery({ queryKey: ['transport-reports'], queryFn: transportApi.getReports });
  const schoolStudentsQuery = useQuery({ queryKey: ['students-for-transport'], queryFn: api.listStudents });
  const staffQuery = useQuery({ queryKey: ['staff-for-transport'], queryFn: api.listStaff });
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
    delayedRoutes: 0,
    studentsOnboard,
    studentsNotBoarded,
    vehiclesActive: vehicles.filter((vehicle) => vehicle.status === 'ACTIVE').length,
    driversOnline,
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard title="Active Trips" value={stats.activeTrips} icon={<Navigation size={18} />} loading={activeTripsQuery.isLoading || reportsQuery.isLoading} />
            <StatCard title="Delayed Routes" value={stats.delayedRoutes} icon={<AlertTriangle size={18} />} loading={reportsQuery.isLoading} />
            <StatCard title="Students Onboard" value={stats.studentsOnboard} icon={<Users size={18} />} loading={activeTripsQuery.isLoading} />
            <StatCard title="Students Not Boarded" value={stats.studentsNotBoarded} icon={<Users size={18} />} loading={activeTripsQuery.isLoading} />
            <StatCard title="Vehicles Active" value={stats.vehiclesActive} icon={<Bus size={18} />} loading={vehiclesQuery.isLoading} />
            <StatCard title="Drivers Online" value={stats.driversOnline} icon={<ShieldCheck size={18} />} loading={activeTripsQuery.isLoading} />
          </div>
          <InfoCard title="Overview data notes" lines={['Delayed route status is not exposed by the current API yet, so the dashboard shows 0 until a backend delay signal exists.', 'Students onboard and not boarded are derived from active trip student status records when the trip payload includes them.', 'Drivers online is derived from drivers attached to active trips; driver app presence is a later backend feature.']} />
          <InfoCard title="Privacy and safety rules" lines={['Parents will only see their own child’s assigned vehicle/trip in the future parent view.', 'Driver app will only expose trips assigned to that driver later.', 'Never expose a full bus passenger list to parents.', 'Live map/WebSocket tracking is intentionally deferred; this admin slice shows latest coordinates only.']} />
          <TripList trips={activeTrips} emptyTitle="No active trips" />
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
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">{route.stops?.length ?? stops.filter((stop) => stop.routeId === route.id).length} stops</span>
                  </div>
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
                  <h3 className="font-bold text-slate-900">{vehicle.registrationNumber}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-sm text-slate-500">{vehicle.model || 'Model not set'} • {vehicle.capacity} seats</p>
                    <TransportStatusBadge status={vehicle.status} />
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
                <RecordCard key={assignment.id} title={studentLabel(assignment.student) || assignment.studentId} subtitle={`${assignment.route?.name ?? assignment.routeId} • ${assignment.stop?.name ?? assignment.stopId}`} badge={<TransportStatusBadge status={assignment.status} />} />
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
            <TripList trips={activeTrips} emptyTitle="No active trips" onComplete={(tripId) => completeTripMutation.mutate(tripId)} onSelect={setSelectedTripId} />
          </Panel>
          <Panel title="Trip History" description="Current trip history returned by the backend; live route replay can come later.">
            <TripList trips={trips.slice(0, 8)} emptyTitle="No trip history" compact />
          </Panel>
          <Panel title="Parent Tracking Controls" description="Foundation placeholder for future school-level visibility controls.">
            <p className="text-sm leading-6 text-slate-600">
              Parent tracking controls will allow schools to decide when parents can view bus status. Parents will only see their own child’s assigned vehicle/trip.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <TransportStatusBadge status="READY" />
              <TransportStatusBadge status="BUS_ARRIVING" />
              <TransportStatusBadge status="DELAYED" />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Live map/WebSocket UI and driver app controls are marked for a later sprint.
            </p>
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

      {activeTab === 'location' && (
        <TwoColumn>
          <Panel title="Latest location" description="Map and WebSocket live tracking will be added later; this reads the latest backend location.">
            <SelectInput label="Trip" value={selectedTripId} onChange={setSelectedTripId} options={[...activeTrips, ...trips].map((trip) => ({ label: `${trip.route?.name ?? trip.routeId} • ${trip.status}`, value: trip.id }))} />
            {locationQuery.isFetching ? <LoadingState label="Loading latest location..." /> : null}
            {locationQuery.data ? (
              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                <p><strong>Latitude:</strong> {locationQuery.data.latitude}</p>
                <p><strong>Longitude:</strong> {locationQuery.data.longitude}</p>
                <p><strong>Speed:</strong> {locationQuery.data.speedKph ?? 'Not set'} km/h</p>
                <p><strong>Heading:</strong> {locationQuery.data.heading ?? 'Not set'}</p>
                <p><strong>Recorded:</strong> {formatDateTime(locationQuery.data.recordedAt)}</p>
              </div>
            ) : <EmptyState title="No location selected" description="Select an active or recent trip to read its latest location." />}
          </Panel>
          <Panel title="Manual location ping" description="Useful for API smoke testing until the driver app sends GPS automatically.">
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (selectedTripId) pingMutation.mutate({ tripId: selectedTripId, body: pingForm }); }}>
              <TextInput label="Latitude" type="number" value={String(pingForm.latitude)} onChange={(value) => setPingForm({ ...pingForm, latitude: Number(value) })} />
              <TextInput label="Longitude" type="number" value={String(pingForm.longitude)} onChange={(value) => setPingForm({ ...pingForm, longitude: Number(value) })} />
              <TextInput label="Speed KPH" type="number" value={pingForm.speedKph?.toString() ?? ''} onChange={(value) => setPingForm({ ...pingForm, speedKph: value ? Number(value) : undefined })} />
              <button type="submit" className="btn-primary" disabled={!selectedTripId || pingMutation.isPending}>{pingMutation.isPending ? 'Recording...' : 'Record ping'}</button>
            </form>
          </Panel>
          <Panel title="Live map later" description="Realtime map, ETA, geofence, and WebSocket/SSE updates remain out of this admin polish sprint.">
            <InfoCard title="Safety boundary" lines={['Admin location tools use existing backend location APIs only.', 'Parent-facing map access must stay child-scoped when it is built.', 'Driver app GPS automation will come later.']} />
          </Panel>
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

function TripList({ trips, emptyTitle, onComplete, onSelect, compact }: { trips: TransportTrip[]; emptyTitle: string; onComplete?: (tripId: string) => void; onSelect?: (tripId: string) => void; compact?: boolean }) {
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
                {trip.status === 'COMPLETED' ? <TransportStatusBadge status="ROUTE_COMPLETED" /> : null}
              </div>
              {!compact ? <p className="mt-1 text-xs text-slate-400">Students: {trip.studentStatuses?.length ?? 0}</p> : null}
            </div>
            <div className="flex gap-2">
              {onSelect ? <button type="button" className="btn-secondary" onClick={() => onSelect(trip.id)}>Select</button> : null}
              {onComplete && trip.status === 'ACTIVE' ? <button type="button" className="btn-primary" onClick={() => onComplete(trip.id)}>Complete</button> : null}
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
