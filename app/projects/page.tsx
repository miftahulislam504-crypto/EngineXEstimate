// app/projects/page.tsx — Project Selector
//
// আগে এটাই ছিল root route (app/page.tsx)। এখন root route-এ নতুন
// landing/summary page বসেছে (app/page.tsx দ্রষ্টব্য), তাই এই পেজ
// /projects এ সরে এসেছে। নতুন ফ্লো: landing (/) → login (/login)
// → project selector (/projects) → workspace (/project/[projectId]/dashboard)।
//
// আগে এই পেজটাই ছিল Phase 0 smoke test (login + সব ১৫টা module
// একসাথে stack করা)। পুরনো সংস্করণ app/page.tsx.phase0-backup-এ
// রাখা হয়েছে module migration-এর সময় reference-এর জন্য, পরে মুছে
// ফেলা হবে। এখন এটা লগইনের পর ব্যবহারকারীর প্রজেক্ট list — কার্ডে
// ক্লিক করলে /project/[projectId]/dashboard এ ঢোকে। Login ফর্ম
// নিজের /login route-এ; সব module নিজের /project/[projectId]/{module}
// route-এ।
//
// Hub-এর app/dashboard/projects/page.tsx-এর টেবিল/সার্চ/ফিল্টার UI
// থেকে গঠন ধার করা হয়েছে, কিন্তু write action (delete, status
// change) বাদ — Estimating প্রজেক্ট তৈরি/সম্পাদনা/মুছা করে না, সেটা
// Hub-এর দায়িত্ব (lib/firestore/project.firestore.ts-এর কমেন্টে
// বিস্তারিত কারণ)।

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Search, FolderOpen, ChevronRight, ExternalLink, AlertCircle, MapPin, Building2 } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useProjectStore } from '@/store/useProjectStore'
import { useLang } from '@/components/providers/LanguageProvider'
import { LanguageSwitcher } from '@/components/providers/LanguageSwitcher'
import { LogoWithName } from '@/components/brand/Logo'
import { Project, ProjectStatus } from '@/lib/types/project.types'
import { formatDate, getStatusBadgeClass, getStatusBarColor, getStatusLabelKey } from '@/lib/utils'

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? 'https://enginex-hub.vercel.app'

const STATUS_FILTERS: { value: ProjectStatus | ''; labelKey: 'filterAll' | 'statusActive' | 'statusOnHold' | 'statusCompleted' }[] = [
  { value: '', labelKey: 'filterAll' },
  { value: 'active', labelKey: 'statusActive' },
  { value: 'on_hold', labelKey: 'statusOnHold' },
  { value: 'completed', labelKey: 'statusCompleted' },
]

export default function ProjectSelectorPage() {
  const router = useRouter()
  const { user, initialized, signOut } = useAuthStore()
  const { projects, loading, error, fetchProjects } = useProjectStore()
  const { t, lang } = useLang()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ProjectStatus | ''>('')

  useEffect(() => {
    if (initialized && !user) router.replace('/login')
  }, [user, initialized, router])

  useEffect(() => {
    if (user) fetchProjects(user.uid)
  }, [user, fetchProjects])

  if (!initialized || (initialized && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    )
  }

  const q = search.toLowerCase().trim()
  const filtered = projects.filter((p) => {
    const matchFilter = !filter || p.status === filter
    const matchSearch =
      !q ||
      p.projectName.toLowerCase().includes(q) ||
      p.clientName.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q) ||
      p.projectCode.toLowerCase().includes(q)
    return matchFilter && matchSearch
  })

  return (
    <main className="min-h-screen bg-surface">
      {/* Topbar */}
      <header className="bg-surface-card border-b border-surface-border px-4 lg:px-8 py-4 flex items-center justify-between">
        <LogoWithName />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <button className="btn-ghost" onClick={() => signOut()}>
            {t('signOut')}
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text-primary">{t('yourProjects')}</h1>
            <p className="text-sm text-text-muted mt-0.5">
              {projects.length} {t('projectCountSuffix')}
            </p>
          </div>
          <a href={HUB_URL} target="_blank" rel="noopener noreferrer" className="btn-outline">
            <ExternalLink size={15} />
            {t('openInHub')}
          </a>
        </div>

        {/* সার্চ + ফিল্টার — প্রজেক্ট থাকলেই শুধু দেখানো, খালি হলে দরকার নেই */}
        {projects.length > 0 && (
          <div className="card p-4 mb-5">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('searchProjectsPlaceholder')}
                  className="input-field pl-9"
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                      filter === f.value
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-text-secondary border-surface-border hover:border-brand-300'
                    }`}
                  >
                    {t(f.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Content states */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Loader2 className="animate-spin text-brand-600" size={28} />
            <p className="text-sm text-text-muted">{t('loadingProjects')}</p>
          </div>
        ) : error ? (
          <div className="card py-12 text-center">
            <AlertCircle size={32} className="text-red-500 mx-auto mb-3" />
            <p className="text-sm text-text-secondary mb-4">{t('projectsLoadError')}</p>
            <button className="btn-outline" onClick={() => user && fetchProjects(user.uid)}>
              {t('retry')}
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div className="card py-16 text-center px-6">
            <FolderOpen size={40} className="text-text-muted mx-auto mb-3 opacity-30" />
            <p className="text-text-secondary font-medium text-sm mb-1">{t('noProjectsYetTitle')}</p>
            <p className="text-text-muted text-sm max-w-sm mx-auto mb-4">{t('noProjectsYetBody')}</p>
            <a href={HUB_URL} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex text-sm">
              <ExternalLink size={15} />
              {t('openInHub')}
            </a>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card py-16 text-center">
            <FolderOpen size={40} className="text-text-muted mx-auto mb-3 opacity-30" />
            <p className="text-text-secondary font-medium text-sm">{t('noProjectsFound')}</p>
          </div>
        ) : (
          // আগে এখানে একটা সরু single-column table-row লিস্ট ছিল
          // (শুধু একটা রঙিন 2px বার দিয়ে status বোঝানো হতো) — কার্ড
          // বলে মনে হতো না, দেখতেও সাদামাটা ছিল। এখন প্রকৃত grid of
          // cards: উপরে একটা status-রঙা হেডার স্ট্রাইপ, বড় প্রজেক্ট
          // নাম, client/location/date মেটা আইকনসহ, আর হোভারে lift +
          // border হাইলাইট।
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p: Project) => (
              <Link
                key={p.id}
                href={`/project/${p.id}/dashboard`}
                className="group card overflow-hidden hover:shadow-lg hover:-translate-y-0.5 hover:border-brand-200 transition-all duration-150"
              >
                <div className={`h-1.5 w-full ${getStatusBarColor(p.status)}`} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className={getStatusBadgeClass(p.status)}>{t(getStatusLabelKey(p.status))}</span>
                    <span className="text-[11px] font-mono text-text-muted bg-surface px-1.5 py-0.5 rounded-md flex-shrink-0">
                      {p.projectCode}
                    </span>
                  </div>

                  <h3 className="font-bold text-text-primary text-[15px] leading-snug mb-1 group-hover:text-brand-700 transition-colors line-clamp-2">
                    {p.projectName}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-1 truncate">
                    <Building2 size={13} className="text-text-muted flex-shrink-0" />
                    <span className="truncate">{p.clientName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-text-muted truncate">
                    <MapPin size={13} className="flex-shrink-0" />
                    <span className="truncate">{p.location}</span>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-surface-border">
                    <span className="text-[11px] text-text-muted">{formatDate(p.startDate, lang)}</span>
                    <span className="flex items-center gap-0.5 text-xs font-semibold text-brand-600 group-hover:gap-1.5 transition-all">
                      {t('navDashboard')}
                      <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
