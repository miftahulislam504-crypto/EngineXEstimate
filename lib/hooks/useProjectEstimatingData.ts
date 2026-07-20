// lib/hooks/useProjectEstimatingData.ts
//
// আগে (Phase 0 smoke test, app/page.tsx.phase0-backup দ্রষ্টব্য) এই
// তিনটা ডেটা (Hub import → quantity takeoff → BOQ) parent
// component-এর state-এ রাখা হতো আর props হয়ে সব module-এ
// drilling হতো। route-based structure-এ প্রতিটা module এখন আলাদা
// page — তাই prop-drilling সম্ভব না, প্রতিটা page নিজে এই hook
// কল করে projectId দিয়ে সরাসরি Firestore থেকে টেনে আনে।
//
// activeImport-এর জন্য ইচ্ছাকৃতভাবে real-time listener
// (useHubImportListener) ব্যবহার করা হয়েছে one-time fetch না —
// Hub-এ কেউ BNBC/building data সংশোধন করলে এখানে যেকোনো খোলা
// module page সাথে সাথে reflect করবে। quantityTakeoff আর boqItems-এর
// জন্য এখনো listener নেই (শুধু one-time fetch + manual refresh) —
// ভবিষ্যতে দরকার হলে useHubImportListener-এর প্যাটার্নে
// listenToActiveQuantityTakeoff/listenToActiveBOQVersion যোগ করা
// যাবে, কিন্তু এখন সেটা over-engineering হবে কারণ এই দুটো এই app
// নিজেই লেখে (Hub থেকে বদলায় না রিয়েল-টাইমে)।

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useHubImportListener } from '@/lib/integration/useHubImportListener'
import { getActiveQuantityTakeoff } from '@/lib/firestore/quantity-takeoff.firestore'
import { getActiveBOQVersion } from '@/lib/firestore/boq.firestore'
import { StoredQuantityTakeoff } from '@/lib/types/quantity-takeoff.types'
import { BOQItem } from '@/lib/types/boq.types'

export interface ProjectEstimatingData {
  // Hub থেকে building/BNBC তথ্য — projectName/projectCode-সহ (রিয়েল-টাইম)
  imported: ReturnType<typeof useHubImportListener>['data']
  importedConnected: boolean
  importedError: Error | null

  // Module 2 — Quantity Takeoff (one-time fetch, refreshQuantity() দিয়ে রিফ্রেশ)
  quantityData: StoredQuantityTakeoff | null
  quantityImportId: string | null
  quantityLoading: boolean
  refreshQuantity: () => Promise<void>

  // Module 3 — সক্রিয় BOQ (one-time fetch, refreshBoq() দিয়ে রিফ্রেশ)
  boqItems: BOQItem[]
  boqLoading: boolean
  refreshBoq: () => Promise<void>
}

export function useProjectEstimatingData(projectId: string): ProjectEstimatingData {
  const { data: imported, connected: importedConnected, error: importedError } = useHubImportListener(projectId)

  const [quantityData, setQuantityData] = useState<StoredQuantityTakeoff | null>(null)
  const [quantityImportId, setQuantityImportId] = useState<string | null>(null)
  const [quantityLoading, setQuantityLoading] = useState(true)

  const [boqItems, setBoqItems] = useState<BOQItem[]>([])
  const [boqLoading, setBoqLoading] = useState(true)

  const refreshQuantity = useCallback(async () => {
    setQuantityLoading(true)
    try {
      const active = await getActiveQuantityTakeoff(projectId)
      setQuantityData(active)
      setQuantityImportId(active?.importId ?? null)
    } finally {
      setQuantityLoading(false)
    }
  }, [projectId])

  const refreshBoq = useCallback(async () => {
    setBoqLoading(true)
    try {
      const version = await getActiveBOQVersion(projectId)
      setBoqItems(version?.items ?? [])
    } finally {
      setBoqLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    refreshQuantity()
    refreshBoq()
  }, [refreshQuantity, refreshBoq])

  return {
    imported,
    importedConnected,
    importedError,
    quantityData,
    quantityImportId,
    quantityLoading,
    refreshQuantity,
    boqItems,
    boqLoading,
    refreshBoq,
  }
}
