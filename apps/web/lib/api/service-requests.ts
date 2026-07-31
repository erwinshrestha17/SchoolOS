import { API_BASE_URL, JsonBody, parseApiErrorMessage, request, withQuery } from './client';

export type SchoolServiceRequestType = 'GENERAL_COMPLAINT' | 'PAYMENT_DISPUTE';

export type SchoolServiceRequestCategory =
  | 'ACADEMICS'
  | 'ATTENDANCE'
  | 'FEES_AND_PAYMENTS'
  | 'SCHOOL_OPERATIONS'
  | 'OTHER';

export type SchoolServiceRequestPriority = 'NORMAL' | 'HIGH';

export type SchoolServiceRequestStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED'
  | 'CANCELLED';

export type SchoolServiceRequestNoteVisibility = 'PARENT' | 'INTERNAL';

export type SchoolServiceRequestStudent = {
  id: string;
  name: string;
  classSection: string;
};

export type SchoolServiceRequestInvoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  dueDate: string;
};

export type SchoolServiceRequestNote = {
  id: string;
  body: string;
  createdAt: string;
  author: string;
};

export type SchoolServiceRequestAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  label: string | null;
  downloadPath: string;
  createdAt: string;
};

export type SchoolServiceRequestSummary = {
  id: string;
  student: SchoolServiceRequestStudent;
  type: SchoolServiceRequestType;
  category: SchoolServiceRequestCategory;
  priority: SchoolServiceRequestPriority;
  subject: string;
  description: string;
  status: SchoolServiceRequestStatus;
  invoice: SchoolServiceRequestInvoice | null;
  responder: { name: string } | null;
  responseDeadline: string;
  isOverdue: boolean;
  resolutionSummary: string | null;
  notes: SchoolServiceRequestNote[];
  attachments: SchoolServiceRequestAttachment[];
  requestedBy: {
    id: string;
    name: string;
  };
  assignedTo: {
    id: string;
    name: string;
  } | null;
  internalNotes: SchoolServiceRequestNote[];
  escalation: {
    at: string;
    reason: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type SchoolServiceRequestListResponse = {
  items: SchoolServiceRequestSummary[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
};

export type ListSchoolServiceRequestsParams = {
  status?: SchoolServiceRequestStatus;
  type?: SchoolServiceRequestType;
  priority?: SchoolServiceRequestPriority;
  assignedToId?: string;
  page?: number;
  limit?: number;
};

export const serviceRequestsApi = {
  listServiceRequests: (params?: ListSchoolServiceRequestsParams) =>
    request<SchoolServiceRequestListResponse>(
      withQuery('/service-requests', {
        status: params?.status,
        type: params?.type,
        priority: params?.priority,
        assignedToId: params?.assignedToId,
        page: params?.page ? String(params.page) : undefined,
        limit: params?.limit ? String(params.limit) : undefined,
      }),
    ),

  getServiceRequest: (requestId: string) =>
    request<SchoolServiceRequestSummary>(
      `/service-requests/${encodeURIComponent(requestId)}`,
    ),

  triageServiceRequest: (
    requestId: string,
    body: {
      assignedToUserId: string;
      priority: SchoolServiceRequestPriority;
      responseDeadline: string;
      status: 'ASSIGNED' | 'IN_PROGRESS';
      reason: string;
    },
  ) =>
    request<SchoolServiceRequestSummary>(
      `/service-requests/${encodeURIComponent(requestId)}/triage`,
      { method: 'PATCH', json: body satisfies JsonBody },
    ),

  addServiceRequestNote: (
    requestId: string,
    body: { body: string; visibility: SchoolServiceRequestNoteVisibility },
  ) =>
    request<SchoolServiceRequestSummary>(
      `/service-requests/${encodeURIComponent(requestId)}/notes`,
      { method: 'POST', json: body satisfies JsonBody },
    ),

  resolveServiceRequest: (
    requestId: string,
    body: { resolutionSummary: string },
  ) =>
    request<SchoolServiceRequestSummary>(
      `/service-requests/${encodeURIComponent(requestId)}/resolve`,
      { method: 'POST', json: body satisfies JsonBody },
    ),

  escalateServiceRequest: (
    requestId: string,
    body: { reason: string; assignedToUserId: string },
  ) =>
    request<SchoolServiceRequestSummary>(
      `/service-requests/${encodeURIComponent(requestId)}/escalate`,
      { method: 'POST', json: body satisfies JsonBody },
    ),

  downloadServiceRequestAttachment: async (
    requestId: string,
    attachmentId: string,
    fileName: string,
  ) => {
    const response = await fetch(
      `${API_BASE_URL}/service-requests/${encodeURIComponent(requestId)}/attachments/${encodeURIComponent(attachmentId)}`,
      { credentials: 'include' },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        parseApiErrorMessage(text) || 'Protected evidence download failed.',
      );
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName.trim() || 'schoolos-evidence';
    document.body.appendChild(anchor);
    anchor.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(anchor);
  },
};
