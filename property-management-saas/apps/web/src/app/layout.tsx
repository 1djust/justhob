import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/ThemeProvider';
import { RealtimeProvider } from '@/components/providers/RealtimeProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'EstateOS - Property Management',
  description: 'Manage your properties with ease',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <RealtimeProvider>
            {children}
            <Toaster position="top-right" richColors closeButton />
          </RealtimeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
