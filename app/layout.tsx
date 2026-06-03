import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Paciente Virtual IA',
  description: 'Sistema de entrenamiento médico con avatares IA',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}