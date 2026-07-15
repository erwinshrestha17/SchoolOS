import type { ReactNode } from 'react';
import { ModuleHeader } from '../ui/module-header';
import type { ActionMenuItem } from '../ui/action-menu';

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
      className="mb-0 border-border pb-4"
      primaryAction={
        primaryAction || secondaryActions ? (
          <>
            {primaryAction}
            {secondaryActions}
          </>
        ) : undefined
      }
      moreActionItems={moreActionItems}
    />
  );
}
