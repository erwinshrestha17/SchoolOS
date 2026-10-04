import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import styles from '../../app/landing.module.css';

export function MarketingCta({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className={styles.finalCta} aria-labelledby="marketing-cta-title">
      <div className={`${styles.container} ${styles.finalCtaInner}`}>
        <div>
          <h2 id="marketing-cta-title">{title}</h2>
          <p>{description}</p>
        </div>
        <Link className={styles.finalButton} href="/request-demo">
          Request a demo <ArrowUpRight size={20} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
