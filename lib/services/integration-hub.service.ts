// lib/services/integration-hub.service.ts
//
// Module 15 — "sync failure handling/monitoring" sub-task-এর বাকি
// অংশ: hard error (listener ব্যর্থ) ছাড়াও "stale data" ধরার লজিক —
// যেমন কোনো connection 'live'/'listening' status-এ আছে কিন্তু বহুদিন
// কোনো sync attempt লগ হয়নি, এটা silent failure-এর একটা লক্ষণ হতে
// পারে (যেমন listener ক্র্যাশ করেছে কিন্তু error event fire করেনি)।

import { ConnectionPoint } from '@/lib/types/integration-hub.types'
import { SyncLogEntry } from '@/lib/types/integration-hub.types'

// এই সময়ের বেশি কোনো 'live'/'listening' connection-এ sync attempt না
// হলে stale ধরা হয়। নির্বিচারে বড় সংখ্যা (৭ দিন) বেছে নেওয়া হয়েছে
// কারণ Estimating app-এর ডেটা (BOQ, rate) ঘন ঘন বদলায় না — একজন
// ব্যবহারকারী সপ্তাহে একবারও লগ-ইন না করলেও সেটা "ব্যর্থতা" বোঝায় না,
// শুধু নিষ্ক্রিয়তা।
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000

export interface ConnectionHealth {
  connection: ConnectionPoint
  lastSync: SyncLogEntry | null
  isStale: boolean
  lastFailure: SyncLogEntry | null
}

/**
 * প্রতিটা registry connection-এর জন্য সাম্প্রতিক sync log entries
 * থেকে একটা health summary বানায় — ReportsPanel-এর
 * checkReportsAvailability()-র মতোই, UI-কে raw log না দেখিয়ে একটা
 * প্রস্তুত-ব্যবহারযোগ্য সারাংশ দেওয়া হয়।
 */
export function summarizeConnectionHealth(
  connections: ConnectionPoint[],
  logEntries: SyncLogEntry[]
): ConnectionHealth[] {
  const now = Date.now()

  return connections.map((connection) => {
    const relevant = logEntries
      .filter((e) => e.connectionId === connection.id)
      .sort((a, b) => b.occurredAt - a.occurredAt)

    const lastSync = relevant.length > 0 ? relevant[0] : null
    const lastFailure = relevant.find((e) => e.status === 'failure') ?? null

    const isStale =
      (connection.status === 'live' || connection.status === 'listening') &&
      (!lastSync || now - lastSync.occurredAt > STALE_THRESHOLD_MS)

    return { connection, lastSync, isStale, lastFailure }
  })
}
