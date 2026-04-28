'use client';

import { MessagingForm } from '../../../components/forms/messaging-form';

export default function MessagingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Messaging
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Parent-teacher messaging.
        </p>
      </div>
      <MessagingForm />
    </div>
  );
}
