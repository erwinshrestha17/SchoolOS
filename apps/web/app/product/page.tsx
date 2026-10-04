import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Megaphone,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  DashboardPreview,
  TeacherPreview,
} from '../../components/marketing/landing-previews';
import { MarketingCta } from '../../components/marketing/marketing-cta';
import { MarketingShell } from '../../components/marketing/marketing-shell';
import {
  marketingCanonical,
  marketingRobots,
} from '../../lib/marketing-publication';
import landing from '../landing.module.css';
import styles from '../marketing-detail.module.css';

export const metadata: Metadata = {
  title: 'Product | SchoolOS',
  description:
    'Explore how SchoolOS connects student records, attendance, academics, fees, and school communication for Nepal schools.',
  robots: marketingRobots(),
  alternates: marketingCanonical('/product')
    ? { canonical: marketingCanonical('/product') }
    : undefined,
  openGraph: {
    title: 'Product | SchoolOS',
    description: 'A connected workspace for the daily work of a Nepal school.',
    type: 'website',
  },
};

const workflows = [
  {
    icon: Users,
    title: 'Student context',
    description:
      'Bring admissions, guardians, attendance, academics, and fee context into a student record, with access controlled for each role.',
    detail: 'PEOPLE & RECORDS',
  },
  {
    icon: ClipboardCheck,
    title: 'Attendance',
    description:
      'Work from assigned rosters, record the school day, and handle corrections through a controlled review path.',
    detail: 'DAILY OPERATIONS',
  },
  {
    icon: GraduationCap,
    title: 'Academics',
    description:
      'Keep timetables, homework, assessments, and results connected while preserving review and publication boundaries.',
    detail: 'TEACHING & LEARNING',
  },
  {
    icon: WalletCards,
    title: 'Fees & receipts',
    description:
      'Track dues and collections with receipts, cashier controls, and reviewed accounting handoffs.',
    detail: 'SCHOOL FINANCE',
  },
  {
    icon: Megaphone,
    title: 'School communication',
    description:
      'Publish official Notices & Announcements separately from personal Notifications & Delivery status.',
    detail: 'COMMUNICATION',
  },
];

export default function ProductPage() {
  return (
    <MarketingShell>
      <section
        className={styles.detailHero}
        aria-labelledby="product-page-title"
      >
        <div className={`${landing.container} ${styles.detailHeroInner}`}>
          <div className={styles.heroCopy}>
            <h1 id="product-page-title">Bring the school day into focus.</h1>
            <p>
              SchoolOS connects the records and workflows school teams rely on,
              so the next action has the right context.
            </p>
            <div className={styles.heroActions}>
              <Link className={landing.primaryButton} href="/request-demo">
                Request a demo <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <a className={landing.secondaryButton} href="#workflows">
                See the workflows <ArrowRight size={18} aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className={styles.heroNote}>
            <span>ONE SCHOOL CONTEXT</span>
            <p>
              Designed for leadership, teachers, administrators, and linked
              families, with different views and permissions for each.
            </p>
          </div>
        </div>
        <div className={`${landing.container} ${styles.detailPreview}`}>
          <DashboardPreview />
        </div>
      </section>

      <section
        id="workflows"
        className={styles.workflowSection}
        aria-labelledby="workflows-title"
      >
        <div className={landing.container}>
          <div className={styles.sectionIntro}>
            <h2 id="workflows-title">The important work, connected.</h2>
            <p>
              Each area has its own controls. Together, they give a school a
              clearer view of the day without making one role responsible for
              everything.
            </p>
          </div>
          <div className={styles.workflowRows}>
            {workflows.map((workflow) => (
              <div className={styles.workflowRow} key={workflow.title}>
                <div className={styles.workflowIcon}>
                  <workflow.icon
                    size={23}
                    strokeWidth={1.7}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <span className={styles.rowDetail}>{workflow.detail}</span>
                  <h3>{workflow.title}</h3>
                </div>
                <p>{workflow.description}</p>
              </div>
            ))}
          </div>
          <p className={styles.scopeNote}>
            <FileText size={17} aria-hidden="true" /> Available modules depend
            on school setup, entitlements, permissions, and release readiness.
          </p>
        </div>
      </section>

      <section
        className={styles.splitSection}
        aria-labelledby="product-roles-title"
      >
        <div className={`${landing.container} ${styles.splitGrid}`}>
          <div className={styles.splitCopy}>
            <h2 id="product-roles-title">
              One system. Different responsibilities.
            </h2>
            <p>
              School leadership needs oversight. Teachers need their assigned
              classes and the next task. Parents need a clear view of the child
              they are authorized to follow.
            </p>
            <p>
              SchoolOS keeps those experiences connected while the backend
              remains the authority for access and school records.
            </p>
            <Link className={styles.inlineLink} href="/solutions">
              Explore role-based experiences{' '}
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.teacherPanel}>
            <TeacherPreview />
          </div>
        </div>
      </section>
      <MarketingCta
        title="See SchoolOS in your school context."
        description="Tell us about your priorities, and we’ll show you the workflows that fit your team."
      />
    </MarketingShell>
  );
}
