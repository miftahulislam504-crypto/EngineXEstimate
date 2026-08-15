// lib/integration/useHubNativeSync.ts
//
// hub-native-sync.ts-এর React wrapper — useHubQuantityAutoSync
// (hub-module-import.ts/useHubModuleImport.ts) এর একই প্যাটার্ন
// অনুসরণ করে: কম্পোনেন্ট মাউন্ট হওয়ার সাথে সাথেই Hub-এর
// buildingInfo/bnbcSettings/projectSettings শোনা শুরু হয়, কোনো
// ব্যবহারকারী-action ছাড়াই। unmount-এ unsubscribe হয়ে যায়।

'use client'

import { useEffect, useState } from 'react'
import { subscribeToHubNativeSync, AutoSyncStatus } from '@/lib/integration/hub-native-sync'

export interface UseHubNativeSyncResult {
  status: AutoSyncStatus | null // null = এখনো প্রথম snapshot আসেনি (initial load)
  errorDetail: string | null
}

export function useHubNativeSync(projectId: string | null): UseHubNativeSyncResult {
  const [status, setStatus] = useState<AutoSyncStatus | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) {
      setStatus(null)
      return
    }
    const unsubscribe = subscribeToHubNativeSync(projectId, {
      onStatusChange: (newStatus, detail) => {
        setStatus(newStatus)
        setErrorDetail(detail ?? null)
      },
    })
    return unsubscribe
  }, [projectId])

  return { status, errorDetail }
}
