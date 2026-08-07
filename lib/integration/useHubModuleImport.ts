// lib/integration/useHubModuleImport.ts
//
// আগে এটা useHubModuleImport() ছিল — বাটনে ক্লিকে চলা one-shot action
// (loading/run pattern)। এখন ecosystem পুরোপুরি automatic হওয়ার
// সিদ্ধান্ত অনুযায়ী, এই hook subscribeToHubQuantityAutoSync()
// (hub-module-import.ts) মাউন্ট করে রাখে — কম্পোনেন্ট মাউন্ট হওয়ার
// সাথে সাথেই Architectural+Structural moduleData শোনা শুরু হয়, কোনো
// ব্যবহারকারী-action ছাড়াই। unmount-এ unsubscribe হয়ে যায়।

'use client'

import { useEffect, useState } from 'react'
import { subscribeToHubQuantityAutoSync, AutoSyncStatus } from '@/lib/integration/hub-module-import'

export interface UseHubAutoSyncResult {
  status: AutoSyncStatus | null // null = এখনো প্রথম snapshot আসেনি (initial load)
}

export function useHubQuantityAutoSync(projectId: string): UseHubAutoSyncResult {
  const [status, setStatus] = useState<AutoSyncStatus | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeToHubQuantityAutoSync(projectId, setStatus)
    return unsubscribe
  }, [projectId])

  return { status }
}
