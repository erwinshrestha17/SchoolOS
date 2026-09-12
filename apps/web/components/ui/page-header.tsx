'use client';

import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { ModuleHeader } from './module-header';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return <ModuleHeader title={title} description={description} secondaryActions={actions} className={cn('mb-5', className)} />;
}
