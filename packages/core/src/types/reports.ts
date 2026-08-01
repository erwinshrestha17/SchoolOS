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
