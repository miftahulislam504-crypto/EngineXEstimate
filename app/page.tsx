// app/page.tsx — Project Selector
//
// আগে এই পেজটাই ছিল Phase 0 smoke test (login + সব ১৫টা module
// একসাথে stack করা)। পুরনো সংস্করণ app/page.tsx.phase0-backup-এ
// রাখা হয়েছে module migration-এর সময় reference-এর জন্য, পরে মুছে
// ফেলা হবে। এখন এটা root landing: লগইনের পর ব্যবহারকারীর প্রজেক্ট
// list — কার্ডে ক্লিক করলে /project/[projectId]/dashboard এ ঢোকে।
// Login ফর্ম নিজের /login route-এ সরে গেছে; সব module নিজের
// /project/[projectId]/{module} route-এ সরছে (পরের ধাপে)।
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
import Image from 'next/image'
import { Loader2, Search, FolderOpen, ChevronRight, ExternalLink, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useProjectStore } from '@/store/useProjectStore'
import { useLang } from '@/components/providers/LanguageProvider'
import { LanguageSwitcher } from '@/components/providers/LanguageSwitcher'
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
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
            <Image src="/logo.png" alt="CivilOS" width={20} height={20} className="object-contain brightness-0 invert" priority />
          </div>
          <span className="font-bold text-sm text-text-primary">{t('appName')}</span>
        </div>
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
          <div className="card overflow-hidden">
            <div className="hidden sm:grid grid-cols-[1fr_140px_100px_36px] gap-4 px-5 py-2.5 bg-surface border-b border-surface-border">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t('yourProjects')}</span>
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Client</span>
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t('filterAll')}</span>
              <span />
            </div>
            <div>
              {filtered.map((p: Project) => (
                <Link key={p.id} href={`/project/${p.id}/dashboard`} className="table-row group">
                  <div className={`w-0.5 h-10 rounded-full flex-shrink-0 ${getStatusBarColor(p.status)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-primary text-sm truncate">{p.projectName}</span>
                      <span className="text-xs font-mono text-text-muted bg-surface px-1.5 py-0.5 rounded-md hidden sm:inline">
                        {p.projectCode}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted truncate mt-0.5">
                      {p.location} · {formatDate(p.startDate, lang)}
                    </div>
                  </div>
                  <div className="hidden sm:block text-sm text-text-secondary truncate w-[140px]">{p.clientName}</div>
                  <div className="flex-shrink-0">
                    <span className={getStatusBadgeClass(p.status)}>{t(getStatusLabelKey(p.status))}</span>
                  </div>
                  <ChevronRight size={15} className="text-text-muted flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
