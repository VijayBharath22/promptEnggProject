import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'TestForge AI — API test generation', description: 'Evidence-grounded API test generation and quality evaluation.' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
