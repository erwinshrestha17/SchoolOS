/** Manual external-authority evidence. These statuses never imply direct sync. */
export type ExternalAuthorityHandoffStatus =
  | "READY"
  | "EXPORTED"
  | "SUBMITTED"
  | "ACKNOWLEDGED"
  | "REJECTED"
  | "CORRECTION_REQUIRED";

export interface IemisHandoffEvent {
  id: string;
  status: ExternalAuthorityHandoffStatus;
  occurredAt: string;
  externalReceiptReference: string | null;
  evidenceFileId: string | null;
  note: string | null;
}

export interface IemisHandoff {
  id: string;
  authority: "CEHRD_IEMIS";
  purpose: string;
  reportExportId: string | null;
  supersedesId: string | null;
  schemaAuthority: string;
  officialFormatVerified: boolean;
  directSyncSupported: boolean;
  status: ExternalAuthorityHandoffStatus;
  createdAt: string;
  exportedAt: string | null;
  submittedAt: string | null;
  acknowledgedAt: string | null;
  externalReceiptReference: string | null;
  events: IemisHandoffEvent[];
}
