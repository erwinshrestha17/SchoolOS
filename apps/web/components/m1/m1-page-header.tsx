import type { ReactNode } from 'react';
import { ModuleHeader } from '../ui/module-header';
import { M1ModuleNav } from './m1-module-nav';

export function M1PageHeader({
  title,
  description,
  primaryAction,
  secondaryActions,
}: {
  title: string;
  description: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
}) {
  return (
    <ModuleHeader
      title={title}
      description={description}
      primaryAction={
        primaryAction || secondaryActions ? (
          <>
            {primaryAction}
            {secondaryActions}
          </>
        ) : undefined
      }
    >
      <M1ModuleNav />
    </ModuleHeader>
  );
}
