import { request } from './client';

export type ApprovalDecision = 'APPROVE' | 'REJECT';
export type ApprovalRequestStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'APPLIED'
  | 'APPLY_FAILED';

export type ApprovalStepSummary = {
  id: string;
  sequence: number;
  name: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
  approverRole: string | null;
  approverPermission: string | null;
  decidedAt: string | null;
};

export type ApprovalRequestSummary = {
  id: string;
  workflowType: string;
  status: ApprovalRequestStatus;
  title: string;
  reason: string;
  targetModule: string;
  targetType: string;
  targetId: string;
  safeContext: Record<string, unknown> | null;
  finalActionStatus: 'NOT_READY' | 'READY' | 'APPLIED' | 'FAILED';
  deadlineAt: string | null;
  delegatedToId: string | null;
  createdAt: string;
  updatedAt: string;
  steps: ApprovalStepSummary[];
  decisions: Array<{
    id: string;
    decision: ApprovalDecision;
    reason: string | null;
    decidedById: string;
    createdAt: string;
  }>;
  comments: Array<{
    id: string;
    body: string;
    createdById: string;
    createdAt: string;
  }>;
};

export type PrincipalApprovalQueueItem = Omit<
  ApprovalRequestSummary,
  'decisions' | 'comments'
>;

export type PrincipalApprovalQueuePage = {
  items: PrincipalApprovalQueueItem[];
  nextCursor: string | null;
  limit: number;
  generatedAt: string;
};

export const advancedOperationsApi = {
  listApprovalRequests: () =>
    request<ApprovalRequestSummary[]>('/advanced/approvals'),

  listPrincipalApprovalQueue: (input: { cursor?: string; limit?: number } = {}) => {
    const search = new URLSearchParams();
    if (input.cursor) search.set('cursor', input.cursor);
    if (input.limit) search.set('limit', String(input.limit));
    const suffix = search.size ? `?${search.toString()}` : '';
    return request<PrincipalApprovalQueuePage>(
      `/advanced/approvals/principal/queue${suffix}`,
    );
  },

  decideApprovalRequest: (
    approvalRequestId: string,
    body: {
      decision: ApprovalDecision;
      reason?: string;
      idempotencyKey?: string;
    },
  ) =>
    request<ApprovalRequestSummary>(
      `/advanced/approvals/${encodeURIComponent(approvalRequestId)}/decisions`,
      { method: 'POST', json: body },
    ),
};
