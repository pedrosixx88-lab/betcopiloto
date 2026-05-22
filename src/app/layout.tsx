import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import ServiceWorkerRegistrar from '@/components/service-worker-registrar'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BetCopiloto — Seu segundo cérebro nas apostas',
  description: 'Registre apostas, acompanhe sua performance e receba bilhetes personalizados com IA.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'BetCopiloto' },
}

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} dark h-full`}>
      <body className="min-h-full bg-background text-foreground antialiased font-sans">
        {children}
        <Toaster richColors position="top-center" />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
