import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

// 📱 讓行動版鍵盤彈起時自動重算 Viewport 高度，防止輸入框被遮擋
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  interactiveWidget: 'resizes-content',
}

export const metadata: Metadata = {
  title: 'Perry 獨旅 AI 幫手 🧳',
  description: '@allonetrip_perry 專屬行程規劃，一鍵為你打造專屬的獨旅行程！',
  openGraph: {
    title: 'Perry 獨旅 AI 幫手 🧳',
    description: '一鍵自動規劃你的專屬獨旅行程！從景點到機票，AI 幫你搞定。',
    url: 'https://allonetrip-ai.vercel.app/',
    siteName: 'Perry 獨旅 AI 幫手',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1488085061387-422e29b40080?q=80&w=1200&h=630&auto=format&fit=crop', 
        width: 1200,
        height: 630,
        alt: 'Perry 獨旅 AI 幫手 - 行程規劃預覽',
      },
    ],
    locale: 'zh_TW',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Perry 獨旅 AI 幫手 🧳',
    description: '一鍵自動規劃你的專屬獨旅行程！從景點到機票，AI 幫你搞定。',
    images: ['https://images.unsplash.com/photo-1488085061387-422e29b40080?q=80&w=1200&h=630&auto=format&fit=crop'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body className={inter.className}>{children}</body>
    </html>
  )
}