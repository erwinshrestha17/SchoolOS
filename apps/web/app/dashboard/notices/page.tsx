'use client';

import { CommunicationsForm } from '../../../components/forms/communications-form';

export default function NoticesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Notices
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Notices, events, and audience targeting.
        </p>
      </div>
      <CommunicationsForm />
    </div>
  );
}
