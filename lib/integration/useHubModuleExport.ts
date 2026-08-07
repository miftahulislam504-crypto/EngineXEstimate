// lib/integration/useHubModuleExport.ts
//
// subscribeToHubExportAutoSync() (hub-module-export.ts)-এর React
// wrapper। useHubModuleImport.ts-এর useHubQuantityAutoSync()-এর একই
// mount/unsubscribe pattern, কিন্তু ভিন্ন mount পয়েন্টে বসবে —
// app/project/[projectId]/layout.tsx-এ (নির্দিষ্ট কোনো module page-এ
// না), কারণ Estimate-এর যেকোনো module (BOQ/Budget/Procurement/Rate
// Analysis/Vendor) বদলালে push হওয়া উচিত, ব্যবহারকারী যে page-ই
// দেখুন না কেন।

'use client'

import { useEffect, useState } from 'react'
import { subscribeToHubExportAutoSync, ExportAutoSyncStatus } from '@/lib/services/hub-module-export'

export function useHubModuleExportAutoSync(projectId: string): ExportAutoSyncStatus {
  const [status, setStatus] = useState<ExportAutoSyncStatus>({ state: 'idle' })

  useEffect(() => {
    const unsubscribe = subscribeToHubExportAutoSync(projectId, setStatus)
    return unsubscribe
  }, [projectId])

  return status
}
