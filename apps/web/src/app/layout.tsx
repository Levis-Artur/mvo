import type { Metadata } from 'next';
import { Inter, Roboto_Condensed } from 'next/font/google';
import { AuthProvider } from './ui/auth-context';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
});

const robotoCondensed = Roboto_Condensed({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-roboto-condensed',
  weight: ['600', '700'],
});

export const metadata: Metadata = {
  title: 'Інформаційна система обліку майна',
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
      <body className={`${inter.variable} ${robotoCondensed.variable}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
