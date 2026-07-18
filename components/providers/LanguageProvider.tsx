// components/providers/LanguageProvider.tsx
//
// Hub-এর components/providers/LanguageProvider.tsx-এর একই
// Context/Hook API shape (useLang() → { lang, t, toggleLang }),
// backward-compatible রাখা হয়েছে যদি ভবিষ্যতে Hub-এর কোনো shared
// component এখানে আনা হয়। মূল পার্থক্য: Hub-এ toggleLang() ছিল
// no-op ("kept for compatibility but does nothing") এবং lang
// hardcoded 'en' ছিল — এখানে দুটোই সত্যিকারভাবে কার্যকর।
//
// ভাষা পছন্দ localStorage-এ persist করা হয় (Firestore-এ না,
// কারণ এটা per-device UI preference, per-user account data না —
// একই একাউন্ট ভিন্ন ডিভাইসে ভিন্ন ভাষা রাখতে চাইতে পারে, যেমন
// অফিসের কম্পিউটারে ইংরেজি, ব্যক্তিগত ফোনে বাংলা)।

'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { translations, TranslationKey, Lang } from '@/lib/i18n'

export type TFn = (key: TranslationKey, vars?: Record<string, string | number>) => string

interface LangContextValue {
  lang: Lang
  t: TFn
  toggleLang: () => void
}

const LangContext = createContext<LangContextValue | null>(null)

const STORAGE_KEY = 'civilos-estimating-lang'

function translate(lang: Lang, key: TranslationKey, vars?: Record<string, string | number>): string {
  let str: string = translations[lang][key] ?? key
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, String(v))
    })
  }
  return str
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // ডিফল্ট 'bn' — কারণ এই app-এর অধিকাংশ UI মূলত বাংলাতেই লেখা
  // হয়েছিল, Hub-এর ইংরেজি-প্রথম ডিজাইনের বিপরীতে। localStorage-এ
  // 'en' সংরক্ষিত থাকলে effect চলার পরে সেটাতে সুইচ হবে — একটা
  // সংক্ষিপ্ত ডিফল্ট-ভাষা flash গ্রহণযোগ্য, কারণ পুরো app-এর
  // render আটকে রাখা (hydration-gate দিয়ে) page.tsx-এর existing
  // Firebase-Auth loading spinner-এর সাথে দ্বৈত-লোডিং সমস্যা
  // তৈরি করত।
  const [lang, setLang] = useState<Lang>('bn')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'bn') {
      setLang(saved)
    }
  }, [])

  function toggleLang() {
    const next: Lang = lang === 'bn' ? 'en' : 'bn'
    setLang(next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  const t: TFn = (key, vars) => translate(lang, key, vars)

  return <LangContext.Provider value={{ lang, t, toggleLang }}>{children}</LangContext.Provider>
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used within LanguageProvider')
  return ctx
}
