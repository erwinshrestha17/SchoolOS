import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '../../components/marketing/legal-page';
import {
  getMarketingPublication,
  marketingCanonical,
  marketingRobots,
} from '../../lib/marketing-publication';

export const metadata: Metadata = {
  title: 'Privacy Policy | SchoolOS',
  description:
    'How SchoolOS handles information submitted through its public website and demo request form.',
  alternates: marketingCanonical('/privacy')
    ? { canonical: marketingCanonical('/privacy') }
    : undefined,
  robots: marketingRobots(),
};

export default function PrivacyPage() {
  const details = getMarketingPublication();

  return (
    <LegalPage
      title="Privacy Policy"
      intro="How information submitted through the SchoolOS website and demo request form is handled."
      isApproved={details.isPublicLaunchReady}
    >
      <section>
        <h2>Operator and scope</h2>
        <p>
          This website is operated by {details.operatorName}. The production
          website address is {details.siteUrlDisplay}. This notice covers the
          public website and requests for a SchoolOS demo. A school’s use of
          SchoolOS requires separate service and data-handling terms.
        </p>
        <p>Effective date: {details.legalEffectiveDate}.</p>
      </section>
      <section>
        <h2>Information you provide</h2>
        <p>
          The demo form collects school name, type, location, approximate
          student count, contact name and role, phone number, email address,
          rollout timing, and any optional preferences, product interests, or
          message you enter. Please do not include student records or other
          sensitive personal information in a demo request.
        </p>
      </section>
      <section>
        <h2>How a demo request is used</h2>
        <p>
          A submitted request is stored so authorized SchoolOS platform staff
          can review it, respond to you, and plan a relevant demonstration or
          onboarding discussion. A demo request does not automatically create a
          school workspace.
        </p>
      </section>
      <section>
        <h2>Retention and recipients</h2>
        <p>Demo request retention and deletion: {details.privacyRetention}.</p>
        <p>Data recipients and service providers: {details.dataRecipients}.</p>
      </section>
      <section>
        <h2>Cookies, analytics, and hosting</h2>
        <p>
          The current public marketing pages do not include third-party
          analytics or advertising tags. Sign-in and product features use
          browser session mechanisms.
        </p>
        <p>{details.cookieAndLogNotice}</p>
      </section>
      <section>
        <h2>Questions about your information</h2>
        <p>
          For a question or request concerning information submitted through
          this website, contact {details.privacyContactEmail}.
        </p>
        {!details.isPublicLaunchReady && (
          <p>
            The final policy review must confirm the request process and
            applicable rights before launch.
          </p>
        )}
        <p>
          See the <Link href="/terms">Terms &amp; Conditions</Link> for the
          public website.
        </p>
      </section>
    </LegalPage>
  );
}
