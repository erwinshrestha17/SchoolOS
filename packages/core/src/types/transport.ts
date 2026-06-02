export type TransportRouteSummary = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  stops?: TransportStopSummary[];
};

export type TransportStopSummary = {
  id: string;
  routeId: string;
  name: string;
  sequence: number;
  estimatedPickup: string | null;
  estimatedDrop: string | null;
};

export type TransportVehicleSummary = {
  id: string;
  registrationNumber: string;
  capacity: number;
  status: string;
  fitnessCertificateExp: string | null;
};

export type TransportEnrollmentSummary = {
  id: string;
  studentId: string;
  routeId: string;
  stopId: string;
  feeAmount: number;
  status: string;
  feeAssignmentId: string | null;
};

export type TransportLogSummary = {
  id: string;
  routeId: string;
  stopId: string | null;
  vehicleId: string | null;
  enrollmentId: string | null;
  studentId: string | null;
  status: string;
  occurredAt: string;
};
