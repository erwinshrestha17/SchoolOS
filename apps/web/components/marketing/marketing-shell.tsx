import type { ReactNode } from 'react';
import { LandingHeader } from './landing-header';
import { MarketingFooter } from './marketing-footer';
import styles from '../../app/landing.module.css';

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div id="top" className={styles.page}>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>
      <LandingHeader />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
