import type { ReactNode } from 'react';
import { SettingsRouteFrame } from '../../../components/settings/settings-route-frame';

export default function SchoolSettingsLayout({ children }: { children: ReactNode }) {
  return <SettingsRouteFrame>{children}</SettingsRouteFrame>;
}
