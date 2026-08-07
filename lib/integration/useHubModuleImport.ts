// lib/integration/useHubModuleImport.ts
//
// prepareHubImport()-এর React wrapper। useHubImportListener.ts-এর
// state-shape কনভেনশন অনুসরণ করা হয়েছে, কিন্তু এটা listener না —
// একটা one-shot async action (বাটনে ক্লিকে চলবে), তাই
// connected/onSnapshot-এর বদলে loading/run pattern।
//
// এই hook শুধু fetch+map+validate পর্যন্ত করে (prepareHubImport-এর
// contract অনুযায়ী) — save/dependency-link caller-এর (panel/page)
// দায়িত্ব, ঠিক QuantityImportPanel-এর manual JSON path-এর মতোই
// (parseQuantityTakeoffExport সফল হলে onImportSuccess(payload) কল হয়,
// panel নিজে save করে না)।

'use client'

import { useState, useCallback } from 'react'
import { prepareHubImport, HubModuleImportPrepareResult } from '@/lib/integration/hub-module-import'

export interface UseHubModuleImportResult {
  result: HubModuleImportPrepareResult | null
  loading: boolean
  run: (projectId: string) => Promise<HubModuleImportPrepareResult>
}

export function useHubModuleImport(): UseHubModuleImportResult {
  const [result, setResult] = useState<HubModuleImportPrepareResult | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async (projectId: string) => {
    setLoading(true)
    try {
      const r = await prepareHubImport(projectId)
      setResult(r)
      return r
    } catch (e) {
      const failed: HubModuleImportPrepareResult = {
        success: false,
        architecturalAvailable: false,
        structuralAvailable: false,
        errors: [e instanceof Error ? e.message : 'অজানা ত্রুটি — Hub থেকে import ব্যর্থ হয়েছে।'],
        warnings: [],
      }
      setResult(failed)
      return failed
    } finally {
      setLoading(false)
    }
  }, [])

  return { result, loading, run }
}
