// app/project/[projectId]/procurement/page.tsx
//
// Module 8 — BOQ + Rate Analysis + BBS-এর উপর নির্ভরশীল (Phase 0
// কমেন্ট অনুযায়ী), কিন্তু কম্পোনেন্ট নিজে শুধু projectId+boqItems
// prop নেয় — বাকি নির্ভরতা (Rate Analysis, BBS) ProcurementPanel-এর
// ভেতরেই নিজের projectId দিয়ে fetch হয় বলে ধরে নেওয়া হচ্ছে (props
// signature অনুযায়ী)।

'use client'

import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useProjectEstimatingData } from '@/lib/hooks/useProjectEstimatingData'
import { ProcurementPanel } from '@/components/procurement/ProcurementPanel'

export default function ProcurementPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { boqItems, boqLoading } = useProjectEstimatingData(projectId)

  if (boqLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-brand-600" size={28} />
      </div>
    )
  }

  return <ProcurementPanel projectId={projectId} boqItems={boqItems} />
}
