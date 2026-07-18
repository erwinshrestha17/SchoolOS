"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "../session-provider";
import { useEntitlements } from "../entitlements-provider";
import { api } from "../../lib/api";
import { GlobalStudentSearch } from "./global-student-search";
import { NotificationBell } from "./notification-bell";
import {
  BriefcaseBusiness,
  ChevronDown,
  LogOut,
  Menu,
  School,
  Settings,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type RefObject } from "react";

import { Avatar } from "../ui/avatar";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/primitives/dropdown-menu";

export type HeaderProps = {
  onMobileMenuToggle: () => void;
  mobileMenuButtonRef?: RefObject<HTMLButtonElement | null>;
};

export function Header({
  onMobileMenuToggle,
  mobileMenuButtonRef,
}: HeaderProps) {
  const router = useRouter();
  const { hasPermissions, session, status, logout } = useSession();
  const { hasModule } = useEntitlements();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const canReadAcademicYears = hasPermissions(["academic_years:read"]);
  const canReadNotifications = hasPermissions(["notices:read"]);

  const academicYearsQuery = useQuery({
    queryKey: ["layout-academic-years"],
    queryFn: api.listAcademicYears,
    enabled: status === "authenticated" && canReadAcademicYears,
  });
  const profileQuery = useQuery({
    queryKey: ["auth", "profile"],
    queryFn: api.getProfile,
    enabled: status === "authenticated",
  });

  const academicYears = academicYearsQuery.data ?? [];
  const currentAcademicYear =
    academicYears.find((year) => year.isCurrent) ?? academicYears[0];

  const authenticatedName = profileQuery.data?.staff
    ? [profileQuery.data.staff.firstName, profileQuery.data.staff.lastName]
        .filter(Boolean)
        .join(" ")
    : profileQuery.data?.student
      ? [
          profileQuery.data.student.firstNameEn,
          profileQuery.data.student.lastNameEn,
        ]
          .filter(Boolean)
          .join(" ")
      : null;
  const displayName =
    authenticatedName || session?.user.email?.split("@")[0] || "User";
  const initials = displayName
    ? displayName
        .split(/[\s._-]+/)
        .map((p) => p[0]?.toUpperCase())
        .join("")
        .slice(0, 2)
    : "U";

  const primaryRole = session?.user.roles[0]?.replace(/_/g, " ") ?? "User";
  const tenantName = session?.tenant.name ?? "SchoolOS";
  const canOpenMyWorkspace = Boolean(
    profileQuery.data?.staff &&
    hasModule("hr") &&
    session?.user.permissions.includes("staff:read"),
  );

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/95 px-4 shadow-sm shadow-slate-200/40 backdrop-blur-md lg:px-8">
      <button
        ref={mobileMenuButtonRef}
        type="button"
        onClick={onMobileMenuToggle}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2 lg:hidden"
        aria-controls="dashboard-main"
        aria-label="Open navigation menu"
      >
        <Menu size={20} />
      </button>

      <div className="hidden min-w-0 items-center gap-3 lg:flex">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-xs font-bold text-white shadow-sm shadow-[var(--primary-soft)]">
          {tenantName[0]?.toUpperCase() ?? <School size={16} />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">
            {tenantName}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-success-500" />
            <p className="truncate text-xs font-semibold leading-[18px] text-slate-500">
              {session?.tenant.slug ?? "schoolos"} school
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto hidden w-full max-w-xl md:block">
        <GlobalStudentSearch />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {canReadAcademicYears && currentAcademicYear ? (
          <div
            className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm sm:flex"
            title="Active academic year. Change it in School Settings."
          >
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
              AY
            </span>
            <span>{currentAcademicYear.name}</span>
            {currentAcademicYear.isCurrent ? (
              <Badge variant="success" className="h-4.5 px-1.5 text-[0.6rem]">
                Current
              </Badge>
            ) : null}
          </div>
        ) : null}

        <NotificationBell enabled={canReadNotifications} />

        <div className="mx-1 hidden h-8 w-px bg-slate-200 sm:block" />

        <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="group flex items-center gap-3 rounded-xl p-1 pr-2 transition-all hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2"
              aria-label="User profile menu"
            >
              <Avatar
                initials={initials}
                size="sm"
                className="shadow-sm shadow-[var(--primary-soft)] ring-2 ring-white transition-all group-hover:ring-[var(--primary-soft)]"
              />
              <div className="hidden min-w-0 text-left sm:block">
                <p className="mb-1 max-w-[120px] truncate text-sm font-bold capitalize leading-none text-slate-900">
                  {displayName}
                </p>
                <p className="text-xs font-semibold capitalize leading-none text-slate-500">
                  {primaryRole}
                </p>
              </div>
              <ChevronDown
                size={14}
                className={cn(
                  "hidden text-slate-400 transition-transform duration-200 sm:block",
                  userMenuOpen && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-72 rounded-xl border-slate-200 bg-white p-1 text-slate-900 shadow-lg"
          >
            <DropdownMenuLabel className="rounded-lg bg-slate-50 p-3 font-normal">
              <div className="flex items-center gap-3">
                <Avatar
                  initials={initials}
                  size="md"
                  className="ring-2 ring-white"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold capitalize text-slate-900">
                    {displayName}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {session?.user.email ?? "No email available"}
                  </p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
                <dt className="font-semibold text-slate-500">Role</dt>
                <dd className="truncate font-bold capitalize text-slate-700">
                  {primaryRole}
                </dd>
                <dt className="font-semibold text-slate-500">School</dt>
                <dd className="truncate font-bold text-slate-700">
                  {tenantName}
                </dd>
              </dl>
            </DropdownMenuLabel>

            <div className="py-1">
              {canOpenMyWorkspace ? (
                <DropdownMenuItem
                  className="cursor-pointer rounded-lg px-3 py-2.5 font-semibold text-slate-700 focus:bg-slate-100 focus:text-slate-950"
                  onSelect={() => router.push("/dashboard/my-workspace")}
                >
                  <BriefcaseBusiness
                    className="h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  />
                  My Workspace
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                className="cursor-pointer rounded-lg px-3 py-2.5 font-semibold text-slate-700 focus:bg-slate-100 focus:text-slate-950"
                onSelect={() =>
                  router.push("/dashboard/settings/personal/profile")
                }
              >
                <Settings
                  className="h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
                Personal Settings
              </DropdownMenuItem>
            </div>

            <DropdownMenuSeparator className="bg-slate-200" />

            <DropdownMenuItem
              variant="destructive"
              className="cursor-pointer rounded-lg px-3 py-2.5 font-bold text-rose-700 focus:bg-rose-50 focus:text-rose-800"
              onSelect={() => void logout()}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
