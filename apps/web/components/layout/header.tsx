'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from '../session-provider';
import { api } from '../../lib/api';
import {
  Search,
  Bell,
  ChevronDown,
  Menu,
  User,
  LogOut,
  School,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

type HeaderProps = {
  onMobileMenuToggle: () => void;
};

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const { hasPermissions, session, logout } = useSession();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<
    string | null
  >(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const yearMenuRef = useRef<HTMLDivElement>(null);

  const canReadAcademicYears = hasPermissions(['academic_years:read']);
  const canReadDeliveries = hasPermissions(['communications:read_deliveries']);

  const academicYearsQuery = useQuery({
    queryKey: ['layout-academic-years'],
    queryFn: api.listAcademicYears,
    enabled: canReadAcademicYears,
  });

  const deliveriesQuery = useQuery({
    queryKey: ['layout-notification-deliveries'],
    queryFn: api.listNotificationDeliveries,
    enabled: canReadDeliveries,
    refetchInterval: 60_000,
  });

  const academicYears = academicYearsQuery.data ?? [];
  const currentAcademicYear =
    academicYears.find((year) => year.isCurrent) ?? academicYears[0];
  const selectedAcademicYear =
    academicYears.find((year) => year.id === selectedAcademicYearId) ??
    currentAcademicYear;
  const unreadCount = (deliveriesQuery.data ?? []).filter((delivery) =>
    ['PENDING', 'QUEUED', 'RETRYING', 'FAILED'].includes(
      delivery.status.toUpperCase(),
    ),
  ).length;

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
  const primaryRole =
    session?.user.roles[0]?.replace(/_/g, ' ') ?? 'User';
  const tenantName = session?.tenant.name ?? 'SchoolOS';

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 lg:px-6 shadow-sm">
      <button
        type="button"
        onClick={onMobileMenuToggle}
        className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 lg:hidden"
        aria-controls="dashboard-main"
        aria-label="Open navigation menu"
      >
        <Menu size={20} />
      </button>

      <div className="hidden min-w-0 items-center gap-2.5 lg:flex">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-xs font-bold text-white">
          {tenantName[0]?.toUpperCase() ?? <School size={16} />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900 max-w-[180px]">
            {tenantName}
          </p>
          <p className="truncate text-xs text-gray-500">
            {session?.tenant.slug ?? 'schoolos'}
          </p>
        </div>
      </div>

      <div className="relative max-w-md flex-1">
        <label htmlFor="global-student-search" className="sr-only">
          Search students
        </label>
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          id="global-student-search"
          type="text"
          placeholder="Search students by name or SCH-YYYY-NNNN..."
          className="search-input"
          aria-label="Search students by name or SchoolOS student ID"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative" ref={yearMenuRef}>
          <button
            type="button"
            onClick={() => setYearMenuOpen(!yearMenuOpen)}
            className="hidden min-h-11 items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 sm:flex"
            disabled={!canReadAcademicYears || academicYears.length === 0}
            aria-expanded={yearMenuOpen}
            aria-haspopup="menu"
            aria-label="Select academic year"
          >
            <span className="text-gray-500 text-xs">AY</span>
            <span>{selectedAcademicYear?.name ?? 'Not set'}</span>
            <ChevronDown
              size={14}
              className={`text-gray-400 transition-transform ${yearMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {yearMenuOpen && (
            <div className="dropdown-menu" role="menu" style={{ minWidth: '160px' }}>
              {academicYears.map((year) => (
                <button
                  key={year.id}
                  type="button"
                  onClick={() => {
                    setSelectedAcademicYearId(year.id);
                    setYearMenuOpen(false);
                  }}
                  className={`dropdown-item w-full text-left ${
                    year.id === selectedAcademicYear?.id
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : ''
                  }`}
                  role="menuitem"
                >
                  {year.name}
                  {year.isCurrent && (
                    <span className="ml-auto rounded-full bg-success-50 px-2 py-0.5 text-[0.65rem] font-semibold text-success-600">
                      Current
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="relative flex h-11 w-11 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Notifications"
          disabled={!canReadDeliveries}
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="notification-badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        <div className="hidden sm:block h-6 w-px bg-gray-200 mx-1" />

        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex min-h-11 items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-gray-100"
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
            aria-label="Open user menu"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white text-xs font-bold">
              {initials}
            </div>
            <div className="hidden sm:block text-left min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate max-w-[120px] capitalize">
                {displayName}
              </p>
              <p className="text-xs text-gray-500 truncate max-w-[120px] capitalize">
                {primaryRole}
              </p>
            </div>
            <ChevronDown
              size={14}
              className={`hidden sm:block text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {userMenuOpen && (
            <div className="dropdown-menu" role="menu">
              <div className="px-3 py-2.5 border-b border-gray-100 mb-1">
                <p className="text-sm font-semibold text-gray-900 capitalize truncate">
                  {displayName}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {session?.user.email ?? session?.tenant.slug}
                </p>
                <div className="mt-1.5 inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[0.6875rem] font-medium text-primary-700 capitalize">
                  {primaryRole}
                </div>
              </div>

              <button
                type="button"
                className="dropdown-item w-full"
                onClick={() => setUserMenuOpen(false)}
                role="menuitem"
              >
                <User size={16} />
                <span>Profile</span>
              </button>

              <div className="dropdown-divider" />

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
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
