// lib/firestore/rate-analysis.firestore.ts
//
// পাথ: projects/{projectId}/estimatingInput/rateAnalysis
//
// Hub import/Quantity Takeoff/BOQ-এর মতো versioned না রাখা হয়েছে
// ইচ্ছাকৃতভাবে — কারণ Rate Analysis-এর "সত্যতা" সবসময় live
// Material/ResourceRate rate-এর উপর নির্ভরশীল (rate-analysis.service.ts
// দ্রষ্টব্য), তাই এখানে "কোন version-এ কী rate ছিল" ট্র্যাক করার
// অর্থ কম — consumption ratio (কত সিমেন্ট লাগে) বদলালেই শুধু নতুন
// state, rate বদলালে না। consumption ratio-এর পরিবর্তন সাধারণত
// বিরল (একবার ঠিক হলে থেকে যায়), তাই single-document যথেষ্ট।

import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { RateAnalysisEntry, StoredRateAnalysis } from '@/lib/types/rate-analysis.types'
import { emitEvent } from '@/lib/integration/hub-sdk-client'

const PARENT_COLLECTION = 'estimatingInput'
const DOC_ID = 'rateAnalysis'

export async function getRateAnalysis(projectId: string): Promise<StoredRateAnalysis | null> {
  const ref = doc(db, 'projects', projectId, PARENT_COLLECTION, DOC_ID)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data() as StoredRateAnalysis
}

/**
 * upsertRateAnalysisEntry/deleteRateAnalysisEntry দুটোই এই ফাংশন কল
 * করে, তাই COST_CALCULATED event এখানে একবার emit করলেই তিনটা
 * caller-ই কভার হয়ে যায় — আলাদা আলাদা জায়গায় emit করার দরকার নেই।
 */
export async function saveRateAnalysisEntries(
  projectId: string,
  entries: RateAnalysisEntry[]
): Promise<void> {
  const ref = doc(db, 'projects', projectId, PARENT_COLLECTION, DOC_ID)
  await setDoc(ref, {
    projectId,
    updatedAt: Date.now(),
    entries,
  } satisfies StoredRateAnalysis)

  try {
    await emitEvent(projectId, 'COST_CALCULATED', { entryCount: entries.length })
  } catch {
    /* non-critical */
  }
}

/**
 * একটা নির্দিষ্ট entry upsert করে (নতুন হলে যোগ, পুরনো হলে replace) —
 * UI-তে একটা BOQ item-এর rate analysis edit করার পর এটাই ব্যবহার
 * হবে, পুরো entries array manually manage করার বদলে।
 */
export async function upsertRateAnalysisEntry(
  projectId: string,
  entry: RateAnalysisEntry
): Promise<void> {
  const current = await getRateAnalysis(projectId)
  const existingEntries = current?.entries ?? []
  const exists = existingEntries.some((e) => e.id === entry.id)

  const updatedEntries = exists
    ? existingEntries.map((e) => (e.id === entry.id ? entry : e))
    : [...existingEntries, entry]

  await saveRateAnalysisEntries(projectId, updatedEntries)
}

export async function deleteRateAnalysisEntry(projectId: string, entryId: string): Promise<void> {
  const current = await getRateAnalysis(projectId)
  if (!current) return
  const updatedEntries = current.entries.filter((e) => e.id !== entryId)
  await saveRateAnalysisEntries(projectId, updatedEntries)
}
