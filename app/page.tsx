// app/page.tsx — Landing / Summary page
//
// রুট route (/) আগে ছিল Project Selector — সেটা এখন app/projects/
// page.tsx-এ সরে গেছে। এই পেজ নতুন: লগইনের আগে পুরো অ্যাপের একটা
// সারসংক্ষেপ — কী কী module/ফাংশন আছে তা এক নজরে দেখানো, তারপর
// "Let's Start" চাপলে /login এ যাওয়া। ফ্লো: landing (/) → login
// (/login) → project selector (/projects) → workspace
// (/project/[projectId]/dashboard)।
//
// ইতিমধ্যে লগইন করা থাকলে সরাসরি /projects এ পাঠিয়ে দেওয়া হয় —
// login page-এর বিপরীত guard-এর মতোই, যাতে লগইন করা ব্যবহারকারী
// প্রতিবার landing marketing page দেখতে বাধ্য না হন।
//
// Module তালিকা lib/modules.ts (ESTIMATING_MODULES) থেকে সরাসরি
// আসে — একই icon/order/moduleNumber যা sidebar-এ ব্যবহৃত হয়, যাতে
// landing page আর workspace sidebar কখনো একে অপরের থেকে out-of-sync
// না হয়ে যায়।
//
// Signature layout element: মডিউল লিস্টটা card-grid না, বরং একটা
// BOQ লাইন-আইটেম লেজারের মতো নম্বরওয়ালা সারি — কারণ এই প্রোডাক্টের
// আসল বিষয়বস্তুই BOQ/লেজার-স্টাইল হিসাব, আর মডিউলগুলো সত্যিই
// numbered (moduleNumber ফিল্ড আগে থেকেই ডেটাতে আছে)।

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useLang } from '@/components/providers/LanguageProvider'
import { LanguageSwitcher } from '@/components/providers/LanguageSwitcher'
import { LogoWithName } from '@/components/brand/Logo'
import { ESTIMATING_MODULES } from '@/lib/modules'
import type { TranslationKey } from '@/lib/i18n'

// mod.sidebarLabelKey (যেমন 'navQuantityTakeoff') থেকে descriptionKey
// (যেমন 'landingModQuantityTakeoffDesc') বানানোর ম্যাপ — dynamic
// string concat-এর বদলে explicit map রাখা হলো যাতে TypeScript পুরো
// path-টা টাইপ-চেক করতে পারে, কোনো @ts-expect-error ছাড়াই।
const MODULE_DESC_KEY: Record<string, TranslationKey> = {
  navDashboard: 'landingModDashboardDesc',
  navQuantityTakeoff: 'landingModQuantityTakeoffDesc',
  navBoq: 'landingModBoqDesc',
  navRateAnalysis: 'landingModRateAnalysisDesc',
  navMaterials: 'landingModMaterialsDesc',
  navVendors: 'landingModVendorsDesc',
  navProcurement: 'landingModProcurementDesc',
  navReinforcement: 'landingModReinforcementDesc',
  navBudget: 'landingModBudgetDesc',
  navTender: 'landingModTenderDesc',
  navCostTracking: 'landingModCostTrackingDesc',
  navReports: 'landingModReportsDesc',
  navIntegration: 'landingModIntegrationDesc',
}

export default function LandingPage() {
  const router = useRouter()
  const { user, initialized } = useAuthStore()
  const { t } = useLang()

  // লগইন করা থাকলে landing page না দেখিয়ে সরাসরি project selector-এ
  useEffect(() => {
    if (initialized && user) router.replace('/projects')
  }, [user, initialized, router])

  if (!initialized || (initialized && user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-surface">
      {/* Topbar */}
      <header className="px-4 lg:px-8 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <LogoWithName size={30} />
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link href="/login" className="btn-ghost text-sm">
            {t('landingSecondaryCta')}
          </Link>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* গ্রাফ-পেপার / ব্লুপ্রিন্ট গ্রিড টেক্সচার — খুবই হালকা, subject-এর
            নিজস্ব world (engineering drawing sheet) থেকে নেওয়া মোটিফ */}
        <div
          className="absolute inset-0 opacity-[0.4] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(var(--surface-border) 1px, transparent 1px), linear-gradient(90deg, var(--surface-border) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 20%, black 40%, transparent 90%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 20%, black 40%, transparent 90%)',
          }}
        />

        <div className="relative max-w-4xl mx-auto px-4 lg:px-8 pt-14 pb-16 text-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 px-3 py-1 rounded-full mb-6">
            {t('landingEyebrow')}
          </span>

          <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-text-primary tracking-tight leading-[1.15] mb-4 text-balance">
            {t('landingHeroTitle')}
          </h1>

          <p className="text-base text-text-secondary max-w-xl mx-auto mb-8 leading-relaxed">
            {t('landingHeroSubtitle')}
          </p>

          <Link href="/login" className="btn-primary text-base px-6 py-3 inline-flex">
            {t('landingCta')}
            <ArrowRight size={18} />
          </Link>

          {/* সংক্ষিপ্ত stat strip — ledger-এর মতো তিনটা সংখ্যা, প্রতিটার
              নিচে একটা thin rule, ফাইন্যান্সিয়াল সামারি লাইনের ইঙ্গিত */}
          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mt-14 pt-6 border-t border-surface-border">
            <div>
              <div className="text-2xl font-bold text-text-primary font-mono">13</div>
              <div className="text-xs text-text-muted mt-0.5">{t('landingStatModules')}</div>
            </div>
            <div className="border-x border-surface-border">
              <div className="text-2xl font-bold text-text-primary font-mono">6</div>
              <div className="text-xs text-text-muted mt-0.5">{t('landingStatEcosystem')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-text-primary font-mono">1</div>
              <div className="text-xs text-text-muted mt-0.5">{t('landingStatWorkflow')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Module ledger ────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 lg:px-8 py-14">
        <div className="mb-8">
          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
            {t('landingModulesEyebrow')}
          </span>
          <h2 className="text-2xl font-bold text-text-primary tracking-tight mt-1.5 mb-2">
            {t('landingModulesTitle')}
          </h2>
          <p className="text-sm text-text-muted">{t('landingModulesSubtitle')}</p>
        </div>

        {/* BOQ-লাইন-আইটেম-স্টাইল লেজার — প্রতিটা সারিতে নম্বর, আইকন,
            module নাম আর এক লাইনের বর্ণনা। card-grid না বেছে এটা
            বেছে নেওয়ার কারণ: প্রোডাক্টের আসল ডেটা structure-ই এমন
            (moduleNumber যা lib/modules.ts-এ আগে থেকেই আছে)। */}
        <div className="card overflow-hidden">
          {ESTIMATING_MODULES.map((mod, i) => {
            const Icon = mod.icon
            const descKey = MODULE_DESC_KEY[mod.sidebarLabelKey]
            return (
              <div
                key={mod.path}
                className={`flex items-start sm:items-center gap-4 px-4 sm:px-5 py-4 ${
                  i !== ESTIMATING_MODULES.length - 1 ? 'border-b border-surface-border' : ''
                }`}
              >
                <span className="text-xs font-mono text-text-muted w-6 flex-shrink-0 pt-0.5 sm:pt-0">
                  {String(mod.moduleNumber).padStart(2, '0')}
                </span>
                <span className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 flex-shrink-0">
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
                    <h3 className="text-sm font-semibold text-text-primary flex-shrink-0">
                      {t(mod.sidebarLabelKey)}
                    </h3>
                    <p className="text-xs text-text-muted leading-relaxed sm:truncate">{t(descKey)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── CivilOS ecosystem ────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 lg:px-8 py-14">
        <div className="card p-6 sm:p-10">
          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
            {t('landingEcosystemEyebrow')}
          </span>
          <h2 className="text-2xl font-bold text-text-primary tracking-tight mt-1.5 mb-4 text-balance">
            {t('landingEcosystemTitle')}
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed max-w-2xl mb-6">
            {t('landingEcosystemBody')}
          </p>

          <div className="space-y-2.5">
            {(['landingEcosystemPoint1', 'landingEcosystemPoint2', 'landingEcosystemPoint3'] as const).map((key) => (
              <div key={key} className="flex items-center gap-2.5 text-sm text-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                {t(key)}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 lg:px-8 pb-20 text-center">
        <Link href="/login" className="btn-primary text-base px-6 py-3 inline-flex">
          {t('landingCta')}
          <ArrowRight size={18} />
        </Link>
      </section>
    </main>
  )
}
