import type { Metadata } from 'next'
// import { Inter } from 'next/font/google'
import './globals.css'

// const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '目線入れ',
  description: '画像に目線を入れることに特化したシンプルなアプリ',
  icons: {
    icon: '/favicon.png',
  },
  openGraph: {
    title: '目線入れ',
    description: '画像に目線を入れることに特化したシンプルなアプリ',
    images: [
      {
        url: '/ogp04.webp',
        width: 1200,
        height: 832,
        alt: '目線入れ',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '目線入れ',
    description: '画像に目線を入れることに特化したシンプルなアプリ',
    images: ['/ogp04.webp'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        <link rel="preload" href="/font-subsets/Mamelon-3.5-Hi-Regular-subset-208bb2207d62a5e1f8113f7b31fe0a84.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="stylesheet" href="/Mamelon-3.5-Hi-Regular.css" />
      </head>
      <body>{children}</body>
    </html>
  )
}