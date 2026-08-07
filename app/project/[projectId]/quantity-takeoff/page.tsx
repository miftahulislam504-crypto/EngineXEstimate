// app/project/[projectId]/quantity-takeoff/page.tsx
//
// Module 2 — useProjectEstimatingData hook quantityData/quantityImportId
// পরিচালনা করে (refreshQuantity() দিয়ে refetch)।
//
// ⚠️ useHubQuantityAutoSync() এখানে, page-level-এ মাউন্ট করা —
// QuantityImportPanel-এর ভেতরে না, কারণ সেই panel শুধু তখনই দেখানো হয়
// যখন quantityData নেই (নিচের forceImportView লজিক দেখুন)। কিন্তু
// auto-sync চালু থাকা উচিত সবসময়, এমনকি breakdown view দেখানোর সময়ও
// — কারণ ব্যবহারকারী "সম্পূর্ণ automatic" চেয়েছেন: Architectural/
// Structural upstream-এ নতুন version এলে, ব্যবহারকারী যে view-ই
// দেখুক না কেন, quantities নিজে থেকে আপডেট হওয়া উচিত। panel unmount
// হয়ে গেলে যদি listener-ও বন্ধ হয়ে যেত, upstream পরিবর্তন miss হয়ে
// যেত যতক্ষণ না ব্যবহারকারী আবার import view-এ ফিরত।
//
// synced status এলে refreshQuantity() কল করা হয় (useEffect) — কারণ
// subscribeToHubQuantityAutoSync() নিজেই saveQuantityTakeoff() কল করে
// Firestore-এ লিখে দেয়, কিন্তু এই page-এর quantityData state
// (useProjectEstimatingData থেকে আসা) সেটা নিজে থেকে জানে না যতক্ষণ
// না refetch করা হয়।

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useProjectEstimatingData } from '@/lib/hooks/useProjectEstimatingData'
import { QuantityImportPanel } from '@/components/quantity-takeoff/QuantityImportPanel'
import { QuantityBreakdown } from '@/components/quantity-takeoff/QuantityBreakdown'
import { saveQuantityTakeoff } from '@/lib/firestore/quantity-takeoff.firestore'
import { useHubQuantityAutoSync } from '@/lib/integration/useHubModuleImport'
import { QuantityTakeoffExport } from '@/lib/types/quantity-takeoff.types'
import { useLang } from '@/components/providers/LanguageProvider'

export default function QuantityTakeoffPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { quantityData, quantityImportId, quantityLoading, refreshQuantity } = useProjectEstimatingData(projectId)
  const { t } = useLang()
  const { status: autoSyncStatus } = useHubQuantityAutoSync(projectId)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [forceImportView, setForceImportView] = useState(false)

  // auto-sync নিজেই Firestore-এ save করে ফেলে (subscribeToHubQuantityAutoSync-এর
  // ভেতরে) — এই page-কে শুধু জানতে হবে সেটা হয়েছে, যাতে quantityData
  // state refetch করে নতুন ডেটা দেখাতে পারে
  useEffect(() => {
    if (autoSyncStatus?.state === 'synced' && autoSyncStatus.savedImportId) {
      refreshQuantity()
      setForceImportView(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSyncStatus?.state === 'synced' ? autoSyncStatus.savedImportId : null])

  async function handleImportSuccess(payload: QuantityTakeoffExport) {
    // manual JSON/paste path — auto-sync-এর dependency-link এখানে হয়
    // না (sourceVersions raw JSON থেকে Hub-verified না), শুধু save +
    // refresh
    setSaving(true)
    setSaveError(null)
    try {
      await saveQuantityTakeoff(payload)
      await refreshQuantity()
      setForceImportView(false)
    } catch {
      setSaveError(t('quantityTakeoffSaveError'))
    } finally {
      setSaving(false)
    }
  }

  if (quantityLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-brand-600" size={28} />
      </div>
    )
  }

  return (
    <div className="card p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{t('quantityTakeoffTitle')}</h2>
        <p className="text-sm text-text-muted mt-1">{t('quantityTakeoffDescription')}</p>
      </div>

      {saveError && <p className="text-xs text-red-600">{saveError}</p>}

      {!quantityData || forceImportView ? (
        <QuantityImportPanel onImportSuccess={handleImportSuccess} autoSyncStatus={autoSyncStatus} />
      ) : (
        <div className="space-y-4">
          {saving && <p className="text-xs text-text-muted">{t('savingInProgress')}</p>}
          {autoSyncStatus?.state === 'synced' && (
            <p className="text-xs text-text-muted">
              {t('hubAutoSyncedLabel')} — Architectural {t('hubAutoFetchVersionLabel')} {autoSyncStatus.result.architecturalVersion} · Structural{' '}
              {t('hubAutoFetchVersionLabel')} {autoSyncStatus.result.structuralVersion}
            </p>
          )}
          <QuantityBreakdown
            projectId={projectId}
            importId={quantityImportId!}
            data={quantityData}
            onDataChanged={refreshQuantity}
          />
          <button className="btn-outline" onClick={() => setForceImportView(true)}>
            {t('importNewQuantityTakeoff')}
          </button>
        </div>
      )}
    </div>
  )
}
