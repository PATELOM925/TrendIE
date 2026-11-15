import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Guard Console · Agentic Payment Guard',
  description: 'Review agent purchase proposals against trusted purchase intent.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
