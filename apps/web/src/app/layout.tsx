import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from './ui/auth-context';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Облік майна МВО',
  description:
    'Централізований облік надходжень, залишків, видачі та передачі майна',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body className={inter.variable}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
