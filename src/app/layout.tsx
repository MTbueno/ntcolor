import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import PWARegistration from '@/components/PWARegistration';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});


export const metadata: Metadata = {
  title: 'Note.Colors',
  description: 'Organize suas ideias rápidas.',
  manifest: '/manifest.json',
  icons: {
    apple: '/apple-touch-icon.png',
  },
};

export const viewport = {
  themeColor: '#0A0F1E', // Dark theme color
  // Setting initial-scale, maximum-scale, and user-scalable to prevent auto-zoom on input focus on iOS
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, 
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} dark font-sans` }>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="antialiased">
        {children}
        <PWARegistration />
      </body>
    </html>
  );
}
