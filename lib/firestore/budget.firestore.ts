// lib/firestore/budget.firestore.ts
//
// দুইটা আলাদা পাথ, ইচ্ছাকৃতভাবে আলাদা কারণে:
//
//   projects/{projectId}/estimatingInput/budget          ← Planned/Revised entries, যে কেউ লিখতে পারবে
//   projects/{projectId}/budgetApproval/{docId}           ← admin-only write (Phase 0-এর rules commitment)
//
// ⚠️ দ্বিতীয় path-টা Phase 0-এ firestore-rules-for-hub/firestore.rules-এ
// আগেভাগে হার্ডকোড করা হয়েছিল। এখানে path exactly না মিললে rules
// কোনো protection দেবে না — Firestore rules exact path string মেলায়,
// document-এর অর্থ বোঝে না। তাই নিচের BUDGET_APPROVAL_COLLECTION
// constant-টা 'budgetApproval'-এর সাথে হুবহু মেলাতে হবে।

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
import { BudgetEntry, BudgetApproval, StoredBudget } from '@/lib/types/budget.types'

const PARENT_COLLECTION = 'estimatingInput'
const BUDGET_DOC_ID = 'budget'

// এই নামটা Phase 0-এর firestore.rules-এর match /budgetApproval/{docId}-এর
// সাথে হুবহু মিলতে হবে — বদলালে rules-ও একসাথে বদলাতে হবে।
const BUDGET_APPROVAL_COLLECTION = 'budgetApproval'

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ─── Budget Entries (Planned/Revised) — সবার জন্য write-accessible ──

export async function getBudget(projectId: string): Promise<StoredBudget | null> {
  const ref = doc(db, 'projects', projectId, PARENT_COLLECTION, BUDGET_DOC_ID)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data() as StoredBudget
}

export async function addBudgetEntry(
  projectId: string,
  input: Omit<BudgetEntry, 'id' | 'createdAt'>
): Promise<BudgetEntry> {
  const entry: BudgetEntry = {
    ...input,
    id: generateId('budgetentry'),
    createdAt: Date.now(),
  }

  const current = await getBudget(projectId)
  const updatedEntries = [...(current?.entries ?? []), entry]

  const ref = doc(db, 'projects', projectId, PARENT_COLLECTION, BUDGET_DOC_ID)
  await setDoc(ref, {
    projectId,
    updatedAt: Date.now(),
    entries: updatedEntries,
  } satisfies StoredBudget)

  return entry
}

/**
 * এই ফাংশনটা এখন lib/services/budget.service.ts-এ সংজ্ঞায়িত —
 * কোনো Firestore call নেই বলে সেটাই সঠিক জায়গা (Module 11
 * বানানোর সময় এই ভুল ধরা পড়ে সরানো হয়েছে)। এখানে শুধু re-export
 * রাখা হয়েছে, যাতে এই ফাইল থেকে import করা বাকি সব কোড
 * (BudgetPanel.tsx) ভাঙতে না হয়।
 */
export { getLatestBudgetEntry } from '@/lib/services/budget.service'

// ─── Budget Approval — admin-only write (Firestore rules enforce করে) ──

/**
 * নতুন approval তৈরি করে। এই write অপারেশন Firestore rules-এ
 * isEstimatingAdmin() দিয়ে গার্ড করা — যদি কল-কারীর estimatingRole
 * 'admin' না হয়, এই addDoc() ব্যর্থ হবে "permission-denied" error
 * দিয়ে। এখানে client-side কোনো role-চেক নেই ইচ্ছাকৃতভাবে — আসল
 * নিরাপত্তা rules-এই থাকা উচিত, ডুপ্লিকেট চেক client-এ রাখলে সেটা
 * শুধু UX-improvement (দ্রুত error message), নিরাপত্তা না।
 */
export async function createBudgetApproval(
  projectId: string,
  input: Omit<BudgetApproval, 'id' | 'approvedAt'>
): Promise<BudgetApproval> {
  const approvalsRef = collection(db, 'projects', projectId, BUDGET_APPROVAL_COLLECTION)
  const approval: Omit<BudgetApproval, 'id'> = {
    ...input,
    approvedAt: Date.now(),
  }
  const docRef = await addDoc(approvalsRef, approval)
  return { ...approval, id: docRef.id }
}

/**
 * সব approval history — read সবার জন্য উন্মুক্ত (rules অনুযায়ী),
 * শুধু write admin-only।
 */
export async function getBudgetApprovalHistory(projectId: string): Promise<BudgetApproval[]> {
  const approvalsRef = collection(db, 'projects', projectId, BUDGET_APPROVAL_COLLECTION)
  const q = query(approvalsRef, orderBy('approvedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ ...(d.data() as Omit<BudgetApproval, 'id'>), id: d.id }))
}

export function getLatestApproval(approvals: BudgetApproval[]): BudgetApproval | null {
  if (approvals.length === 0) return null
  return approvals[0] // ইতিমধ্যে approvedAt desc দিয়ে sorted (getBudgetApprovalHistory থেকে)
}
