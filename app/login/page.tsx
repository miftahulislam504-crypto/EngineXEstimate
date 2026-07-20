// app/login/page.tsx
//
// এতদিন এই route-টা ছিলই না — components/auth/SignInForm.tsx তৈরি
// হয়েছিল কিন্তু কোনো page সেটা render করছিল না, ফলে app/page.tsx এর
// router.replace('/login') কল করলে Next.js 404 দিত। এই page সেই
// ফাঁকটা পূরণ করছে।
//
// LanguageProvider ও AuthProvider ইতিমধ্যে app/layout.tsx (root)-এ
// mount করা আছে, তাই এখানে আলাদা করে provider বসানোর দরকার নেই —
// শুধু SignInForm-কে center করা একটা page shell।

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useLang } from '@/components/providers/LanguageProvider'
import { LanguageSwitcher } from '@/components/providers/LanguageSwitcher'
import { SignInForm } from '@/components/auth/SignInForm'

export default function LoginPage() {
  const router = useRouter()
  const { user, initialized } = useAuthStore()
  const { t } = useLang()

  // ইতিমধ্যে লগইন করা থাকলে সরাসরি প্রজেক্ট সিলেক্টরে পাঠিয়ে দেওয়া —
  // app/page.tsx এর বিপরীত দিকের guard
  useEffect(() => {
    if (initialized && user) router.replace('/')
  }, [user, initialized, router])

  if (!initialized || (initialized && user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-surface flex flex-col">
      <header className="px-4 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
            <Image src="/logo.png" alt="CivilOS" width={20} height={20} className="object-contain brightness-0 invert" priority />
          </div>
          <span className="font-bold text-sm text-text-primary">{t('appName')}</span>
        </div>
        <LanguageSwitcher />
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <SignInForm />
      </div>
    </main>
  )
}
