import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check } from 'lucide-react';
import {
  DashboardPreview,
  ParentPreview,
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
  title: 'Solutions for schools, teachers and parents | SchoolOS',
  description:
    'See how SchoolOS supports school leadership, assigned teachers, and linked parents with role-appropriate workspaces.',
  robots: marketingRobots(),
  alternates: marketingCanonical('/solutions')
    ? { canonical: marketingCanonical('/solutions') }
    : undefined,
  openGraph: {
    title: 'Solutions | SchoolOS',
    description:
      'The right SchoolOS view for each part of the school community.',
    type: 'website',
  },
};

export default function SolutionsPage() {
  return (
    <MarketingShell>
      <section
        className={styles.solutionsHero}
        aria-labelledby="solutions-page-title"
      >
        <div className={`${landing.container} ${styles.solutionsHeroGrid}`}>
          <div>
            <h1 id="solutions-page-title">
              The right view for every part of the school.
            </h1>
          </div>
          <div>
            <p>
              Leadership, teachers, and families share one school context. Each
              sees the work and information relevant to their responsibility.
            </p>
            <Link className={styles.inlineLink} href="/request-demo">
              Talk through your school’s needs{' '}
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <nav
          className={`${landing.container} ${styles.roleNav}`}
          aria-label="Solutions on this page"
        >
          <a href="#schools">
            School leadership <ArrowRight size={16} aria-hidden="true" />
          </a>
          <a href="#teachers">
            Teachers <ArrowRight size={16} aria-hidden="true" />
          </a>
          <a href="#parents">
            Parents & guardians <ArrowRight size={16} aria-hidden="true" />
          </a>
        </nav>
      </section>

      <section
        id="schools"
        className={styles.roleSection}
        aria-labelledby="schools-title"
      >
        <div className={landing.container}>
          <div className={styles.roleHeading}>
            <div>
              <span>FOR SCHOOL LEADERSHIP</span>
              <h2 id="schools-title">Stay close to the whole school day.</h2>
            </div>
            <p>
              Follow attendance completion, review work that needs a decision,
              and move from a school-wide picture to the records behind it.
            </p>
          </div>
          <div className={styles.widePreview}>
            <DashboardPreview />
          </div>
          <div className={styles.roleBenefits}>
            <p>
              <Check size={17} aria-hidden="true" /> Operational attention in
              one place
            </p>
            <p>
              <Check size={17} aria-hidden="true" /> Review queues with context
            </p>
            <p>
              <Check size={17} aria-hidden="true" /> Role-scoped school records
            </p>
          </div>
        </div>
      </section>

      <section
        id="teachers"
        className={`${styles.roleSection} ${styles.teacherRole}`}
        aria-labelledby="teachers-title"
      >
        <div className={`${landing.container} ${styles.roleSplit}`}>
          <div className={styles.roleText}>
            <span>FOR TEACHERS</span>
            <h2 id="teachers-title">
              Get to the next class, without the detour.
            </h2>
            <p>
              Teachers can work from active assignments to see their classes,
              take attendance, and follow classroom tasks. Authority follows the
              assignment and the applicable school policy.
            </p>
            <ul>
              <li>Assigned class and roster context</li>
              <li>Attendance and timetable workflows</li>
              <li>Student information within permitted scope</li>
            </ul>
            <Link className={styles.inlineLink} href="/product">
              See SchoolOS workflows{' '}
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.teacherPanel}>
            <TeacherPreview />
          </div>
        </div>
      </section>

      <section
        id="parents"
        className={`${styles.roleSection} ${styles.parentRole}`}
        aria-labelledby="parents-title"
      >
        <div className={`${landing.container} ${styles.roleSplit}`}>
          <div className={styles.parentPanel}>
            <ParentPreview />
          </div>
          <div className={styles.roleText}>
            <span>FOR PARENTS & GUARDIANS</span>
            <h2 id="parents-title">Know what matters for your child.</h2>
            <p>
              Linked guardians use the SchoolOS Parent Mobile Companion for
              available child attendance, school notices, fee information where
              enabled, and important updates.
            </p>
            <p>
              Access depends on an active, verified relationship and the
              permissions for that child.
            </p>
            <Link className={styles.inlineLink} href="/security">
              Read about access boundaries{' '}
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <MarketingCta
        title="Bring your school community together."
        description="We’ll show your team the workflows relevant to your school and plan a careful rollout."
      />
    </MarketingShell>
  );
}
