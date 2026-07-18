// lib/firestore/vendor.firestore.ts
//
// পাথ: projects/{projectId}/estimatingInput/vendorData
//
// Quotation ও Purchase Record — project-scoped (vendor.types.ts-এর
// শীর্ষে বিস্তারিত কারণ)। budget/tender.firestore.ts-এর একই
// single-document প্যাটার্ন (versioned না — quotation/purchase
// ক্রমান্বয়ে যোগ হয়, প্রতিটা addition আলাদা version হিসেবে ট্র্যাক
// করার প্রয়োজনীয়তা স্পষ্ট না)।

import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Quotation, PurchaseRecord, StoredVendorData } from '@/lib/types/vendor.types'

const PARENT_COLLECTION = 'estimatingInput'
const DOC_ID = 'vendorData'

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export async function getVendorData(projectId: string): Promise<StoredVendorData | null> {
  const ref = doc(db, 'projects', projectId, PARENT_COLLECTION, DOC_ID)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data() as StoredVendorData
}

async function saveVendorData(
  projectId: string,
  quotations: Quotation[],
  purchases: PurchaseRecord[]
): Promise<void> {
  const ref = doc(db, 'projects', projectId, PARENT_COLLECTION, DOC_ID)
  await setDoc(ref, {
    projectId,
    updatedAt: Date.now(),
    quotations,
    purchases,
  } satisfies StoredVendorData)
}

export async function addQuotation(
  projectId: string,
  input: Omit<Quotation, 'id' | 'quotedAt'>
): Promise<Quotation> {
  const quotation: Quotation = {
    ...input,
    id: generateId('quote'),
    quotedAt: Date.now(),
  }
  const current = await getVendorData(projectId)
  await saveVendorData(projectId, [...(current?.quotations ?? []), quotation], current?.purchases ?? [])
  return quotation
}

export async function addPurchaseRecord(
  projectId: string,
  input: Omit<PurchaseRecord, 'id' | 'purchasedAt' | 'totalAmount'>
): Promise<PurchaseRecord> {
  const purchase: PurchaseRecord = {
    ...input,
    id: generateId('purchase'),
    purchasedAt: Date.now(),
    totalAmount: input.quantity * input.unitRate,
  }
  const current = await getVendorData(projectId)
  await saveVendorData(projectId, current?.quotations ?? [], [...(current?.purchases ?? []), purchase])
  return purchase
}

export async function deleteQuotation(projectId: string, quotationId: string): Promise<void> {
  const current = await getVendorData(projectId)
  if (!current) return
  await saveVendorData(
    projectId,
    current.quotations.filter((q) => q.id !== quotationId),
    current.purchases
  )
}
