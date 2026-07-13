"use client";

import { formatBsDateTime, type ActivityPost } from "@schoolos/core";
import { useQuery } from "@tanstack/react-query";
import { Camera, Download, Eye, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { api } from "../../lib/api";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { PageState } from "../ui/page-state";
import { cn } from "../../lib/utils";

export function ParentActivityView() {
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const childrenQuery = useQuery({
    queryKey: ["parent-linked-children"],
    queryFn: () => api.listMyLinkedStudents(),
  });
  const children = childrenQuery.data?.items ?? [];

  const postsQuery = useQuery({
    queryKey: ["parent-activity-posts", selectedChildId],
    queryFn: () => api.listParentActivityPosts({ studentId: selectedChildId }),
  });

  return (
    <div className="space-y-4">
      {children.length > 1 ? (
        <div
          className="flex flex-wrap gap-2"
          data-testid="parent-activity-child-switcher"
        >
          <button
            type="button"
            onClick={() => setSelectedChildId(null)}
            className={cn(
              "inline-flex h-9 items-center rounded-full px-4 text-xs font-bold transition-colors",
              selectedChildId === null
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            )}
          >
            All Children
          </button>
          {children.map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => setSelectedChildId(child.id)}
              className={cn(
                "inline-flex h-9 items-center rounded-full px-4 text-xs font-bold transition-colors",
                selectedChildId === child.id
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {child.name}
              {child.classSection ? ` – ${child.classSection}` : ""}
            </button>
          ))}
        </div>
      ) : null}

      <ParentActivityPostList postsQuery={postsQuery} />
    </div>
  );
}

function ParentActivityPostList({
  postsQuery,
}: {
  postsQuery: ReturnType<
    typeof useQuery<ActivityPost[]>
  >;
}) {
  if (postsQuery.isLoading) {
    return (
      <div className="space-y-4" data-testid="parent-activity-loading">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-56 animate-pulse rounded-3xl border border-slate-200 bg-white"
          />
        ))}
      </div>
    );
  }

  if (postsQuery.isError) {
    return (
      <PageState
        tone="warning"
        title="Activities could not be loaded"
        description={
          postsQuery.error instanceof Error
            ? postsQuery.error.message
            : "Please try again after a moment."
        }
      />
    );
  }

  const posts = postsQuery.data ?? [];

  if (posts.length === 0) {
    return (
      <PageState
        tone="info"
        title="No classroom activities shared yet"
        description="Approved classroom moments for your child will appear here after teachers share them."
      />
    );
  }

  return (
    <section className="space-y-4" data-testid="parent-activity-feed">
      {posts.map((post) => (
        <ParentActivityCard key={post.id} post={post} />
      ))}
    </section>
  );
}

function ParentActivityCard({ post }: { post: ActivityPost }) {
  const hiddenMediaCount = post.attachments.filter(
    (attachment) => attachment.accessBlockedReason,
  ).length;

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-950">
              {post.title}
            </h2>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">
              {post.activityDate
                ? formatDateTime(post.activityDate)
                : post.publishedAt
                  ? formatDateTime(post.publishedAt)
                  : "Shared"}
              {post.teacherName ? ` · ${post.teacherName}` : ""}
            </p>
          </div>
          <Badge variant="info">{formatLabel(post.category)}</Badge>
        </div>

        <p className="text-sm leading-6 text-slate-600">
          {post.caption ?? post.body ?? "No activity note was added."}
        </p>

        {post.askAtHome ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-800">
            <p className="text-xs font-black uppercase tracking-widest">
              Ask your child about
            </p>
            <p className="mt-1 text-xs font-semibold leading-5">
              {post.askAtHome}
            </p>
          </div>
        ) : null}

        {hiddenMediaCount > 0 ? (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-amber-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-xs font-semibold leading-5">
              Some media is hidden because of student photo consent settings.
            </p>
          </div>
        ) : null}

        {post.attachments.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {post.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50"
              >
                <div className="aspect-[16/10] bg-slate-100">
                  {attachment.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={attachment.previewUrl}
                      alt={attachment.fileName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center p-4 text-center text-slate-400">
                      <Camera className="h-6 w-6" />
                      <p className="mt-2 text-xs font-black uppercase tracking-widest">
                        Media hidden
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <p className="truncate text-xs font-bold text-slate-600">
                    {attachment.fileName}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Preview ${attachment.fileName}`}
                      disabled={Boolean(attachment.accessBlockedReason)}
                      onClick={() =>
                        void api.previewActivityAttachment(attachment.id)
                      }
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Download ${attachment.fileName}`}
                      disabled={Boolean(attachment.accessBlockedReason)}
                      onClick={() =>
                        void api.downloadActivityAttachment(
                          attachment.id,
                          attachment.fileName,
                        )
                      }
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function formatDateTime(value: string) {
  return formatBsDateTime(value);
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}
