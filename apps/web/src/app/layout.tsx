import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Система обліку майна МВО',
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
      <body>{children}</body>
    </html>
  );
}
