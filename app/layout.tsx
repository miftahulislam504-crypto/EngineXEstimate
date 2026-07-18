import type { Metadata, Viewport } from 'next'
import './globals.css'
import { LanguageProvider } from '@/components/providers/LanguageProvider'

// নোট: Hub-এর layout.tsx-এ ToastProvider, OfflineIndicator ব্যবহার
// হয়েছে (components/shared/ থেকে) — এই scaffold-এ সেগুলো কপি করা
// হয়নি, শুধু base project structure তৈরি করাই ছিল লক্ষ্য। প্রয়োজন
// হলে Hub থেকে এনে একইভাবে যোগ করা যাবে।
//
// LanguageProvider এখানে যোগ করা হলো (en↔bn সুইচিং)।
//
// ⚠️ জানা সীমাবদ্ধতা: <html lang="bn"> ডিফল্ট বসানো হয়েছে (app-টা
// মূলত বাংলা-প্রথম), কিন্তু এই attribute ভাষা toggle করলে
// automatically বদলাবে না — কারণ RootLayout একটা server component,
// আর useLang() client-side state, দুটো সরাসরি sync করা এই scaffold-এ
// implement করা হয়নি (সম্ভাব্য সমাধান: client-side effect দিয়ে
// document.documentElement.lang সরাসরি বদলানো, ভবিষ্যতে দরকার হলে
// যোগ করা যাবে)।

export const metadata: Metadata = {
  title: { default: 'CivilOS Estimating', template: '%s | CivilOS Estimating' },
  description: 'Estimating, Costing & BOQ — CivilOS Ecosystem',
  keywords: ['civil engineering', 'estimating', 'BOQ', 'BNBC', 'Bangladesh'],
}

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  )
}
