import type { Metadata } from 'next';
import { Inter, Noto_Sans_Devanagari } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { getMarketingPublication } from '../lib/marketing-publication';

const inter = Inter({
  subsets: ['latin'],
  preload: false,
  variable: '--font-sans',
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  preload: false,
  variable: '--font-devanagari',
});

const publication = getMarketingPublication();

export const metadata: Metadata = {
  metadataBase: publication.siteUrl ?? undefined,
  title: 'SchoolOS',
  description:
    'SchoolOS — a Nepal-first, multi-tenant education operating system for Grade 1–12 school workflows.',
  robots: { index: false, follow: false },
  ...(publication.siteUrl
    ? {
        openGraph: {
          type: 'website' as const,
          images: ['/opengraph-image'],
        },
        twitter: {
          card: 'summary_large_image' as const,
          images: ['/opengraph-image'],
        },
      }
    : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${notoSansDevanagari.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
