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
  kpiGrid,
}: {
  title: string;
  description: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  moreActionItems?: ActionMenuItem[];
  kpiGrid?: ReactNode;
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
      {kpiGrid ? <div className="mb-5">{kpiGrid}</div> : null}
      <M1ModuleNav />
    </ModuleHeader>
  );
}
