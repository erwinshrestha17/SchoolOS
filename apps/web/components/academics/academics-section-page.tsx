"use client";

import type { ReactNode } from "react";
import {
  academicsWorkspaceOverflowTabs,
  academicsWorkspaceTabs,
} from "@/components/academics/academics-tabs";
import { DashboardPageShell } from "@/components/dashboard/dashboard-page-shell";
import {
  ModuleHeader,
  type ModuleHeaderProps,
} from "@/components/ui/module-header";
import { WorkspaceTabs } from "@/components/ui/module-tabs";

type AcademicsSectionPageProps = {
  title: string;
  description: string;
  primaryAction?: ModuleHeaderProps["primaryAction"];
  moreActionItems?: ModuleHeaderProps["moreActionItems"];
  showTabs?: boolean;
  children: ReactNode;
};

export function AcademicsSectionPage({
  title,
  description,
  primaryAction,
  moreActionItems,
  showTabs = true,
  children,
}: AcademicsSectionPageProps) {
  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="Academics"
        title={title}
        description={description}
        primaryAction={primaryAction}
        moreActionItems={moreActionItems}
      />
      {showTabs ? (
        <WorkspaceTabs
          items={academicsWorkspaceTabs}
          overflowItems={academicsWorkspaceOverflowTabs}
        />
      ) : null}
      {children}
    </DashboardPageShell>
  );
}
