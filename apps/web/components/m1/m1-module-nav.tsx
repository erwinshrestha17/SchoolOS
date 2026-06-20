'use client';

import { ClipboardCheck, ClipboardList, FileCheck2, QrCode, ScanSearch, UsersRound } from 'lucide-react';
import { ModuleTabs } from '../ui/module-tabs';

export function M1ModuleNav() {
  return (
    <ModuleTabs
      accentColor="blue"
      variant="light"
      items={[
        { href: '/dashboard/students', label: 'Students', icon: UsersRound },
        { href: '/dashboard/admissions', label: 'Admissions', icon: ClipboardList },
        { href: '/dashboard/admissions/review', label: 'Review', icon: ClipboardCheck },
        { href: '/dashboard/admissions/documents', label: 'Documents', icon: FileCheck2 },
        { href: '/dashboard/admissions/duplicates', label: 'Duplicates', icon: ScanSearch },
        { href: '/dashboard/admissions/iemis', label: 'iEMIS', icon: FileCheck2 },
        { href: '/dashboard/admissions/qr', label: 'QR / ID Cards', icon: QrCode },
      ]}
    />
  );
}
