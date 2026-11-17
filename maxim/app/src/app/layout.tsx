import type {Metadata, Viewport} from 'next';
import {Providers} from '../components/maxim/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Maxim Apply | Workspace',
  description: 'Private Maxim Apply workspace',
  robots: {index: false, follow: false},
  referrer: 'no-referrer',
  icons: {icon: '/maxim-mark.svg'},
};

export const viewport: Viewport = {width: 'device-width', initialScale: 1, themeColor: '#242927'};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="en" data-theme="light" data-astryx-theme="neutral">
    <body><Providers>{children}</Providers></body>
  </html>;
}
