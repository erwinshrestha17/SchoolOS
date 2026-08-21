import type { Metadata } from 'next';
import { Inter, Noto_Sans_Devanagari } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

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

export const metadata: Metadata = {
  title: 'SchoolOS',
  description:
    'SchoolOS — a Nepal-first, multi-tenant education operating system for Grade 1–12 school workflows.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${notoSansDevanagari.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
