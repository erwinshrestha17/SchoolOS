import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '../../components/marketing/legal-page';
import {
  getMarketingPublication,
  marketingCanonical,
  marketingRobots,
} from '../../lib/marketing-publication';

export const metadata: Metadata = {
  title: 'Terms & Conditions | SchoolOS',
  description:
    'Terms for using the public SchoolOS website and requesting a product demonstration.',
  alternates: marketingCanonical('/terms')
    ? { canonical: marketingCanonical('/terms') }
    : undefined,
  robots: marketingRobots(),
};

export default function TermsPage() {
  const details = getMarketingPublication();

  return (
    <LegalPage
      title="Terms & Conditions"
      intro="Terms for browsing this website and asking to see SchoolOS in your school context."
      isApproved={details.isPublicLaunchReady}
    >
      <section>
        <h2>Operator and effective date</h2>
        <p>
          This website is operated by {details.operatorName} at{' '}
          {details.siteUrlDisplay}. These terms take effect on{' '}
          {details.legalEffectiveDate} after approval and publication.
        </p>
      </section>
      <section>
        <h2>Public website</h2>
        <p>
          The public pages describe SchoolOS and provide a way to request a
          demo. Product illustrations use example data. Descriptions of modules,
          access, and workflows are informational; availability depends on
          school setup, entitlements, and release readiness.
        </p>
      </section>
      <section>
        <h2>Demo requests</h2>
        <p>
          Please provide accurate contact and school information when asking for
          a demo, and do not submit student records or other sensitive personal
          information in the free-text field. A request starts a conversation;
          it does not create a school workspace, purchase a subscription, or
          promise a deployment date.
        </p>
      </section>
      <section>
        <h2>SchoolOS product use</h2>
        <p>
          Access to a school workspace, commercial terms, data processing,
          support, and service commitments must be set out in a separate
          approved agreement with the school. These public website terms do not
          replace that agreement.
        </p>
      </section>
      <section>
        <h2>Legal review and contact</h2>
        <p>Governing law and dispute process: {details.governingLaw}.</p>
        {!details.isPublicLaunchReady && (
          <p>
            Final publication also requires review of acceptable use,
            intellectual property, service availability, and liability language.
          </p>
        )}
        <p>
          Questions about these terms can be sent to{' '}
          {details.privacyContactEmail}. For handling of demo request details,
          see the <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
