// app/project/[projectId]/reports/page.tsx
//
// Module 13 — projectName/projectCode Hub import থেকে আসে (Dashboard
// page-এর একই pattern)। Hub import না থাকলে report generate অর্থহীন
// (projectName ছাড়া PDF header বানানো যাবে না), তাই একই empty-state
// gate ব্যবহার করা হলো।
//
// নোট (আগের কথোপকথনের ইস্যু): এই পেজ এখনো local PDF download করে
// (ReportsPanel-এর ভেতরে jsPDF দিয়ে সরাসরি browser download) — Hub-এ
// কেন্দ্রীয় export সরানো এখনো বাকি কাজ, এই migration-এর scope-এর
// বাইরে। সেই পরিবর্তন এলে এই page.tsx সম্ভবত অপরিবর্তিতই থাকবে
// (ReportsPanel-এর ভেতরের implementation বদলাবে, prop signature
// একই থাকবে) — শুধু উল্লেখ রাখা হলো যেন ভুলে না যাই।

'use client'

import { useParams } from 'next/navigation'
import { Loader2, Clock } from 'lucide-react'
import { useProjectEstimatingData } from '@/lib/hooks/useProjectEstimatingData'
import { useProjectStore } from '@/store/useProjectStore'
import { ReportsPanel } from '@/components/reports/ReportsPanel'
import { useLang } from '@/components/providers/LanguageProvider'

export default function ReportsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { imported, importedConnected } = useProjectEstimatingData(projectId)
  // clientName/location Hub import payload-এ নেই (হাব শুধু
  // building/BNBC তথ্য পাঠায়) — এই দুটো Project রেকর্ডের নিজস্ব
  // ফিল্ড, layout.tsx-এ ইতিমধ্যে fetchActiveProject() দিয়ে লোড করা
  // থাকে, তাই এখানে আলাদা fetch না করে একই store থেকে পড়া হচ্ছে।
  const { activeProject } = useProjectStore()
  const { t } = useLang()

  if (!importedConnected) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-brand-600" size={28} />
      </div>
    )
  }

  if (!imported) {
    return (
      <div className="card py-16 text-center px-6 max-w-md mx-auto">
        <Clock size={36} className="text-text-muted mx-auto mb-3 opacity-30" />
        <p className="text-text-secondary font-medium text-sm mb-1">{t('noHubImportYetTitle')}</p>
        <p className="text-text-muted text-sm">{t('noHubImportYetBody')}</p>
      </div>
    )
  }

  return (
    <ReportsPanel
      projectId={projectId}
      projectName={imported.projectName}
      projectCode={imported.projectCode}
      clientName={activeProject?.clientName || undefined}
      location={activeProject?.location || undefined}
    />
  )
}
