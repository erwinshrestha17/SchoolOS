import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowUpRight,
  FileClock,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { MarketingCta } from '../../components/marketing/marketing-cta';
import { MarketingShell } from '../../components/marketing/marketing-shell';
import {
  marketingCanonical,
  marketingRobots,
} from '../../lib/marketing-publication';
import landing from '../landing.module.css';
import styles from '../marketing-detail.module.css';

export const metadata: Metadata = {
  title: 'Access and trust | SchoolOS',
  description:
    'Learn how SchoolOS approaches school context, role and resource scope, guardian relationships, and reviewable changes.',
  robots: marketingRobots(),
  alternates: marketingCanonical('/security')
    ? { canonical: marketingCanonical('/security') }
    : undefined,
  openGraph: {
    title: 'Access and trust | SchoolOS',
    description:
      'Thoughtful access boundaries for school records and daily work.',
    type: 'website',
  },
};

const decisions = [
  {
    number: '01',
    title: 'Confirm the school context',
    description:
      'The server uses the authenticated session to identify the school workspace for a request.',
  },
  {
    number: '02',
    title: 'Check the action and resource',
    description:
      'A role alone does not grant access to every student, class, file, or finance record.',
  },
  {
    number: '03',
    title: 'Check the relationship',
    description:
      'Teacher work follows active assignments. Guardian views depend on an active, verified link to the child.',
  },
  {
    number: '04',
    title: 'Respect workflow state',
    description:
      'Review, approval, finalization, and correction steps keep sensitive changes controlled.',
  },
];

export default function SecurityPage() {
  return (
    <MarketingShell>
      <section
        className={styles.securityHero}
        aria-labelledby="security-page-title"
      >
        <div className={`${landing.container} ${styles.securityHeroGrid}`}>
          <div>
            <h1 id="security-page-title">
              Access should follow responsibility.
            </h1>
            <p>
              SchoolOS is built around school, role, resource, and relationship
              boundaries. The server decides what a person may view or change.
            </p>
            <Link className={landing.primaryButton} href="/request-demo">
              Discuss your school’s needs{' '}
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.securityEmblem} aria-hidden="true">
            <ShieldCheck size={75} strokeWidth={1.1} />
          </div>
        </div>
      </section>

      <section
        className={styles.securityBody}
        aria-labelledby="security-model-title"
      >
        <div className={landing.container}>
          <div className={styles.sectionIntro}>
            <h2 id="security-model-title">
              A decision has more than one check.
            </h2>
            <p>
              School information is useful when the right person can reach it.
              Access is evaluated in context rather than inferred from a
              navigation link.
            </p>
          </div>
          <ol className={styles.securitySteps}>
            {decisions.map((decision) => (
              <li key={decision.number}>
                <span>{decision.number}</span>
                <div>
                  <h3>{decision.title}</h3>
                  <p>{decision.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        className={styles.securityDetails}
        aria-labelledby="records-title"
      >
        <div className={`${landing.container} ${styles.securityDetailGrid}`}>
          <div>
            <h2 id="records-title">Care for the records behind the work.</h2>
            <p>
              Identity documents, student support information, salary details,
              and other protected records need narrower access than an ordinary
              school update.
            </p>
          </div>
          <div className={styles.securityDetailList}>
            <div>
              <LockKeyhole size={25} strokeWidth={1.6} aria-hidden="true" />
              <div>
                <h3>Protected files</h3>
                <p>
                  Private school files use authenticated, role-scoped access
                  paths.
                </p>
              </div>
            </div>
            <div>
              <FileClock size={25} strokeWidth={1.6} aria-hidden="true" />
              <div>
                <h3>Reviewable changes</h3>
                <p>
                  Sensitive workflows retain actor, time, state, and reason
                  evidence where required.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className={`${landing.container} ${styles.securityFoot}`}>
          <p>
            Module availability and data access are confirmed during guided
            school setup.
          </p>
          <Link className={styles.inlineLink} href="/product">
            Explore the product <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
      <MarketingCta
        title="Explore SchoolOS with confidence."
        description="Tell us about your school’s roles and workflows. We’ll discuss the access and setup needs together."
      />
    </MarketingShell>
  );
}
