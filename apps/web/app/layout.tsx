import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'SalonOS | Point of sale', description: 'A considered checkout for a busy salon.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
