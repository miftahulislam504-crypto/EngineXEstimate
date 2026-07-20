// app/project/[projectId]/integration/page.tsx
//
// Module 15 — এই পেজে দুটো আলাদা কম্পোনেন্ট একসাথে বসানো হলো, যেটা
// Phase 0-এ আলাদা card হিসেবে stack করা ছিল:
//
// ১. HubImportPanel — manual import trigger (paste/upload JSON)।
//    এটাই এই মুহূর্তে Hub → Estimating ডেটা আসার একমাত্র পথ (bridge
//    লাইভ না হওয়া পর্যন্ত)। onImportSuccess পাওয়ার পর এই page-ই
//    saveHubImport() কল করে (HubImportPanel নিজে save করে না, শুধু
//    parse করে payload ফেরত দেয় — hub-import.firestore.ts-এর কমেন্ট
//    দ্রষ্টব্য)।
// ২. IntegrationHubPanel — connection health + event log (read-only
//    monitoring, real-time listener-ভিত্তিক)।
//
// Dashboard ও Reports page-এর empty-state থেকে এখানেই পাঠানো হয়
// ("Integration ট্যাবে গিয়ে import করুন") — তাই import trigger এই
// route-এ থাকা জরুরি, নাহলে ব্যবহারকারী empty-state থেকে কোনো
// কার্যকর পরবর্তী পদক্ষেপ পাবে না।

'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useProjectEstimatingData } from '@/lib/hooks/useProjectEstimatingData'
import { HubImportPanel } from '@/components/hub-import/HubImportPanel'
import { IntegrationHubPanel } from '@/components/integration/IntegrationHubPanel'
import { saveHubImport } from '@/lib/firestore/hub-import.firestore'
import { EstimatingRelevantPayload } from '@/lib/types/hub-import.types'
import { useLang } from '@/components/providers/LanguageProvider'

export default function IntegrationPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuthStore()
  const { imported } = useProjectEstimatingData(projectId)
  const { t } = useLang()

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  async function handleImportSuccess(payload: EstimatingRelevantPayload) {
    setSaving(true)
    setSaveError(null)
    setJustSaved(false)
    try {
      await saveHubImport(projectId, payload, user?.uid)
      setJustSaved(true)
      // listener (useHubImportListener) নিজে থেকেই নতুন active
      // import ধরে ফেলবে — এখানে ম্যানুয়াল রিফ্রেশ করার দরকার নেই।
    } catch {
      setSaveError(t('hubImportSaveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{t('hubImportTitle')}</h2>
            <p className="text-sm text-text-muted mt-1">
              {imported ? t('hubImportReimportHint') : t('hubImportFirstTimeHint')}
            </p>
          </div>
          {imported && (
            <span className="badge-active flex-shrink-0">
              <CheckCircle2 size={12} />
              {imported.projectName}
            </span>
          )}
        </div>

        {saveError && <p className="text-xs text-red-600">{saveError}</p>}
        {justSaved && !saving && <p className="text-xs text-status-activeText">{t('hubImportSaved')}</p>}
        {saving && <p className="text-xs text-text-muted">{t('savingInProgress')}</p>}

        <HubImportPanel onImportSuccess={handleImportSuccess} />
      </div>

      <IntegrationHubPanel projectId={projectId} />
    </div>
  )
}
