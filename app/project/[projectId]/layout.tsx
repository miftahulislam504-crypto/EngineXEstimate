// app/project/[projectId]/layout.tsx
//
// Project workspace shell — Hub-এর app/dashboard/layout.tsx-এর
// sidebar প্যাটার্ন অনুসরণ করে (একই token নাম: surface-card,
// nav-item/nav-item-active, brand-600), কিন্তু নেভিগেশন content
// আলাদা: Hub-এর sidebar-এ "Dashboard/Projects/Activity" + অন্য
// CivilOS app-গুলোর লিংক থাকে, এখানে lib/modules.ts থেকে
// Estimating-এর ১৫টা module-এর route থাকে।
//
// আগে app/page.tsx-এ সব module state (imported, quantityData,
// boqItems...) parent component-এ রেখে prop-drilling করা হতো।
// এখন প্রতিটা module নিজের route/page.tsx — তারা useParams() দিয়ে
// projectId নিয়ে নিজেই dependent data fetch করবে (Module 2→3→4
// chain সহ, যেটা পরের ধাপে migrate হবে)। এই layout শুধু projectId
// resolve করে Project record load করে টপবারে দেখানোর দায়িত্বে।

'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname, useParams } from 'next/navigation'
import Link from 'next/link'
import { Menu, X, LogOut, ChevronLeft, Loader2, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useProjectStore } from '@/store/useProjectStore'
import { useLang } from '@/components/providers/LanguageProvider'
import { LanguageSwitcher } from '@/components/providers/LanguageSwitcher'
import { LogoMark } from '@/components/brand/Logo'
import { ESTIMATING_MODULES } from '@/lib/modules'
import { getStatusBadgeClass, getStatusLabelKey } from '@/lib/utils'
import { useHubModuleExportAutoSync } from '@/lib/integration/useHubModuleExport'

export default function ProjectWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams<{ projectId: string }>()
  const projectId = params.projectId

  const { user, estimatingRole, initialized, signOut } = useAuthStore()
  const { activeProject, activeProjectLoading, fetchActiveProject, clearActiveProject } = useProjectStore()
  const { t } = useLang()

  // এই layout সব module page জুড়ে persist করে (Next.js layout
  // nesting), তাই এখানে mount করা মানে ব্যবহারকারী BOQ/Budget/
  // Procurement যেখানেই থাকুন, Hub-এ auto-push সবসময় সক্রিয় থাকে —
  // কোনো একটা নির্দিষ্ট module page-এ বসালে সেই page ছাড়লেই sync বন্ধ
  // হয়ে যেত।
  const exportSyncStatus = useHubModuleExportAutoSync(projectId)

  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Auth guard — Hub-এর dashboard/layout.tsx-এর একই pattern
  useEffect(() => {
    if (initialized && !user) router.replace('/login')
  }, [user, initialized, router])

  useEffect(() => {
    if (projectId) fetchActiveProject(projectId)
    return () => clearActiveProject()
  }, [projectId, fetchActiveProject, clearActiveProject])

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    )
  }

  if (!user) return null

  const initials = (user.displayName ?? user.email ?? 'U')[0].toUpperCase()

  return (
    <div className="min-h-screen bg-surface flex">
      {/* মোবাইল overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-60 bg-surface-card border-r border-surface-border z-30
          flex flex-col
          transform transition-transform duration-300
          lg:translate-x-0 lg:static lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* লোগো + প্রজেক্ট বদলানোর লিংক */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-surface-border">
          <Link href="/projects" className="flex-shrink-0">
            <LogoMark size={32} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-text-primary leading-tight truncate">
              {activeProject?.projectName ?? t('appName')}
            </div>
            <div className="text-xs text-text-muted truncate">
              {activeProject?.projectCode ?? t('appName')}
            </div>
          </div>
          <button className="lg:hidden text-text-muted hover:text-text-primary p-1" onClick={() => setSidebarOpen(false)}>
            <X size={16} />
          </button>
        </div>

        {/* প্রজেক্ট বদলান */}
        <Link
          href="/projects"
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-text-muted
                     hover:text-text-primary hover:bg-surface-hover transition-colors border-b border-surface-border"
        >
          <ChevronLeft size={13} />
          {t('switchProject')}
        </Link>

        {/* Module নেভিগেশন */}
        <nav className="flex-1 overflow-y-auto px-3 pt-3 pb-2 space-y-0.5">
          {ESTIMATING_MODULES.map((mod) => {
            const href = `/project/${projectId}/${mod.path}`
            const active = pathname === href
            const Icon = mod.icon
            return (
              <Link
                key={mod.path}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={active ? 'nav-item-active' : 'nav-item'}
              >
                <Icon size={16} />
                <span>{t(mod.sidebarLabelKey)}</span>
                {active && <ChevronRight size={14} className="ml-auto text-brand-500" />}
              </Link>
            )
          })}
        </nav>

        {/* Hub auto-push status — নিরব ইঙ্গিত, কোনো action নেই */}
        <div className="px-4 pb-1.5">
          <p className="text-[11px] text-text-muted flex items-center gap-1.5">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                exportSyncStatus.state === 'pushing'
                  ? 'bg-amber-500 animate-pulse'
                  : exportSyncStatus.state === 'error'
                    ? 'bg-red-500'
                    : exportSyncStatus.state === 'pushed'
                      ? 'bg-emerald-500'
                      : 'bg-surface-border'
              }`}
            />
            {exportSyncStatus.state === 'pushing' && t('hubExportSyncPushing')}
            {exportSyncStatus.state === 'pending' && t('hubExportSyncPending')}
            {exportSyncStatus.state === 'pushed' && `${t('hubExportSyncPushed')} · v${exportSyncStatus.version}`}
            {exportSyncStatus.state === 'error' && t('hubExportSyncError')}
            {exportSyncStatus.state === 'idle' && t('hubExportSyncIdle')}
          </p>
        </div>

        {/* ব্যবহারকারী + সাইন আউট */}
        <div className="px-3 pb-3 pt-2 border-t border-surface-border flex-shrink-0 space-y-1">
          <div className="flex items-center justify-between px-1">
            <LanguageSwitcher />
          </div>
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-text-primary truncate">{user.displayName ?? user.email}</div>
              <div className="text-xs text-text-muted truncate">{estimatingRole ?? t('unknownRole')}</div>
            </div>
          </div>
          <button onClick={() => signOut()} className="nav-item w-full text-red-500 hover:text-red-600 hover:bg-red-50">
            <LogOut size={15} />
            <span>{t('signOut')}</span>
          </button>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="bg-surface-card border-b border-surface-border px-4 lg:px-6 py-3 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-text-secondary">
            <Menu size={20} />
          </button>

          {activeProjectLoading ? (
            <div className="h-5 w-40 bg-surface-hover rounded-md animate-pulse" />
          ) : activeProject ? (
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm font-semibold text-text-primary truncate">{activeProject.projectName}</h1>
              <span className="text-xs font-mono text-text-muted bg-surface px-1.5 py-0.5 rounded-md hidden sm:inline">
                {activeProject.projectCode}
              </span>
              <span className={getStatusBadgeClass(activeProject.status)}>{t(getStatusLabelKey(activeProject.status))}</span>
            </div>
          ) : (
            <p className="text-sm text-text-muted">{t('projectNotFound')}</p>
          )}
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
