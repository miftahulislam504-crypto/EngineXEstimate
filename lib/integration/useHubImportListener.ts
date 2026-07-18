// lib/integration/useHubImportListener.ts
//
// Module 15 — hub-import-listener.ts-এর React wrapper। CostTrackingPanel-এর
// useEffect+cleanup প্যাটার্ন অনুসরণ করা হয়েছে, কিন্তু এখানে polling/
// one-time fetch না, সত্যিকারের Firestore listener — তাই returned
// unsubscribe অবশ্যই cleanup-এ কল করতে হবে।

'use client'

import { useState, useEffect } from 'react'
import { StoredHubImport } from '@/lib/firestore/hub-import.firestore'
import { listenToActiveHubImport } from '@/lib/integration/hub-import-listener'

export interface UseHubImportListenerResult {
  data: StoredHubImport | null
  error: Error | null
  connected: boolean // listener সক্রিয় কিনা (ডেটা এখনো না-থাকা সত্ত্বেও true হতে পারে — শুধু "শুনছি" বোঝায়)
}

export function useHubImportListener(projectId: string | null): UseHubImportListenerResult {
  const [data, setData] = useState<StoredHubImport | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!projectId) {
      setConnected(false)
      return
    }

    setConnected(true)
    setError(null)

    const unsubscribe = listenToActiveHubImport(projectId, {
      onUpdate: (imported) => {
        setData(imported)
        setError(null)
      },
      onError: (err) => {
        setError(err)
      },
    })

    return () => {
      unsubscribe()
      setConnected(false)
    }
  }, [projectId])

  return { data, error, connected }
}
