import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/primitives/card";
import { Badge } from "@/components/ui/primitives/badge";
import { Skeleton } from "@/components/ui/primitives/skeleton";

export function M1SummaryGrid({ children }: { children: ReactNode }) {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      data-testid="m1-summary-grid"
    >
      {children}
    </div>
  );
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
    <Link
      href={href}
      className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      aria-label={`${title}: ${loading ? "Loading" : value}. ${description}`}
    >
      <Card className="h-full gap-2 py-4 shadow-sm transition-colors hover:bg-accent/30">
        <CardHeader className="grid grid-cols-[1fr_auto] items-center gap-2 px-4">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon aria-hidden />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 px-4">
          {loading ? (
            <Skeleton className="h-7 w-16" aria-label={`Loading ${title}`} />
          ) : value === "Unavailable" ? (
            <Badge variant="outline" className="w-fit">
              Unavailable
            </Badge>
          ) : (
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {value}
            </p>
          )}
          <CardDescription className="line-clamp-1 text-xs">
            {description}
          </CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}
