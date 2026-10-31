import './globals.css'
import { Suspense } from 'react'
import AppShell from '@/components/AppShell'

export const metadata = {
  title: 'ComplianceOS',
  description: 'Stay Compliant. Always.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Suspense fallback={null}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  )
}