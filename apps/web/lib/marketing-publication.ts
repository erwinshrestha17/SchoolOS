const placeholder = {
  operatorName: '[LEGAL_OPERATOR_NAME]',
  privacyContactEmail: '[PRIVACY_CONTACT_EMAIL]',
  siteUrl: '[PRODUCTION_URL]',
  privacyRetention: '[DEMO_REQUEST_RETENTION_AND_DELETION_RULE]',
  dataRecipients: '[DATA_RECIPIENTS_AND_PROCESSORS]',
  cookieAndLogNotice: '[COOKIE_SESSION_AND_HOSTING_LOG_NOTICE]',
  governingLaw: '[GOVERNING_LAW_AND_DISPUTE_PROCESS]',
  legalEffectiveDate: '[EFFECTIVE_DATE]',
} as const;

function configured(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

export function getMarketingPublication() {
  const operatorName = configured(
    process.env.SCHOOLOS_LEGAL_OPERATOR_NAME,
    placeholder.operatorName,
  );
  const privacyContactEmail = configured(
    process.env.SCHOOLOS_PRIVACY_CONTACT_EMAIL,
    placeholder.privacyContactEmail,
  );
  const siteUrlValue = configured(
    process.env.SCHOOLOS_PUBLIC_SITE_URL,
    placeholder.siteUrl,
  );
  const privacyRetention = configured(
    process.env.SCHOOLOS_PRIVACY_RETENTION,
    placeholder.privacyRetention,
  );
  const dataRecipients = configured(
    process.env.SCHOOLOS_DATA_RECIPIENTS,
    placeholder.dataRecipients,
  );
  const cookieAndLogNotice = configured(
    process.env.SCHOOLOS_COOKIE_AND_LOG_NOTICE,
    placeholder.cookieAndLogNotice,
  );
  const governingLaw = configured(
    process.env.SCHOOLOS_TERMS_GOVERNING_LAW,
    placeholder.governingLaw,
  );
  const legalEffectiveDate = configured(
    process.env.SCHOOLOS_LEGAL_EFFECTIVE_DATE,
    placeholder.legalEffectiveDate,
  );
  let siteUrl: URL | null = null;

  if (siteUrlValue !== placeholder.siteUrl) {
    try {
      const candidate = new URL(siteUrlValue);
      if (
        candidate.protocol === 'https:' &&
        candidate.pathname === '/' &&
        !candidate.username &&
        !candidate.password &&
        !candidate.search &&
        !candidate.hash
      ) {
        siteUrl = new URL(candidate.origin);
      }
    } catch {
      // An invalid URL keeps public indexing disabled until configuration is fixed.
    }
  }

  const legalDetailsConfigured =
    operatorName !== placeholder.operatorName &&
    privacyContactEmail !== placeholder.privacyContactEmail &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(privacyContactEmail) &&
    privacyRetention !== placeholder.privacyRetention &&
    dataRecipients !== placeholder.dataRecipients &&
    cookieAndLogNotice !== placeholder.cookieAndLogNotice &&
    governingLaw !== placeholder.governingLaw &&
    legalEffectiveDate !== placeholder.legalEffectiveDate;
  const legalTextApproved =
    process.env.SCHOOLOS_LEGAL_POLICY_APPROVED === 'true';
  const httpsApiConfigured = (() => {
    try {
      return (
        new URL(process.env.NEXT_PUBLIC_API_BASE_URL ?? '').protocol ===
        'https:'
      );
    } catch {
      return false;
    }
  })();

  return {
    operatorName,
    privacyContactEmail,
    privacyRetention,
    dataRecipients,
    cookieAndLogNotice,
    governingLaw,
    legalEffectiveDate,
    siteUrl,
    siteUrlDisplay: siteUrl?.origin ?? placeholder.siteUrl,
    isPublicLaunchReady: Boolean(
      siteUrl &&
      legalDetailsConfigured &&
      legalTextApproved &&
      httpsApiConfigured,
    ),
  };
}

export function marketingCanonical(path: string): string | undefined {
  const publication = getMarketingPublication();
  return publication.siteUrl
    ? new URL(path, publication.siteUrl).toString()
    : undefined;
}

export function marketingRobots() {
  return getMarketingPublication().isPublicLaunchReady
    ? { index: true, follow: true }
    : { index: false, follow: false };
}
