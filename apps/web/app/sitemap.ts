import type { MetadataRoute } from 'next';
import { getMarketingPublication } from '../lib/marketing-publication';

export const dynamic = 'force-dynamic';

const publicPaths = [
  '/',
  '/product',
  '/solutions',
  '/security',
  '/privacy',
  '/terms',
  '/request-demo',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const publication = getMarketingPublication();
  if (!publication.isPublicLaunchReady || !publication.siteUrl) return [];

  return publicPaths.map((path) => ({
    url: new URL(path, publication.siteUrl!).toString(),
  }));
}
