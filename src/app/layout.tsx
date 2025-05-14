
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import PWARegistration from '@/components/PWARegistration';
import { AuthProvider } from '@/contexts/AuthContext'; // Import AuthProvider

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
  themeColor: '#0A0F1E', 
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
        <AuthProvider> {/* Wrap children with AuthProvider */}
          {children}
        </AuthProvider>
        <PWARegistration />
      </body>
    </html>
  );
}
