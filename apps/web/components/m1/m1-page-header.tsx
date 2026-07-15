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
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
      moreActionItems={moreActionItems}
    />
  );
}
