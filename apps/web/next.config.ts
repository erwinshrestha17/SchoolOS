import type { NextConfig } from 'next';

const marketingRoutes = [
  '/',
  '/product',
  '/solutions',
  '/security',
  '/privacy',
  '/terms',
  '/request-demo',
];

function marketingCsp(): string {
  let apiOrigin = '';
  try {
    apiOrigin = new URL(process.env.NEXT_PUBLIC_API_BASE_URL ?? '').origin;
  } catch {
    // The API configuration is validated separately before public launch.
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ''}`,
    "worker-src 'self'",
  ].join('; ');
}

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  transpilePackages: ['@schoolos/core'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          ...(process.env.NODE_ENV === 'production'
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000',
                },
              ]
            : []),
        ],
      },
      ...(process.env.NODE_ENV === 'production'
        ? marketingRoutes.map((source) => ({
            source,
            headers: [
              { key: 'Content-Security-Policy', value: marketingCsp() },
            ],
          }))
        : []),
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          { key: 'Service-Worker-Allowed', value: '/' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self'; connect-src 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
