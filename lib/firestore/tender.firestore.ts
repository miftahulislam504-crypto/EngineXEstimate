// lib/firestore/tender.firestore.ts
//
// দুইটা আলাদা পাথ:
//
//   projects/{projectId}/estimatingInput/tender          ← Engineer Estimate ও Contractor Bid, যে কেউ লিখতে পারবে
//   projects/{projectId}/tenderFinalize/{docId}           ← admin-only write (Phase 0-এর rules commitment)
//
// ⚠️ দ্বিতীয় path-টা Phase 0-এ firestore-rules-for-hub/firestore.rules-এ
// আগেভাগে হার্ডকোড করা হয়েছিল, ঠিক budget.firestore.ts-এর
// BUDGET_APPROVAL_COLLECTION-এর একই সতর্কতা এখানেও প্রযোজ্য: path
// exactly না মিললে rules কোনো protection দেবে না।

import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  EngineerEstimate,
  ContractorBid,
  TenderFinalization,
  StoredTender,
} from '@/lib/types/tender.types'
import { emitEvent } from '@/lib/integration/hub-sdk-client'

const PARENT_COLLECTION = 'estimatingInput'
const TENDER_DOC_ID = 'tender'

// এই নামটা Phase 0-এর firestore.rules-এর match /tenderFinalize/{docId}-এর
// সাথে হুবহু মিলতে হবে — বদলালে rules-ও একসাথে বদলাতে হবে।
const TENDER_FINALIZE_COLLECTION = 'tenderFinalize'

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ─── Engineer Estimate ও Contractor Bid — সবার জন্য write-accessible ──

export async function getTender(projectId: string): Promise<StoredTender | null> {
  const ref = doc(db, 'projects', projectId, PARENT_COLLECTION, TENDER_DOC_ID)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data() as StoredTender
}

async function saveTender(
  projectId: string,
  engineerEstimates: EngineerEstimate[],
  contractorBids: ContractorBid[]
): Promise<void> {
  const ref = doc(db, 'projects', projectId, PARENT_COLLECTION, TENDER_DOC_ID)
  await setDoc(ref, {
    projectId,
    updatedAt: Date.now(),
    engineerEstimates,
    contractorBids,
  } satisfies StoredTender)
}

export async function addEngineerEstimate(
  projectId: string,
  input: Omit<EngineerEstimate, 'id' | 'createdAt'>
): Promise<EngineerEstimate> {
  const estimate: EngineerEstimate = {
    ...input,
    id: generateId('engest'),
    createdAt: Date.now(),
  }
  const current = await getTender(projectId)
  await saveTender(
    projectId,
    [...(current?.engineerEstimates ?? []), estimate],
    current?.contractorBids ?? []
  )
  return estimate
}

export async function addContractorBid(
  projectId: string,
  input: Omit<ContractorBid, 'id' | 'submittedAt'>
): Promise<ContractorBid> {
  const bid: ContractorBid = {
    ...input,
    id: generateId('bid'),
    submittedAt: Date.now(),
  }
  const current = await getTender(projectId)
  await saveTender(
    projectId,
    current?.engineerEstimates ?? [],
    [...(current?.contractorBids ?? []), bid]
  )
  return bid
}

export function getLatestEngineerEstimate(estimates: EngineerEstimate[]): EngineerEstimate | null {
  if (estimates.length === 0) return null
  return [...estimates].sort((a, b) => b.createdAt - a.createdAt)[0]
}

// ─── Tender Finalization — admin-only write (Firestore rules enforce করে) ──

/**
 * budget.firestore.ts-এর createBudgetApproval()-এর একই প্যাটার্ন —
 * client-side কোনো role-চেক নেই ইচ্ছাকৃতভাবে, আসল নিরাপত্তা
 * Firestore rules-এর isEstimatingAdmin()-এ।
 */
export async function createTenderFinalization(
  projectId: string,
  input: Omit<TenderFinalization, 'id' | 'finalizedAt'>
): Promise<TenderFinalization> {
  const finalizeRef = collection(db, 'projects', projectId, TENDER_FINALIZE_COLLECTION)
  const finalization: Omit<TenderFinalization, 'id'> = {
    ...input,
    finalizedAt: Date.now(),
  }
  const docRef = await addDoc(finalizeRef, finalization)

  try {
    await emitEvent(projectId, 'ESTIMATE_APPROVED', {
      finalizedAmount: finalization.finalizedAmount,
      selectedBidId: finalization.selectedBidId,
    })
  } catch {
    /* non-critical */
  }

  return { ...finalization, id: docRef.id }
}

export async function getTenderFinalizationHistory(projectId: string): Promise<TenderFinalization[]> {
  const finalizeRef = collection(db, 'projects', projectId, TENDER_FINALIZE_COLLECTION)
  const q = query(finalizeRef, orderBy('finalizedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ ...(d.data() as Omit<TenderFinalization, 'id'>), id: d.id }))
}

export function getLatestFinalization(finalizations: TenderFinalization[]): TenderFinalization | null {
  if (finalizations.length === 0) return null
  return finalizations[0] // getTenderFinalizationHistory থেকে ইতিমধ্যে desc sorted
}
