// lib/firestore/sync-log.firestore.ts
//
// Module 15 — sync failure handling/monitoring sub-task। budget/
// vendor.firestore.ts-এর একই single-document + entries-array
// প্যাটার্ন অনুসরণ করা হয়েছে — sync attempt ঘন ঘন হতে পারে, প্রতিটার
// জন্য আলাদা document না বানিয়ে একটা document-এ append করা সস্তা।
//
// পাথ: projects/{projectId}/estimatingInput/syncLog

import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { SyncLogEntry, StoredSyncLog, SyncLogStatus, MAX_SYNC_LOG_ENTRIES } from '@/lib/types/integration-hub.types'

const PARENT_COLLECTION = 'estimatingInput'
const DOC_ID = 'syncLog'

function generateId(): string {
  return `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export async function getSyncLog(projectId: string): Promise<StoredSyncLog | null> {
  const ref = doc(db, 'projects', projectId, PARENT_COLLECTION, DOC_ID)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data() as StoredSyncLog
}

/**
 * একটা নতুন sync attempt log করে (সফল বা ব্যর্থ)। MAX_SYNC_LOG_ENTRIES
 * ছাড়িয়ে গেলে সবচেয়ে পুরনোগুলো বাদ দেওয়া হয় (unbounded growth এড়াতে
 * — budget/vendor entries-এর মতো "কখনো না-মোছা" পলিসি এখানে
 * ইচ্ছাকৃতভাবে অনুসরণ করা হয়নি, কারণ sync log audit trail না, শুধু
 * সাম্প্রতিক health monitoring)।
 */
export async function appendSyncLogEntry(
  projectId: string,
  connectionId: string,
  status: SyncLogStatus,
  detail: string,
  errorMessage?: string
): Promise<SyncLogEntry> {
  const entry: SyncLogEntry = {
    id: generateId(),
    connectionId,
    status,
    occurredAt: Date.now(),
    detail,
    ...(errorMessage ? { errorMessage } : {}),
  }

  const current = await getSyncLog(projectId)
  const nextEntries = [...(current?.entries ?? []), entry].slice(-MAX_SYNC_LOG_ENTRIES)

  const ref = doc(db, 'projects', projectId, PARENT_COLLECTION, DOC_ID)
  await setDoc(ref, {
    projectId,
    updatedAt: Date.now(),
    entries: nextEntries,
  } satisfies StoredSyncLog)

  return entry
}
