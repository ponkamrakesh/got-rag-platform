import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Citadel RAG — Game of Thrones Intelligence',
  description:
    'A Retrieval-Augmented Generation platform indexing the complete A Song of Ice & Fire corpus. Maps, lineages, and lore—nothing is forgotten.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-iron-900 text-zinc-100">
        {children}
      </body>
    </html>
  )
}
