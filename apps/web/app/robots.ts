import type { MetadataRoute } from 'next';
import { getMarketingPublication } from '../lib/marketing-publication';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const publication = getMarketingPublication();
  if (!publication.isPublicLaunchReady || !publication.siteUrl) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/platform',
        '/classroom',
        '/student',
        '/parent',
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password',
      ],
    },
    sitemap: new URL('/sitemap.xml', publication.siteUrl).toString(),
  };
}
