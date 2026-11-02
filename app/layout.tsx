import './globals.css'
import { Suspense } from 'react'
import { Inter } from 'next/font/google'
import AppShell from '@/components/AppShell'
import Feedback from '@/components/Feedback'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata = {
  title: 'ComplianceOS',
  description: 'Stay Compliant. Always.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <Suspense fallback={null}>
          <AppShell>{children}</AppShell>
        </Suspense>
        <Feedback />
      </body>
    </html>
  )
}