import type { ReactNode } from 'react';
import Link from 'next/link';
import { MarketingShell } from './marketing-shell';
import landing from '../../app/landing.module.css';
import styles from '../../app/legal-page.module.css';

export function LegalPage({
  title,
  intro,
  children,
  isApproved,
}: {
  title: string;
  intro: string;
  children: ReactNode;
  isApproved: boolean;
}) {
  return (
    <MarketingShell>
      <article className={styles.legalPage}>
        <div className={`${landing.container} ${styles.legalGrid}`}>
          <div className={styles.legalIntro}>
            <span className={styles.kicker}>SCHOOLOS / LEGAL</span>
            <h1>{title}</h1>
            <p>{intro}</p>
            {!isApproved && (
              <p className={styles.draftNotice} role="note">
                Draft for review. Operator details and final legal text must be
                approved before production launch.
              </p>
            )}
            <Link href="/request-demo">Request a demo</Link>
          </div>
          <div className={styles.legalContent}>{children}</div>
        </div>
      </article>
    </MarketingShell>
  );
}
