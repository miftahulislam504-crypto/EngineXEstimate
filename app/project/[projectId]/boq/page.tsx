// app/project/[projectId]/boq/page.tsx
//
// Module 3 — quantityData/quantityImportId hook থেকে আসে (Module 2
// শেষ না হলে BOQGenerator নিজেই handleGenerate-এ quantityTakeoff-এর
// null চেক করে, তাই এখানে আলাদা gate না রেখে সরাসরি কম্পোনেন্টকে
// দায়িত্ব দেওয়া হলো — Phase 0-এর আচরণের সাথে সামঞ্জস্যপূর্ণ)।

'use client'

import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useProjectEstimatingData } from '@/lib/hooks/useProjectEstimatingData'
import { BOQGenerator } from '@/components/boq/BOQGenerator'

export default function BOQPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { quantityData, quantityImportId, quantityLoading, boqItems, boqLoading, refreshBoq } =
    useProjectEstimatingData(projectId)

  if (quantityLoading || boqLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-brand-600" size={28} />
      </div>
    )
  }

  return (
    <BOQGenerator
      projectId={projectId}
      quantityTakeoff={quantityData}
      quantityImportId={quantityImportId}
      boqItems={boqItems}
      onBOQChanged={() => refreshBoq()}
    />
  )
}
