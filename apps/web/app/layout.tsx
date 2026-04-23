import { Fraunces, Manrope } from 'next/font/google';
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'SchoolOS Admin',
  description: 'SchoolOS web admin for admissions, attendance, finance, and communications.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable}`}>
      <body
        style={{
          fontFamily: 'var(--font-body)',
        }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
