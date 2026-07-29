import { request } from './client';

export type ApprovalDecision = 'APPROVE' | 'REJECT';

export const advancedOperationsApi = {
  decideApprovalRequest: (
    approvalRequestId: string,
    body: { decision: ApprovalDecision; reason?: string },
  ) =>
    request<{ success: boolean }>(
      `/advanced/approvals/${encodeURIComponent(approvalRequestId)}/decisions`,
      { method: 'POST', json: body },
    ),
};
