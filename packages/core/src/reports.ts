export type ReportFormat = "csv" | "pdf" | "json";

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
    | "inventory"
    | "platform";
  module: string;
  formats: ReportFormat[];
  filters: ReportFilterDefinition[];
  requiredPermissions: string[];
}

export interface ReportExportRequest {
  format: ReportFormat;
  filters: Record<string, any>;
}

export interface ReportExportResult {
  format: ReportFormat;
  content: any; // Buffer for binary, object for JSON
  fileName: string;
  contentType: string;
}
