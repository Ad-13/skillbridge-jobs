import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Jobs App',
  description: 'Job posting analysis — SSO demo',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
