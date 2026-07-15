import type { ComponentType, ReactNode } from "react";
import {
  SummaryCard,
  SummaryGrid,
} from "@/components/ui/summary-card";

export function M1SummaryGrid({ children }: { children: ReactNode }) {
  return <SummaryGrid className="gap-3" data-testid="m1-summary-grid">{children}</SummaryGrid>;
}

export function M1SummaryCard({
  title,
  description,
  value,
  href,
  icon: Icon,
  loading = false,
}: {
  title: string;
  description: string;
  value: number | "Unavailable";
  href: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  loading?: boolean;
}) {
  return (
    <SummaryCard
      label={title}
      value={value}
      description={description}
      href={href}
      loading={loading}
      icon={<Icon aria-hidden />}
    />
  );
}
