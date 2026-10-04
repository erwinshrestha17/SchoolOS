import Link from 'next/link';
import styles from '../../app/landing.module.css';

export function MarketingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerGrid}`}>
        <div>
          <Link className={styles.footerBrand} href="/">
            <span className={styles.brandMark} aria-hidden="true">
              <span />
            </span>
            SchoolOS
          </Link>
          <p>School operating system for Nepal.</p>
        </div>
        <div>
          <span>EXPLORE</span>
          <Link href="/product">Product</Link>
          <Link href="/solutions">Solutions</Link>
          <Link href="/security">Security</Link>
        </div>
        <div>
          <span>GET STARTED</span>
          <Link href="/request-demo">Request a demo</Link>
          <Link href="/login">Sign in</Link>
        </div>
        <div>
          <span>LEGAL</span>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms &amp; Conditions</Link>
        </div>
        <div className={styles.footerEnd}>
          <span>Built for thoughtful school operations.</span>
          <span>© {new Date().getFullYear()} SchoolOS</span>
        </div>
      </div>
    </footer>
  );
}
