// components/providers/LanguageSwitcher.tsx
'use client'

import { Languages } from 'lucide-react'
import { useLang } from '@/components/providers/LanguageProvider'

/**
 * ছোট toggle বাটন — header-এ বসানোর জন্য। বর্তমান ভাষা যা আছে
 * তার বিপরীত ভাষার নাম বাটনে দেখায় (যেমন বাংলায় থাকলে বাটনে
 * "English" লেখা থাকবে, কারণ এটাই সুইচ করলে যা হবে)।
 */
export function LanguageSwitcher() {
  const { lang, toggleLang, t } = useLang()

  return (
    <button
      onClick={toggleLang}
      className="btn-ghost text-xs"
      title={t('language')}
    >
      <Languages size={14} />
      {lang === 'bn' ? t('switchToEnglish') : t('switchToBengali')}
    </button>
  )
}
