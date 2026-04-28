'use client';

import { useSession } from '../session-provider';
import {
  Search,
  Bell,
  ChevronDown,
  Menu,
  User,
  ArrowLeftRight,
  LogOut,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

type HeaderProps = {
  onMobileMenuToggle: () => void;
};

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const { session, logout } = useSession();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const yearMenuRef = useRef<HTMLDivElement>(null);

  const unreadCount = 3; // Demo: would come from API

  // Academic years in BS (Bikram Sambat)
  const academicYears = ['2081-82', '2080-81', '2079-80'];
  const [selectedYear, setSelectedYear] = useState(academicYears[0]);

  // Close menus on outside click
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

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 lg:px-6 shadow-sm">
      {/* Mobile menu button */}
      <button
        onClick={onMobileMenuToggle}
        className="lg:hidden flex items-center justify-center h-9 w-9 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      {/* Tenant logo + name (desktop) */}
      <div className="hidden lg:flex items-center gap-2.5 min-w-0 mr-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 text-white text-xs font-bold">
          {session?.tenant.name?.[0]?.toUpperCase() ?? 'S'}
        </div>
        <span className="text-sm font-semibold text-gray-900 truncate max-w-[160px]">
          {session?.tenant.name ?? 'SchoolOS'}
        </span>
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search students by name or SCH-YYYY-NNNN..."
          className="search-input"
        />
      </div>

      {/* Right-side actions */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Academic year selector */}
        <div className="relative" ref={yearMenuRef}>
          <button
            onClick={() => setYearMenuOpen(!yearMenuOpen)}
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span className="text-gray-500 text-xs">AY</span>
            <span>{selectedYear}</span>
            <ChevronDown
              size={14}
              className={`text-gray-400 transition-transform ${yearMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {yearMenuOpen && (
            <div className="dropdown-menu" style={{ minWidth: '140px' }}>
              {academicYears.map((year) => (
                <button
                  key={year}
                  onClick={() => {
                    setSelectedYear(year);
                    setYearMenuOpen(false);
                  }}
                  className={`dropdown-item w-full text-left ${
                    year === selectedYear
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : ''
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notification bell */}
        <button
          className="relative flex items-center justify-center h-9 w-9 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="notification-badge">{unreadCount}</span>
          )}
        </button>

        {/* Divider */}
        <div className="hidden sm:block h-6 w-px bg-gray-200 mx-1" />

        {/* User avatar dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-100 transition-colors"
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
            <div className="dropdown-menu">
              {/* User info header */}
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
                className="dropdown-item w-full"
                onClick={() => setUserMenuOpen(false)}
              >
                <User size={16} />
                <span>Profile</span>
              </button>

              <button
                className="dropdown-item w-full"
                onClick={() => setUserMenuOpen(false)}
              >
                <ArrowLeftRight size={16} />
                <span>Switch Role</span>
              </button>

              <div className="dropdown-divider" />

              <button
                className="dropdown-item dropdown-item-danger w-full"
                onClick={() => {
                  setUserMenuOpen(false);
                  void logout();
                }}
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
