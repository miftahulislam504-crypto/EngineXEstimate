// app/project/[projectId]/quantity-takeoff/page.tsx
//
// Module 2 — আগে parent state (quantityData/quantityImportId) দিয়ে
// চালানো হতো, এখন useProjectEstimatingData hook এই দায়িত্ব নিয়েছে
// (refreshQuantity() দিয়ে refetch)। import success হ্যান্ডলার আগের
// মতোই saveQuantityTakeoff কল করে, তারপর hook refresh করে।

'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useProjectEstimatingData } from '@/lib/hooks/useProjectEstimatingData'
import { QuantityImportPanel } from '@/components/quantity-takeoff/QuantityImportPanel'
import { QuantityBreakdown } from '@/components/quantity-takeoff/QuantityBreakdown'
import { saveQuantityTakeoff } from '@/lib/firestore/quantity-takeoff.firestore'
import { QuantityTakeoffExport } from '@/lib/types/quantity-takeoff.types'
import { useLang } from '@/components/providers/LanguageProvider'

export default function QuantityTakeoffPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { quantityData, quantityImportId, quantityLoading, refreshQuantity } = useProjectEstimatingData(projectId)
  const { t } = useLang()

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [forceImportView, setForceImportView] = useState(false)

  async function handleImportSuccess(payload: QuantityTakeoffExport) {
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
        <QuantityImportPanel onImportSuccess={handleImportSuccess} />
      ) : (
        <div className="space-y-4">
          {saving && <p className="text-xs text-text-muted">{t('savingInProgress')}</p>}
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
