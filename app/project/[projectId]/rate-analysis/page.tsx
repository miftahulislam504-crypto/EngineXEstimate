// app/project/[projectId]/rate-analysis/page.tsx
//
// Module 4 — boqItems হুক থেকে fresh fetch করা, BOQ page-এর সাথে
// prop-drilling সংযোগ নেই (route আলাদা হওয়ায় সম্ভবও না)। BOQ
// generate করা না থাকলে boqItems খালি array থাকবে —
// RateAnalysisPanel নিজেই সেই খালি অবস্থার UI সামলায় (Phase 0-এ
// একই আচরণ ছিল, যেহেতু boqItems তখনও শুরুতে []).
//
// Resource Rates (labour/equipment rate — ResourceRateManager)
// লিস্ট-এ আলাদা sidebar slot নেই: এটা organization-wide ডেটা
// (projectId লাগে না) কিন্তু conceptually Rate Analysis-এরই ইনপুট।
// Phase 0-এ এটা আলাদা card হিসেবে page-এ বসানো ছিল; এখানে সেটাকে
// একটা tab হিসেবে রাখা হলো যাতে sidebar-এ অতিরিক্ত item না বাড়ে।

'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useProjectEstimatingData } from '@/lib/hooks/useProjectEstimatingData'
import { RateAnalysisPanel } from '@/components/rate-analysis/RateAnalysisPanel'
import { ResourceRateManager } from '@/components/resource-rates/ResourceRateManager'
import { useLang } from '@/components/providers/LanguageProvider'

type Tab = 'analysis' | 'resourceRates'

export default function RateAnalysisPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { boqItems, boqLoading } = useProjectEstimatingData(projectId)
  const { t } = useLang()
  const [tab, setTab] = useState<Tab>('analysis')

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 border-b border-surface-border">
        <button
          onClick={() => setTab('analysis')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            tab === 'analysis' ? 'border-brand-600 text-brand-700' : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          {t('navRateAnalysis')}
        </button>
        <button
          onClick={() => setTab('resourceRates')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            tab === 'resourceRates' ? 'border-brand-600 text-brand-700' : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          {t('resourceRatesTab')}
        </button>
      </div>

      {tab === 'analysis' ? (
        boqLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-brand-600" size={28} />
          </div>
        ) : (
          <RateAnalysisPanel projectId={projectId} boqItems={boqItems} />
        )
      ) : (
        <ResourceRateManager />
      )}
    </div>
  )
}
