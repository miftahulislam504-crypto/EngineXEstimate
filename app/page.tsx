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

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useLang } from '@/components/providers/LanguageProvider'
import { LanguageSwitcher } from '@/components/providers/LanguageSwitcher'
import { LogoWithName } from '@/components/brand/Logo'
import { ESTIMATING_MODULES } from '@/lib/modules'
import type { TranslationKey } from '@/lib/i18n'

// লাইভ BOQ ডেমোর জন্য একটা বাস্তবসম্মত রেট — ১০ ইঞ্চি ব্রিক ওয়ার্কের
// প্রতি বর্গমিটার রেট, EngineX Learning-এর "drag the load, live
// diagram" প্যাটার্নের এস্টিমেটিং-ভার্সন হিসেবে বসানো হলো। এখানে
// rate ফিক্সড রাখা হয়েছে, শুধু quantity বদলালে amount নিজে থেকে
// রিক্যালকুলেট হবে — যা আসল BOQ মডিউলের মূল আচরণ প্রদর্শন করছে।
const DEMO_RATE = 1850 // ৳ প্রতি বর্গমিটার

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
  const [demoQty, setDemoQty] = useState(120)

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
      {/* Topbar — লোগো+নাম মাঝখানে, language switcher ডান পাশে ছোট করে।
          "Already have an account?" লিংক সরানো হয়েছে — নিচে hero-তে
          Let's Start বাটনই একমাত্র পরিষ্কার next step, দুইটা competing
          CTA header-এ রাখার দরকার নেই। */}
      <header className="relative px-4 lg:px-8 py-4 flex items-center justify-center max-w-6xl mx-auto">
        <LogoWithName size={30} />
        <div className="absolute right-4 lg:right-8">
          <LanguageSwitcher />
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

        {/* Mobile-এ single column (টেক্সট উপরে, ডেমো নিচে — আগের মতোই)।
            lg breakpoint থেকে ২-কলাম গ্রিড: বাম দিকে headline/CTA, ডান
            দিকে লাইভ BOQ ডেমো পাশাপাশি — EngineX Learning-এর ডেস্কটপ
            হিরো লেআউটের প্যাটার্ন (টেক্সট + পাশে diagram)। */}
        <div className="relative max-w-6xl mx-auto px-4 lg:px-8 pt-14 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 lg:items-center">
          <div className="max-w-2xl mx-auto lg:mx-0 text-left">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 px-3 py-1 rounded-full mb-6">
              {t('landingEyebrow')}
            </span>

            {/* দুই-রঙা headline — EngineX Learning-এর হিরো থেকে ধার করা
                প্যাটার্ন (কালো লাইন + accent রঙে দ্বিতীয় লাইন), যাতে
                headline-টা শুধু caption না হয়ে একটা বক্তব্য হয়ে ওঠে। */}
            <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight leading-[1.15] mb-5">
              <span className="text-text-primary">{t('landingHeroTitlePart1')}</span>
              <br />
              <span className="text-brand-600">{t('landingHeroTitlePart2')}</span>
            </h1>

            <p className="text-base text-text-secondary max-w-md mb-8 leading-relaxed">
              {t('landingHeroBody')}
            </p>

            <Link href="/login" className="btn-primary text-base px-6 py-3 inline-flex">
              {t('landingCta')}
              <ArrowRight size={18} />
            </Link>
          </div>

          {/* লাইভ BOQ ডেমো — centerpiece। EngineX Learning-এর draggable
              bending-moment diagram-এর সমতুল্য: একটা static screenshot
              না, বরং প্রোডাক্টের আসল আচরণ (quantity বদলালে rate × qty
              রিক্যালকুলেট) সরাসরি দেখানো। lg-তে ডান কলামে, headline-এর
              পাশে; ছোট স্ক্রিনে টেক্সটের নিচে স্বাভাবিকভাবে স্ট্যাক হয়। */}
          <div className="relative max-w-2xl mx-auto lg:mx-0 w-full">
            <div className="card p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-text-primary">{t('landingDemoLabel')}</span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted bg-surface-hover border border-surface-border px-2 py-0.5 rounded-full">
                  BOQ
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:gap-4 items-end">
                {/* Quantity — একমাত্র editable input, slider হিসেবে */}
                <div>
                  <label className="block text-[11px] text-text-muted mb-1.5">{t('landingDemoQtyLabel')}</label>
                  <div className="flex items-baseline gap-1">
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={demoQty}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setDemoQty(Number.isFinite(v) ? Math.max(1, Math.min(999, v)) : 1)
                      }}
                      className="w-full min-w-0 bg-transparent text-xl sm:text-2xl font-bold font-mono text-text-primary outline-none border-b-2 border-brand-200 focus:border-brand-500 pb-1 transition-colors"
                    />
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={400}
                    value={demoQty}
                    onChange={(e) => setDemoQty(Number(e.target.value))}
                    className="w-full mt-2 accent-brand-600"
                  />
                  <span className="text-[10px] text-text-muted">{t('landingDemoUnit')}</span>
                </div>

                {/* Rate — ফিক্সড, শুধু দেখানোর জন্য */}
                <div>
                  <label className="block text-[11px] text-text-muted mb-1.5">{t('landingDemoRateLabel')}</label>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-text-secondary pb-1 border-b-2 border-transparent">
                    ৳{DEMO_RATE.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* Amount — স্বয়ংক্রিয়ভাবে রিক্যালকুলেটেড, brand রঙে হাইলাইট */}
                <div>
                  <label className="block text-[11px] text-text-muted mb-1.5">{t('landingDemoAmountLabel')}</label>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-brand-600 pb-1 border-b-2 border-transparent tabular-nums">
                    ৳{(demoQty * DEMO_RATE).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-text-muted mt-3 font-mono">{t('landingDemoCaption')}</p>
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
