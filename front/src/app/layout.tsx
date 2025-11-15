import { RootProviders } from '@/components/RootProviders';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chat RAG',
  description: 'Chat with RAG',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
