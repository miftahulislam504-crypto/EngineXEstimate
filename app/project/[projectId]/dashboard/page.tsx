// app/project/[projectId]/dashboard/page.tsx
//
// Module 1 — Phase 0 smoke test-এ এটা ছিল একটা card যেটা
// quantityProjectId + imported দুটোই সত্য হলে দেখা যেত (parent
// state-এর উপর নির্ভরশীল)। এখন এটাই নিজের route, projectId সরাসরি
// URL থেকে আসে — তাই "প্রজেক্ট আছে কিনা" প্রশ্নটা এখন প্রাসঙ্গিক
// না (layout.tsx-এর AuthGuard + Firestore rules এটা সামলায়), কিন্তু
// "Hub import হয়েছে কিনা" প্রশ্নটা এখনো প্রাসঙ্গিক — তাই সেই
// অবস্থার জন্য আলাদা empty-state দেখানো হচ্ছে।

'use client'

import { useParams } from 'next/navigation'
import { Loader2, UploadCloud } from 'lucide-react'
import { useProjectEstimatingData } from '@/lib/hooks/useProjectEstimatingData'
import { ProjectDashboard } from '@/components/dashboard/ProjectDashboard'
import { useLang } from '@/components/providers/LanguageProvider'

export default function DashboardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { imported, importedConnected, boqItems, boqLoading } = useProjectEstimatingData(projectId)
  const { t } = useLang()

  // Hub import শোনার listener এখনো সংযুক্ত হয়নি, বা BOQ এখনো লোড হচ্ছে
  if (!importedConnected || boqLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-brand-600" size={28} />
      </div>
    )
  }

  // এই প্রজেক্টে এখনো কোনো Hub import নেই — Dashboard-এর হিসাব
  // buildingInfo/bnbcSettings-এর উপর নির্ভরশীল না হলেও, projectName
  // এখান থেকেই আসে বলে import ছাড়া অর্থবহ dashboard দেখানো যায় না।
  if (!imported) {
    return (
      <div className="card py-16 text-center px-6 max-w-md mx-auto">
        <UploadCloud size={36} className="text-text-muted mx-auto mb-3 opacity-30" />
        <p className="text-text-secondary font-medium text-sm mb-1">{t('noHubImportYetTitle')}</p>
        <p className="text-text-muted text-sm">{t('noHubImportYetBody')}</p>
      </div>
    )
  }

  return <ProjectDashboard projectId={projectId} projectName={imported.projectName} boqItems={boqItems} />
}
