export type SchoolIntegrationStatusLabel =
  | 'disabled'
  | 'dev-log'
  | 'mock'
  | 'configured'
  | 'needs attention'
  | 'unavailable';

export type SchoolIntegrationStatusSignal = {
  id: string;
  label: string;
  status: SchoolIntegrationStatusLabel;
  message: string;
  observedAt?: string | null;
};

export type SchoolIntegrationStatusItem = {
  id: 'payment-gateway' | 'notification-providers' | 'attendance-devices';
  title: string;
  description: string;
  status: SchoolIntegrationStatusLabel;
  message: string;
  checkedAt: string;
  observedAt?: string | null;
  signals: SchoolIntegrationStatusSignal[];
};

export type SchoolIntegrationsStatus = {
  generatedAt: string;
  items: SchoolIntegrationStatusItem[];
  safetyNotes: string[];
};
