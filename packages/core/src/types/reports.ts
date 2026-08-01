export type ReportFormat = "csv" | "pdf" | "xlsx" | "json";

export interface ReportFilterDefinition {
  key: string;
  label: string;
  type:
    | "text"
    | "date"
    | "select"
    | "boolean"
    | "class"
    | "section"
    | "student";
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
}

export interface ReportDefinition {
  key: string;
  /**
   * Canonical P0 financial report this export produces, when it is one.
   *
   * Registry keys are route-facing slugs and never match a catalog ID, so this
   * is the only link that lets an export inherit catalog-owned version,
   * classification, and professional-verification metadata. Without it an
   * export cannot describe itself the same way the rendered report does.
   */
  financialReportId?: string;
  name: string;
  description: string;
  category:
    | "academics"
    | "finance"
    | "students"
    | "hr"
    | "payroll"
    | "inventory"
    | "attendance"
    | "platform";
  module: string;
  formats: ReportFormat[];
  filters: ReportFilterDefinition[];
  requiredPermissions: string[];
}

export interface ReportExportRequest {
  format: ReportFormat;
  filters: Record<string, unknown>;
  async?: boolean;
}

export interface ReportExportResult {
  format?: ReportFormat;
  content?: unknown;
  fileName?: string;
  contentType?: string;
  data?: unknown;
  status?: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  jobId?: string | number;
}
