import type { ReactNode } from 'react';
import { ModuleHeader } from '../ui/module-header';
import type { ActionMenuItem } from '../ui/action-menu';
import { M1ModuleNav } from './m1-module-nav';

export function M1PageHeader({
  title,
  description,
  primaryAction,
  secondaryActions,
  moreActionItems,
}: {
  title: string;
  description: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  moreActionItems?: ActionMenuItem[];
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
      moreActionItems={moreActionItems}
    >
      <M1ModuleNav />
    </ModuleHeader>
  );
}
