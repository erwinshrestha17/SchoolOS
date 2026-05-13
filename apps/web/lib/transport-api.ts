import { clearStoredSession } from './session';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

type JsonBody = Record<string, unknown>;

type RequestOptions = RequestInit & {
  json?: JsonBody;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
};

let refreshPromise: Promise<boolean> | null = null;

export type TransportVehicleStatus = 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';
export type TransportEnrollmentStatus = 'ACTIVE' | 'PAUSED' | 'ENDED';
export type TransportBoardingStatus = 'BOARDED' | 'DROPPED' | 'MISSED';
export type TransportTripStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type TransportTripDirection = 'PICKUP' | 'DROP';
export type TransportStudentTripStatus =
  | 'PENDING'
  | 'BOARDED'
  | 'DROPPED'
  | 'ABSENT';

export type TransportStudentSummary = {
  id: string;
  studentSystemId?: string;
  firstNameEn?: string;
  lastNameEn?: string;
};

export type TransportStaffSummary = {
  id: string;
  employeeId?: string;
  firstName?: string;
  lastName?: string;
};

export type TransportRoute = {
  id: string;
  tenantId?: string;
  name: string;
  code: string;
  vehicleId?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  stops?: TransportStop[];
  vehicle?: TransportVehicle | null;
};

export type TransportStop = {
  id: string;
  tenantId?: string;
  routeId: string;
  name: string;
  sequence: number;
  estimatedPickup?: string | null;
  estimatedDrop?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  createdAt?: string;
  updatedAt?: string;
  route?: TransportRoute;
};

export type TransportVehicle = {
  id: string;
  tenantId?: string;
  registrationNumber: string;
  capacity: number;
  status: TransportVehicleStatus;
  fitnessCertificateExp?: string | null;
  insuranceExpiry?: string | null;
  registrationExpiry?: string | null;
  pollutionExpiry?: string | null;
  model?: string | null;
  documentExpiry?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type TransportDriverAssignment = {
  id: string;
  tenantId?: string;
  vehicleId: string;
  routeId?: string | null;
  staffId: string;
  licenseNumber?: string | null;
  licenseExpires?: string | null;
  startsAt: string;
  endsAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  vehicle?: TransportVehicle;
  route?: TransportRoute | null;
  staff?: TransportStaffSummary;
};

export type TransportStudentAssignment = {
  id: string;
  tenantId?: string;
  studentId: string;
  routeId: string;
  stopId: string;
  pickupDirection: TransportTripDirection;
  status: TransportEnrollmentStatus;
  startedAt: string;
  endedAt?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  student?: TransportStudentSummary;
  route?: TransportRoute;
  stop?: TransportStop;
};

export type TransportTripStudentStatusRecord = {
  id: string;
  tenantId?: string;
  tripId: string;
  studentAssignmentId: string;
  studentId: string;
  stopId: string;
  status: TransportStudentTripStatus;
  boardedAt?: string | null;
  droppedAt?: string | null;
  notes?: string | null;
  student?: TransportStudentSummary;
  stop?: TransportStop;
};

export type TransportTrip = {
  id: string;
  tenantId?: string;
  routeId: string;
  vehicleId: string;
  driverAssignmentId: string;
  direction: TransportTripDirection;
  status: TransportTripStatus;
  startedAt: string;
  completedAt?: string | null;
  isDelayed: boolean;
  delayMinutes?: number | null;
  delayReason?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  route?: TransportRoute;
  vehicle?: TransportVehicle;
  driverAssignment?: TransportDriverAssignment;
  studentStatuses?: TransportTripStudentStatusRecord[];
};

export type TransportLocationPing = {
  id?: string;
  tenantId?: string;
  tripId: string;
  vehicleId?: string;
  driverAssignmentId?: string | null;
  latitude: string | number;
  longitude: string | number;
  speedKph?: string | number | null;
  heading?: string | number | null;
  recordedAt: string;
  createdAt?: string;
};

export type TransportLog = {
  id: string;
  tenantId?: string;
  routeId: string;
  stopId?: string | null;
  vehicleId?: string | null;
  enrollmentId?: string | null;
  studentId?: string | null;
  status: TransportBoardingStatus;
  occurredAt: string;
  note?: string | null;
  route?: TransportRoute;
  stop?: TransportStop | null;
  vehicle?: TransportVehicle | null;
  student?: TransportStudentSummary | null;
};

export type TransportReports = {
  activeAssignments: number;
  activeTrips: number;
  logsToday: number;
  vehicleFitnessAlerts: any[];
  driverLicenseAlerts: any[];
};

export type TransportRoutePayload = {
  name: string;
  code: string;
  isActive?: boolean;
  vehicleId?: string;
  stops: TransportStopPayload[];
};

export type TransportStopPayload = {
  routeId: string;
  name: string;
  sequence: number;
  estimatedPickup?: string;
  estimatedDrop?: string;
  latitude?: number;
  longitude?: number;
};

export type TransportVehiclePayload = {
  registrationNumber: string;
  model?: string;
  capacity: number;
  fitnessCertificateExp?: string;
  insuranceExpiry?: string;
  registrationExpiry?: string;
  pollutionExpiry?: string;
  documentExpiry?: string;
  status?: string;
};

export type TransportDriverAssignmentPayload = {
  vehicleId: string;
  routeId?: string;
  staffId: string;
  licenseNumber?: string;
  licenseExpires?: string;
  startsAt: string;
  endsAt?: string;
};

export type TransportStudentAssignmentPayload = {
  studentId: string;
  routeId: string;
  stopId: string;
  feeAmount?: number;
  startedAt?: string;
};

export type TransportTripPayload = {
  routeId: string;
  vehicleId: string;
  driverAssignmentId?: string;
  direction: TransportTripDirection;
  notes?: string;
};

export type TransportStudentStatusPayload = {
  studentId: string;
  absent?: boolean;
  notes?: string;
};

export type TransportLocationPingPayload = {
  latitude: number;
  longitude: number;
  speedKph?: number;
  heading?: number;
  recordedAt?: string;
};

function withQuery(
  path: string,
  params: Record<string, string | number | undefined | null>,
) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: init?.json ? JSON.stringify(init.json) : init?.body,
  });

  if (!response.ok) {
    if (
      response.status === 401 &&
      init?.auth !== false &&
      init?.retryOnUnauthorized !== false &&
      (await refreshAccessCookie())
    ) {
      return request<T>(path, { ...init, retryOnUnauthorized: false });
    }

    const text = await response.text();

    if (response.status === 401 && init?.auth !== false) {
      clearStoredSession();
    }

    throw new Error(
      parseApiErrorMessage(text) || `Request failed with status ${response.status}`,
    );
  }

  const payload = (await response.json()) as ApiResponse<T>;
  return payload.data;
}

function parseApiErrorMessage(text: string) {
  if (!text) return '';

  try {
    const payload = JSON.parse(text) as {
      message?: string | string[];
      error?: string;
    };
    const message = Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message;

    return message || payload.error || text;
  } catch {
    return text;
  }
}

async function refreshAccessCookie() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      return response.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export const transportApi = {
  listRoutes: (params?: { q?: string | null }) =>
    request<TransportRoute[]>(withQuery('/transport/routes', params ?? {})),
  createRoute: (body: TransportRoutePayload) =>
    request<TransportRoute>('/transport/routes', { method: 'POST', json: body }),
  updateRoute: (routeId: string, body: Partial<TransportRoutePayload>) =>
    request<TransportRoute>(`/transport/routes/${encodeURIComponent(routeId)}`, {
      method: 'PATCH',
      json: body,
    }),
  listStops: (params?: { routeId?: string | null }) =>
    request<TransportStop[]>(withQuery('/transport/stops', params ?? {})),
  createStop: (body: TransportStopPayload) =>
    request<TransportStop>('/transport/stops', { method: 'POST', json: body }),
  updateStop: (stopId: string, body: Partial<TransportStopPayload>) =>
    request<TransportStop>(`/transport/stops/${encodeURIComponent(stopId)}`, {
      method: 'PATCH',
      json: body,
    }),
  listVehicles: (params?: { q?: string | null }) =>
    request<TransportVehicle[]>(withQuery('/transport/vehicles', params ?? {})),
  createVehicle: (body: TransportVehiclePayload) =>
    request<TransportVehicle>('/transport/vehicles', {
      method: 'POST',
      json: body,
    }),
  updateVehicle: (vehicleId: string, body: Partial<TransportVehiclePayload>) =>
    request<TransportVehicle>(
      `/transport/vehicles/${encodeURIComponent(vehicleId)}`,
      { method: 'PATCH', json: body },
    ),
  listDriverAssignments: (params?: {
    routeId?: string | null;
    vehicleId?: string | null;
  }) =>
    request<TransportDriverAssignment[]>(
      withQuery('/transport/assignments/drivers', params ?? {}),
    ),
  createDriverAssignment: (body: TransportDriverAssignmentPayload) =>
    request<TransportDriverAssignment>('/transport/assignments/drivers', {
      method: 'POST',
      json: body,
    }),
  listStudentAssignments: (params?: {
    routeId?: string | null;
    studentId?: string | null;
  }) =>
    request<TransportStudentAssignment[]>(
      withQuery('/transport/assignments/students', params ?? {}),
    ),
  createStudentAssignment: (body: TransportStudentAssignmentPayload) =>
    request<TransportStudentAssignment>('/transport/assignments/students', {
      method: 'POST',
      json: body,
    }),
  startTrip: (body: TransportTripPayload) =>
    request<TransportTrip>('/transport/trips', { method: 'POST', json: body }),
  completeTrip: (tripId: string, body?: { notes?: string }) =>
    request<TransportTrip>(`/transport/trips/${encodeURIComponent(tripId)}/complete`, {
      method: 'PATCH',
      json: body ?? {},
    }),
  markStudentBoarded: (tripId: string, body: TransportStudentStatusPayload) =>
    request<TransportTripStudentStatusRecord>(
      `/transport/trips/${encodeURIComponent(tripId)}/students/boarded`,
      { method: 'PATCH', json: body },
    ),
  markStudentDropped: (tripId: string, body: TransportStudentStatusPayload) =>
    request<TransportTripStudentStatusRecord>(
      `/transport/trips/${encodeURIComponent(tripId)}/students/dropped`,
      { method: 'PATCH', json: body },
    ),
  listActiveTrips: () => request<TransportTrip[]>('/transport/trips/active'),
  listTrips: (params?: { routeId?: string | null; vehicleId?: string | null }) =>
    request<TransportTrip[]>(withQuery('/transport/trips/history', params ?? {})),
  createLocationPing: (tripId: string, body: TransportLocationPingPayload) =>
    request<TransportLocationPing>(
      `/transport/trips/${encodeURIComponent(tripId)}/location`,
      { method: 'POST', json: body },
    ),
  getLatestLocation: (tripId: string) =>
    request<TransportLocationPing | null>(
      `/transport/trips/${encodeURIComponent(tripId)}/location/latest`,
    ),
  listLogs: (params?: { routeId?: string | null }) =>
    request<TransportLog[]>(withQuery('/transport/logs', params ?? {})),
  getReports: () => request<TransportReports>('/transport/reports'),
  cancelTrip: (tripId: string, body?: { reason?: string }) =>
    request<TransportTrip>(`/transport/trips/${encodeURIComponent(tripId)}/cancel`, {
      method: 'PATCH',
      json: body ?? {},
    }),
  pauseStudentAssignment: (assignmentId: string) =>
    request<any>(
      `/transport/assignments/students/${encodeURIComponent(assignmentId)}/pause`,
      { method: 'PATCH' },
    ),
  endStudentAssignment: (assignmentId: string) =>
    request<any>(
      `/transport/assignments/students/${encodeURIComponent(assignmentId)}/end`,
      { method: 'PATCH' },
    ),
  getTripHistoryReport: (params?: {
    routeId?: string;
    vehicleId?: string;
    driverAssignmentId?: string;
  }) =>
    request<{ items: any[]; meta: { total: number } }>(
      withQuery('/transport/reports/trips', params ?? {}),
    ),
  getBoardingReport: (params?: { tripId?: string; studentId?: string }) =>
    request<{ items: any[]; meta: { total: number } }>(
      withQuery('/transport/reports/boarding', params ?? {}),
    ),
  getTripDetails: (tripId: string) =>
    request<TransportTrip>(`/transport/trips/${encodeURIComponent(tripId)}`),
  markTripDelay: (
    tripId: string,
    body: { isDelayed: boolean; delayReason?: string; delayMinutes?: number },
  ) =>
    request<TransportTrip>(`/transport/trips/${encodeURIComponent(tripId)}/delay`, {
      method: 'PATCH',
      json: body,
    }),
};
