import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { MarketingShell } from '../components/marketing/marketing-shell';
import landing from './landing.module.css';
import styles from './marketing-detail.module.css';

export const metadata: Metadata = {
  title: 'Page not found | SchoolOS',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <MarketingShell>
      <section className={styles.notFound} aria-labelledby="not-found-title">
        <div className={landing.container}>
          <span className={styles.notFoundCode}>404 / PAGE NOT FOUND</span>
          <h1 id="not-found-title">This page isn’t here.</h1>
          <p>
            The address may have changed. You can return to the SchoolOS
            homepage or explore the product.
          </p>
          <div className={styles.heroActions}>
            <Link className={landing.primaryButton} href="/">
              <ArrowLeft size={18} aria-hidden="true" /> Back to home
            </Link>
            <Link className={landing.secondaryButton} href="/product">
              Explore the product <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
