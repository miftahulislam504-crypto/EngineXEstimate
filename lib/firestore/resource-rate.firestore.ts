// lib/firestore/resource-rate.firestore.ts
//
// material.firestore.ts-এর একই CRUD + price-history প্যাটার্ন
// mirror করা হয়েছে, শুধু Material-এর বদলে ResourceRate (Labour ও
// Equipment একসাথে, `type` ফিল্ড দিয়ে আলাদা — দুটো আলাদা collection
// বানানো এই মুহূর্তে অপ্রয়োজনীয় বিভাজন হতো, কারণ query pattern
// প্রায় অভিন্ন)।
//
// পাথ:
//   resourceRates/{rateId}                              ← মূল labour/equipment document
//   resourceRates/{rateId}/rateHistory/{entryId}         ← rate পরিবর্তনের ইতিহাস

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as fsLimit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  ResourceRate,
  ResourceRateType,
  ResourceRateHistoryEntry,
} from '@/lib/types/resource-rate.types'
import { SIGNIFICANT_RATE_CHANGE_THRESHOLD_PERCENT } from '@/lib/types/material.types'

const RESOURCE_RATES_COLLECTION = 'resourceRates'
const RATE_HISTORY_SUBCOLLECTION = 'rateHistory'

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export async function createResourceRate(
  input: Omit<ResourceRate, 'id' | 'lastUpdatedAt' | 'isActive'>,
  createdBy?: string
): Promise<ResourceRate> {
  const id = generateId('resource')
  const now = Date.now()

  const rate: ResourceRate = {
    ...input,
    id,
    lastUpdatedAt: now,
    isActive: true,
  }

  await setDoc(doc(db, RESOURCE_RATES_COLLECTION, id), rate)
  await addRateHistoryEntry(id, input.currentRate, createdBy, 'প্রাথমিক রেট')

  return rate
}

export async function getResourceRate(rateId: string): Promise<ResourceRate | null> {
  const snap = await getDoc(doc(db, RESOURCE_RATES_COLLECTION, rateId))
  if (!snap.exists()) return null
  return snap.data() as ResourceRate
}

/**
 * সব সক্রিয় labour/equipment rate লিস্ট করে, ঐচ্ছিকভাবে type
 * (labour/equipment) দিয়ে ফিল্টার — Rate Analysis UI-তে দুই ধরনের
 * resource আলাদা section-এ দেখানোর জন্য এটাই মূলত ব্যবহৃত হবে।
 */
export async function listResourceRates(type?: ResourceRateType): Promise<ResourceRate[]> {
  const ratesRef = collection(db, RESOURCE_RATES_COLLECTION)
  const constraints = type
    ? [where('type', '==', type), where('isActive', '==', true)]
    : [where('isActive', '==', true)]
  const q = query(ratesRef, ...constraints, orderBy('name'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as ResourceRate)
}

export async function updateResourceRate(
  rateId: string,
  newRate: number,
  updatedBy?: string,
  note?: string
): Promise<{ resourceRate: ResourceRate; significantChange: boolean; previousRate: number | null }> {
  const resourceRate = await getResourceRate(rateId)
  if (!resourceRate) {
    throw new Error(`Resource rate "${rateId}" খুঁজে পাওয়া যায়নি।`)
  }

  const previousRate = resourceRate.currentRate
  const percentChange =
    previousRate > 0 ? (Math.abs(newRate - previousRate) / previousRate) * 100 : 0
  const significantChange = percentChange >= SIGNIFICANT_RATE_CHANGE_THRESHOLD_PERCENT

  await updateDoc(doc(db, RESOURCE_RATES_COLLECTION, rateId), {
    currentRate: newRate,
    lastUpdatedAt: Date.now(),
  })

  await addRateHistoryEntry(rateId, newRate, updatedBy, note)

  return {
    resourceRate: { ...resourceRate, currentRate: newRate, lastUpdatedAt: Date.now() },
    significantChange,
    previousRate,
  }
}

async function addRateHistoryEntry(
  resourceRateId: string,
  rate: number,
  recordedBy?: string,
  note?: string
): Promise<void> {
  const entryId = generateId('rate')
  const entry: ResourceRateHistoryEntry = {
    id: entryId,
    resourceRateId,
    rate,
    recordedAt: Date.now(),
    ...(recordedBy ? { recordedBy } : {}),
    ...(note ? { note } : {}),
  }
  await setDoc(
    doc(db, RESOURCE_RATES_COLLECTION, resourceRateId, RATE_HISTORY_SUBCOLLECTION, entryId),
    entry
  )
}

export async function getResourceRateHistory(
  rateId: string,
  maxResults = 30
): Promise<ResourceRateHistoryEntry[]> {
  const historyRef = collection(db, RESOURCE_RATES_COLLECTION, rateId, RATE_HISTORY_SUBCOLLECTION)
  const q = query(historyRef, orderBy('recordedAt', 'desc'), fsLimit(maxResults))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as ResourceRateHistoryEntry)
}

export async function deactivateResourceRate(rateId: string): Promise<void> {
  await updateDoc(doc(db, RESOURCE_RATES_COLLECTION, rateId), { isActive: false })
}

export async function reactivateResourceRate(rateId: string): Promise<void> {
  await updateDoc(doc(db, RESOURCE_RATES_COLLECTION, rateId), { isActive: true })
}
