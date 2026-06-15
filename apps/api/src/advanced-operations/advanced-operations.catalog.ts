import {
  ApprovalWorkflowType,
  AutomationActionType,
  AutomationTriggerType,
} from '@prisma/client';

export const approvalWorkflowCatalog = [
  {
    workflowType: ApprovalWorkflowType.FEE_REVERSAL_REFUND,
    module: 'finance',
    targetType: 'payment',
    defaultFinalActionKey: 'finance.payment.reversal_or_refund',
  },
  {
    workflowType: ApprovalWorkflowType.SCHOLARSHIP_DISCOUNT,
    module: 'finance',
    targetType: 'fee_discount',
    defaultFinalActionKey: 'finance.discount.apply',
  },
  {
    workflowType: ApprovalWorkflowType.MARKS_CORRECTION,
    module: 'academics',
    targetType: 'mark_entry',
    defaultFinalActionKey: 'academics.marks.correct',
  },
  {
    workflowType: ApprovalWorkflowType.ATTENDANCE_CORRECTION,
    module: 'attendance',
    targetType: 'attendance_record',
    defaultFinalActionKey: 'attendance.record.correct',
  },
  {
    workflowType: ApprovalWorkflowType.LEAVE_REQUEST,
    module: 'hr',
    targetType: 'staff_leave_request',
    defaultFinalActionKey: 'hr.leave.apply',
  },
  {
    workflowType: ApprovalWorkflowType.PAYROLL_POSTING_REVERSAL,
    module: 'payroll',
    targetType: 'payroll_run',
    defaultFinalActionKey: 'payroll.post_or_reverse',
  },
  {
    workflowType: ApprovalWorkflowType.STUDENT_TRANSFER_WITHDRAWAL,
    module: 'students',
    targetType: 'student',
    defaultFinalActionKey: 'students.lifecycle.transfer_or_withdraw',
  },
  {
    workflowType: ApprovalWorkflowType.DOCUMENT_DELETION_ARCHIVE,
    module: 'file-registry',
    targetType: 'file_asset',
    defaultFinalActionKey: 'file_registry.archive',
  },
  {
    workflowType: ApprovalWorkflowType.EMERGENCY_HIGH_IMPACT_NOTICE,
    module: 'communications',
    targetType: 'notice',
    defaultFinalActionKey: 'communications.notice.publish_high_impact',
  },
  {
    workflowType: ApprovalWorkflowType.PLATFORM_SUPPORT_OVERRIDE,
    module: 'platform',
    targetType: 'support_override',
    defaultFinalActionKey: 'platform.support_override.apply',
  },
] as const;

export const initialAutomationRuleCatalog = [
  {
    triggerType: AutomationTriggerType.STUDENT_MARKED_ABSENT,
    name: 'Student absent parent notification',
    actionType: AutomationActionType.CREATE_NOTIFICATION_TASK,
  },
  {
    triggerType: AutomationTriggerType.ATTENDANCE_NOT_MARKED_BY_CUTOFF,
    name: 'Attendance cutoff reminder',
    actionType: AutomationActionType.CREATE_NOTIFICATION_TASK,
  },
  {
    triggerType: AutomationTriggerType.FEE_DUE_DATE_PASSED,
    name: 'Fee due date reminder',
    actionType: AutomationActionType.CREATE_NOTIFICATION_TASK,
  },
  {
    triggerType: AutomationTriggerType.NOTICE_UNREAD_AFTER_WINDOW,
    name: 'Unread notice follow-up',
    actionType: AutomationActionType.CREATE_NOTIFICATION_TASK,
  },
  {
    triggerType: AutomationTriggerType.STAFF_CONTRACT_EXPIRING,
    name: 'Staff contract expiry reminder',
    actionType: AutomationActionType.CREATE_NOTIFICATION_TASK,
  },
  {
    triggerType: AutomationTriggerType.DOCUMENT_EXPIRING,
    name: 'Document expiry reminder',
    actionType: AutomationActionType.CREATE_NOTIFICATION_TASK,
  },
  {
    triggerType: AutomationTriggerType.LOW_CANTEEN_BALANCE,
    name: 'Low canteen balance reminder',
    actionType: AutomationActionType.CREATE_NOTIFICATION_TASK,
  },
  {
    triggerType: AutomationTriggerType.TRANSPORT_GPS_STALE,
    name: 'Transport GPS stale alert',
    actionType: AutomationActionType.CREATE_NOTIFICATION_TASK,
  },
] as const;
