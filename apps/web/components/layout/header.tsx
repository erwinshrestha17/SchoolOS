'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from '../session-provider';
import { api } from '../../lib/api';
import { GlobalStudentSearch } from './global-student-search';
import { NotificationBell } from './notification-bell';
import {
  ChevronDown,
  Menu,
  User,
  LogOut,
  School,
  Settings,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

import { Avatar } from '../ui/avatar';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';

type HeaderProps = {
  onMobileMenuToggle: () => void;
};

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const router = useRouter();
  const { hasPermissions, session, status, logout } = useSession();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<
    string | null
  >(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const yearMenuRef = useRef<HTMLDivElement>(null);

  const canReadAcademicYears = hasPermissions(['academic_years:read']);
  const canReadNotifications = hasPermissions(['notices:read']);

  const academicYearsQuery = useQuery({
    queryKey: ['layout-academic-years'],
    queryFn: api.listAcademicYears,
    enabled: status === 'authenticated' && canReadAcademicYears,
  });

  const deliveriesQuery = useQuery({
    queryKey: ['header-notification-deliveries'],
    queryFn: api.listNotificationDeliveries,
    enabled: status === 'authenticated' && canReadNotifications,
  });

  const academicYears = academicYearsQuery.data ?? [];
  const currentAcademicYear =
    academicYears.find((year) => year.isCurrent) ?? academicYears[0];
  const selectedAcademicYear =
    academicYears.find((year) => year.id === selectedAcademicYearId) ??
    currentAcademicYear;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
      if (
        yearMenuRef.current &&
        !yearMenuRef.current.contains(e.target as Node)
      ) {
        setYearMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!selectedAcademicYearId && currentAcademicYear) {
      setSelectedAcademicYearId(currentAcademicYear.id);
    }
  }, [currentAcademicYear, selectedAcademicYearId]);

  const initials = session?.user.email
    ? session.user.email
        .split('@')[0]
        .split('.')
        .map((p) => p[0]?.toUpperCase())
        .join('')
        .slice(0, 2)
    : 'U';

  const displayName = session?.user.email?.split('@')[0] ?? 'User';
  const primaryRole = session?.user.roles[0]?.replace(/_/g, ' ') ?? 'User';
  const tenantName = session?.tenant.name ?? 'SchoolOS';

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md lg:px-8">
      <button
        type="button"
        onClick={onMobileMenuToggle}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 lg:hidden"
        aria-controls="dashboard-main"
        aria-label="Open navigation menu"
      >
        <Menu size={20} />
      </button>

      <div className="hidden min-w-0 items-center gap-3 lg:flex">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-xs font-bold text-white shadow-sm shadow-primary-600/20">
          {tenantName[0]?.toUpperCase() ?? <School size={16} />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900 tracking-tight">
            {tenantName}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse" />
            <p className="truncate text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">
              {session?.tenant.slug ?? 'schoolos'}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-xl hidden md:block">
        <GlobalStudentSearch />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="relative" ref={yearMenuRef}>
          <button
            type="button"
            onClick={() => setYearMenuOpen(!yearMenuOpen)}
            className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 sm:flex"
            disabled={!canReadAcademicYears || academicYears.length === 0}
            aria-expanded={yearMenuOpen}
            aria-haspopup="menu"
            aria-label="Select academic year"
          >
            <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">
              AY
            </span>
            <span>{selectedAcademicYear?.name ?? 'Not set'}</span>
            <ChevronDown
              size={14}
              className={cn(
                'text-slate-400 transition-transform duration-200',
                yearMenuOpen && 'rotate-180'
              )}
            />
          </button>

          {yearMenuOpen && (
            <div className="dropdown-menu animate-scale-in" role="menu" style={{ minWidth: '180px' }}>
              <div className="px-3 py-2 border-b border-slate-50">
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">
                  Select Academic Year
                </p>
              </div>
              <div className="p-1">
                {academicYears.map((year) => (
                  <button
                    key={year.id}
                    type="button"
                    onClick={() => {
                      setSelectedAcademicYearId(year.id);
                      setYearMenuOpen(false);
                    }}
                    className={cn(
                      'dropdown-item w-full transition-all duration-150',
                      year.id === selectedAcademicYear?.id
                        ? 'bg-primary-50 text-primary-700 font-bold'
                        : 'text-slate-600'
                    )}
                    role="menuitem"
                  >
                    <span className="flex-1 text-left">{year.name}</span>
                    {year.isCurrent && (
                      <Badge variant="success" className="h-4.5 px-1.5 text-[0.6rem]">
                        Current
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <NotificationBell enabled={canReadNotifications} />

        <div className="hidden sm:block h-8 w-px bg-slate-200 mx-1" />

        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="group flex items-center gap-3 rounded-xl p-1 pr-2 transition-all hover:bg-slate-50"
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
            aria-label="User profile menu"
          >
            <Avatar initials={initials} size="sm" className="shadow-sm shadow-primary-600/10 ring-2 ring-white group-hover:ring-primary-100 transition-all" />
            <div className="hidden sm:block text-left min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate max-w-[120px] capitalize tracking-tight leading-none mb-1">
                {displayName}
              </p>
              <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider leading-none">
                {primaryRole}
              </p>
            </div>
            <ChevronDown
              size={14}
              className={cn(
                'hidden sm:block text-slate-400 transition-transform duration-200',
                userMenuOpen && 'rotate-180'
              )}
            />
          </button>

          {userMenuOpen && (
            <div className="dropdown-menu animate-scale-in" role="menu" style={{ width: '240px' }}>
              <div className="p-3 border-b border-slate-50 bg-slate-50/50 rounded-t-xl">
                <div className="flex items-center gap-3">
                  <Avatar initials={initials} size="md" className="ring-2 ring-white" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 capitalize truncate">
                      {displayName}
                    </p>
                    <p className="text-[0.7rem] text-slate-500 truncate">
                      {session?.user.email ?? session?.tenant.slug}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <Badge variant="neutral" className="py-0 capitalize">
                    {primaryRole}
                  </Badge>
                  {session?.tenant.name && (
                    <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider truncate">
                      {session.tenant.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-1">
                <button
                  type="button"
                  className="dropdown-item w-full"
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push('/dashboard/my-profile');
                  }}
                  role="menuitem"
                >
                  <User size={16} className="text-slate-400" />
                  <span className="font-medium">My Profile</span>
                </button>
                
                <button
                  type="button"
                  className="dropdown-item w-full"
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push('/dashboard/settings');
                  }}
                  role="menuitem"
                >
                  <Settings size={16} className="text-slate-400" />
                  <span className="font-medium">Account Settings</span>
                </button>
              </div>

              <div className="dropdown-divider" />

              <div className="p-1">
                <button
                  type="button"
                  className="dropdown-item dropdown-item-danger w-full"
                  onClick={() => {
                    setUserMenuOpen(false);
                    void logout();
                  }}
                  role="menuitem"
                >
                  <LogOut size={16} />
                  <span className="font-bold">Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
