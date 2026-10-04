import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  CircleHelp,
  ClipboardCheck,
  GraduationCap,
  LockKeyhole,
  Megaphone,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { MarketingCta } from '../components/marketing/marketing-cta';
import { MarketingShell } from '../components/marketing/marketing-shell';
import {
  getMarketingPublication,
  marketingCanonical,
  marketingRobots,
} from '../lib/marketing-publication';
import {
  DashboardPreview,
  ParentPreview,
  TeacherPreview,
} from '../components/marketing/landing-previews';
import styles from './landing.module.css';

export const metadata: Metadata = {
  title: 'SchoolOS | One connected place to run your school',
  description:
    'SchoolOS connects daily operations, attendance, academics, fees, and school communication for Nepal schools.',
  robots: marketingRobots(),
  alternates: marketingCanonical('/')
    ? { canonical: marketingCanonical('/') }
    : undefined,
  openGraph: {
    title: 'SchoolOS | One connected place to run your school',
    description:
      'Daily school operations, attendance, academics, fees, and communication in one connected platform for Nepal schools.',
    type: 'website',
  },
};

const workflowItems = [
  {
    icon: ClipboardCheck,
    title: 'Attendance',
    description: 'Assigned rosters, daily records, and controlled corrections.',
  },
  {
    icon: GraduationCap,
    title: 'Academics',
    description: 'Classwork, timetables, assessments, and results workflows.',
  },
  {
    icon: WalletCards,
    title: 'Fees & receipts',
    description: 'Dues, collections, receipts, and reviewed finance handoffs.',
  },
  {
    icon: Megaphone,
    title: 'Notices & Announcements',
    description:
      'Official school communication with audience and review controls.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Tell us about your school',
    description:
      'Share your school context and the daily workflows you want to improve.',
  },
  {
    number: '02',
    title: 'See the relevant workflows',
    description:
      'We walk through the product with your leadership and operations team.',
  },
  {
    number: '03',
    title: 'Plan a careful rollout',
    description:
      'Scope, access, data, and readiness are reviewed before a controlled pilot.',
  },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className={styles.eyebrow}>
      <span aria-hidden="true" />
      {children}
    </span>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id}>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

function TextLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link className={styles.textLink} href={href}>
      {children}
      <ArrowUpRight size={17} aria-hidden="true" />
    </Link>
  );
}

export default function LandingPage() {
  const publication = getMarketingPublication();
  const structuredData = publication.isPublicLaunchReady
    ? JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'SchoolOS',
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Web',
        url: publication.siteUrl?.toString(),
        publisher: {
          '@type': 'Organization',
          name: publication.operatorName,
        },
      }).replace(/</g, '\\u003c')
    : null;

  return (
    <MarketingShell>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: structuredData }}
        />
      )}
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <Eyebrow>School operating system for Nepal</Eyebrow>
            <h1 id="hero-title">
              One connected place to <span>run your school.</span>
            </h1>
            <p>
              SchoolOS brings daily operations, attendance, academics, fees, and
              school communication together for leadership, teachers, and
              families.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/request-demo">
                Request a demo <ArrowUpRight size={19} aria-hidden="true" />
              </Link>
              <Link className={styles.secondaryButton} href="/product">
                Explore the product <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
            <div className={styles.heroNote}>
              <ShieldCheck size={17} aria-hidden="true" />
              <span>
                Guided setup for Nepal schools. Availability is confirmed during
                onboarding.
              </span>
            </div>
          </div>
          <div className={styles.heroSideNote}>
            <span className={styles.heroSideRule} />
            <span>FROM THE SCHOOL DAY TO THE BIG PICTURE</span>
            <p>Clarity for the people who keep a school moving.</p>
          </div>
        </div>
        <div className={`${styles.container} ${styles.heroPreview}`}>
          <DashboardPreview />
        </div>
      </section>

      <section
        className={styles.introStrip}
        aria-label="SchoolOS connects school workflows"
      >
        <div className={styles.container}>
          <span>ONE SCHOOL. ONE SHARED VIEW.</span>
          <p>
            Leadership sees what needs attention. Teachers can focus on their
            classes. Families stay informed through the mobile companion.
          </p>
          <ArrowRight size={22} aria-hidden="true" />
        </div>
      </section>

      <section
        id="product"
        className={styles.productSection}
        aria-labelledby="product-title"
      >
        <div className={styles.container}>
          <div className={styles.productIntro}>
            <div>
              <Eyebrow>Connected operations</Eyebrow>
              <h2 id="product-title">
                The work of a school,
                <br />
                <em>working together.</em>
              </h2>
            </div>
            <p>
              Move between student records, classroom work, communication, and
              finance with a consistent school context. Each workflow keeps its
              own controls and approvals.
            </p>
          </div>
          <div className={styles.workflowGrid}>
            {workflowItems.map((item, index) => (
              <div className={styles.workflowItem} key={item.title}>
                <span className={styles.workflowNumber}>0{index + 1}</span>
                <item.icon size={25} strokeWidth={1.6} aria-hidden="true" />
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            ))}
          </div>
          <div className={styles.productFootnote}>
            <span>
              <Bell size={18} aria-hidden="true" /> Notifications & Delivery
              keeps personal alerts and channel status distinct from official
              notices.
            </span>
            <span>
              Modules depend on school setup, permissions, and release
              readiness.
            </span>
          </div>
          <div className={styles.productMore}>
            <TextLink href="/product">Explore the product</TextLink>
          </div>
        </div>
      </section>

      <section
        id="for-schools"
        className={styles.personaSection}
        aria-labelledby="persona-title"
      >
        <div className={styles.container}>
          <SectionHeading
            id="persona-title"
            eyebrow="Built around your people"
            title="A clearer day for everyone at school."
            description="Shared information becomes useful when each person sees the work that belongs to them."
          />
          <div className={styles.leadershipBlock}>
            <div className={styles.leadershipCopy}>
              <span className={styles.personaIndex}>
                01 / SCHOOL LEADERSHIP
              </span>
              <h3>See what needs your attention. Then act with context.</h3>
              <p>
                School leaders can review attendance completion, follow
                operational work, and see decisions that need a closer look, all
                within their authorized school workspace.
              </p>
              <ul>
                <li>
                  <Check size={16} /> School-wide operational overview
                </li>
                <li>
                  <Check size={16} /> Review queues and follow-up
                </li>
                <li>
                  <Check size={16} /> Student and staff context
                </li>
              </ul>
              <TextLink href="/solutions#schools">
                For school leadership
              </TextLink>
            </div>
            <div className={styles.leadershipVisual}>
              <div className={styles.leadershipVisualHeader}>
                <span>School day status</span>
                <span>Example Secondary School</span>
              </div>
              <div className={styles.leadershipVisualMain}>
                <div>
                  <small>ATTENDANCE</small>
                  <strong>
                    18 <span>/ 25 classes</span>
                  </strong>
                  <p>Registers submitted today</p>
                </div>
                <div className={styles.leadershipMiniBars} aria-hidden="true">
                  <span style={{ height: '46%' }} />
                  <span style={{ height: '68%' }} />
                  <span style={{ height: '58%' }} />
                  <span style={{ height: '83%' }} />
                  <span style={{ height: '71%' }} />
                  <span style={{ height: '92%' }} />
                  <span style={{ height: '76%' }} />
                </div>
              </div>
              <div className={styles.leadershipVisualFooter}>
                <span>
                  <span className={styles.smallPulse} /> 2 items require review
                </span>
                <ArrowUpRight size={16} />
              </div>
              <span className={styles.previewCaption}>
                Illustrative preview · Example data
              </span>
            </div>
          </div>
          <div className={styles.personaGrid}>
            <article className={styles.teacherCard}>
              <div className={styles.personaCardCopy}>
                <span className={styles.personaIndex}>02 / TEACHERS</span>
                <h3>Less admin between teaching moments.</h3>
                <p>
                  Open assigned classes, take attendance, and keep the
                  day&apos;s classroom work in view.
                </p>
                <TextLink href="/solutions#teachers">For teachers</TextLink>
              </div>
              <TeacherPreview />
            </article>
            <article className={styles.parentCard}>
              <div className={styles.personaCardCopy}>
                <span className={styles.personaIndex}>
                  03 / PARENTS & GUARDIANS
                </span>
                <h3>Closer to the school day.</h3>
                <p>
                  Linked guardians can follow their child&apos;s available
                  records, official notices, and important updates in the Parent
                  Mobile Companion.
                </p>
                <TextLink href="/solutions#parents">For parents</TextLink>
              </div>
              <ParentPreview />
            </article>
          </div>
        </div>
      </section>

      <section className={styles.nepalSection} aria-labelledby="nepal-title">
        <div className={`${styles.container} ${styles.nepalGrid}`}>
          <div>
            <Eyebrow>Made for Nepal schools</Eyebrow>
            <h2 id="nepal-title">
              Grounded in how schools here actually operate.
            </h2>
          </div>
          <div>
            <p>
              From NPR fee records to Nepali and English text, Nepal time, and
              BS date presentation, SchoolOS is designed around the context
              schools work in every day.
            </p>
            <div className={styles.nepalDetails}>
              <span>NEPAL TIME</span>
              <span>NPR RECORDS</span>
              <span>BS + AD DATES</span>
              <span>ENGLISH + NEPALI</span>
            </div>
          </div>
        </div>
      </section>

      <section
        id="trust"
        className={styles.trustSection}
        aria-labelledby="trust-title"
      >
        <div className={`${styles.container} ${styles.trustGrid}`}>
          <div>
            <Eyebrow>Trust by design</Eyebrow>
            <h2 id="trust-title">
              School records deserve thoughtful boundaries.
            </h2>
            <p>
              SchoolOS treats identity, permissions, and sensitive records as
              part of daily operations, not an afterthought.
            </p>
            <div className={styles.trustMore}>
              <TextLink href="/security">How access works</TextLink>
            </div>
          </div>
          <div className={styles.trustList}>
            <div>
              <LockKeyhole size={24} />
              <div>
                <h3>Access follows responsibility</h3>
                <p>
                  Staff workspaces use role and resource checks. Guardian access
                  is tied to a verified, active relationship with a child.
                </p>
              </div>
            </div>
            <div>
              <ShieldCheck size={24} />
              <div>
                <h3>School context stays scoped</h3>
                <p>
                  School records are accessed within authenticated tenant and
                  permission boundaries.
                </p>
              </div>
            </div>
            <div>
              <CircleHelp size={24} />
              <div>
                <h3>Changes leave a trail</h3>
                <p>
                  Controlled workflows retain history and review evidence where
                  needed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className={styles.processSection}
        aria-labelledby="process-title"
      >
        <div className={styles.container}>
          <SectionHeading
            id="process-title"
            eyebrow="A considered start"
            title="Start with a conversation. Roll out with care."
            description="SchoolOS workspaces are created through guided onboarding, with scope and readiness reviewed for each school."
          />
          <div className={styles.stepGrid}>
            {steps.map((step) => (
              <div key={step.number} className={styles.step}>
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MarketingCta
        title="A more connected school day starts here."
        description="Tell us what matters to your team. We'll show you the workflows that fit and discuss a practical rollout."
      />
    </MarketingShell>
  );
}
