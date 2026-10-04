'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import styles from '../../app/landing.module.css';

const links = [
  { href: '/product', label: 'Product' },
  { href: '/solutions', label: 'Solutions' },
  { href: '/security', label: 'Security' },
  { href: '/#how-it-works', label: 'How it works' },
];

export function LandingHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const closeMenu = () => setOpen(false);

  return (
    <header className={styles.header}>
      <div className={`${styles.container} ${styles.headerInner}`}>
        <Link
          className={styles.brand}
          href="/"
          aria-label="SchoolOS home"
          onClick={closeMenu}
        >
          <span className={styles.brandMark} aria-hidden="true">
            <span />
          </span>
          <span>SchoolOS</span>
        </Link>

        <nav className={styles.desktopNav} aria-label="Main navigation">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? 'page' : undefined}
              className={pathname === link.href ? styles.navActive : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={styles.headerActions}>
          <Link className={styles.signIn} href="/login">
            Sign in
          </Link>
          <Link className={styles.headerCta} href="/request-demo">
            Request a demo <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <button
            className={styles.menuButton}
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-controls="mobile-navigation"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? (
              <X size={22} aria-hidden="true" />
            ) : (
              <Menu size={22} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="mobile-navigation"
          className={styles.mobileNav}
          aria-label="Mobile navigation"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? 'page' : undefined}
              onClick={closeMenu}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/login" onClick={closeMenu}>
            Sign in
          </Link>
          <Link
            className={styles.mobileNavCta}
            href="/request-demo"
            onClick={closeMenu}
          >
            Request a demo <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </nav>
      )}
    </header>
  );
}
