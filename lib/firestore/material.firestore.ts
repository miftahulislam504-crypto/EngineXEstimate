// lib/firestore/material.firestore.ts
//
// পাথ:
//   materials/{materialId}                              ← মূল material document
//   materials/{materialId}/priceHistory/{entryId}         ← Module 6-এর daily rate log
//
// নোট: Hub-এর firestore.rules-এ "materials" কালেকশনের জন্য আলাদা কোনো
// rule নেই — এই app যেহেতু আলাদা top-level collection ব্যবহার করছে
// (projects/{id}-এর নিচে না, কারণ material database প্রজেক্ট-নির্দিষ্ট
// না, পুরো organization-এর জন্য শেয়ার্ড), Hub-এর rules-এ এটা নতুন
// করে যোগ করতে হবে। এই কাজ শেষে firestore-rules-for-hub/README.md-এ
// এই আপডেট যোগ করা হবে।

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
  Material,
  MaterialCategory,
  PriceHistoryEntry,
  SIGNIFICANT_RATE_CHANGE_THRESHOLD_PERCENT,
} from '@/lib/types/material.types'

const MATERIALS_COLLECTION = 'materials'
const PRICE_HISTORY_SUBCOLLECTION = 'priceHistory'

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * নতুন material যোগ করে। currentRate initial entry হিসেবে
 * priceHistory-তেও একবার লেখা হয় — যাতে "শুরুতে rate কত ছিল" সবসময়
 * ইতিহাসে থাকে, প্রথম আপডেটের অপেক্ষা না করেই।
 */
export async function createMaterial(
  input: Omit<Material, 'id' | 'lastUpdatedAt' | 'isActive'>,
  createdBy?: string
): Promise<Material> {
  const id = generateId('material')
  const now = Date.now()

  const material: Material = {
    ...input,
    id,
    lastUpdatedAt: now,
    isActive: true,
  }

  await setDoc(doc(db, MATERIALS_COLLECTION, id), material)

  // initial rate entry
  await addPriceHistoryEntry(id, input.currentRate, 'manual', createdBy, 'প্রাথমিক রেট')

  return material
}

export async function getMaterial(materialId: string): Promise<Material | null> {
  const snap = await getDoc(doc(db, MATERIALS_COLLECTION, materialId))
  if (!snap.exists()) return null
  return snap.data() as Material
}

/**
 * সব সক্রিয় material লিস্ট করে, ঐচ্ছিকভাবে category দিয়ে ফিল্টার
 * করে। inactive material বাদ দেওয়া হয় ডিফল্টে, কারণ Rate
 * Analysis/BOQ-এ সাধারণত সেগুলো দেখানোর দরকার নেই, কিন্তু পুরনো
 * estimate-এ রেফারেন্স থাকতে পারে বলে ডেটা মোছা হয় না।
 */
export async function listMaterials(category?: MaterialCategory): Promise<Material[]> {
  const materialsRef = collection(db, MATERIALS_COLLECTION)
  const constraints = category
    ? [where('category', '==', category), where('isActive', '==', true)]
    : [where('isActive', '==', true)]
  const q = query(materialsRef, ...constraints, orderBy('name'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as Material)
}

/**
 * Material-এর rate আপডেট করে এবং priceHistory-তে নতুন entry যোগ করে।
 * এটাই Module 6 (Market Rate Update)-এর মূল কাজ — "প্রতিদিন Rate
 * Update হবে" এখানেই বাস্তবায়িত।
 *
 * রিটার্ন value-তে একটা flag থাকে যদি পরিবর্তনটা উল্লেখযোগ্য হয়
 * (SIGNIFICANT_RATE_CHANGE_THRESHOLD_PERCENT-এর বেশি), যাতে UI
 * চাইলে সতর্কতা দেখাতে পারে।
 */
export async function updateMaterialRate(
  materialId: string,
  newRate: number,
  updatedBy?: string,
  note?: string
): Promise<{ material: Material; significantChange: boolean; previousRate: number | null }> {
  const material = await getMaterial(materialId)
  if (!material) {
    throw new Error(`Material "${materialId}" খুঁজে পাওয়া যায়নি।`)
  }

  const previousRate = material.currentRate
  const percentChange =
    previousRate > 0 ? (Math.abs(newRate - previousRate) / previousRate) * 100 : 0
  const significantChange = percentChange >= SIGNIFICANT_RATE_CHANGE_THRESHOLD_PERCENT

  await updateDoc(doc(db, MATERIALS_COLLECTION, materialId), {
    currentRate: newRate,
    lastUpdatedAt: Date.now(),
  })

  await addPriceHistoryEntry(materialId, newRate, 'manual', updatedBy, note)

  return {
    material: { ...material, currentRate: newRate, lastUpdatedAt: Date.now() },
    significantChange,
    previousRate,
  }
}

async function addPriceHistoryEntry(
  materialId: string,
  rate: number,
  source: PriceHistoryEntry['source'],
  recordedBy?: string,
  note?: string
): Promise<void> {
  const entryId = generateId('price')
  const entry: PriceHistoryEntry = {
    id: entryId,
    materialId,
    rate,
    recordedAt: Date.now(),
    source,
    ...(recordedBy ? { recordedBy } : {}),
    ...(note ? { note } : {}),
  }
  await setDoc(
    doc(db, MATERIALS_COLLECTION, materialId, PRICE_HISTORY_SUBCOLLECTION, entryId),
    entry
  )
}

/**
 * একটা material-এর rate ইতিহাস ফিরিয়ে আনে, নতুনটা প্রথমে। Module
 * 5-এর "Price History" ফিচারের জন্য সরাসরি এটাই ব্যবহার হবে।
 */
export async function getPriceHistory(
  materialId: string,
  maxResults = 30
): Promise<PriceHistoryEntry[]> {
  const historyRef = collection(db, MATERIALS_COLLECTION, materialId, PRICE_HISTORY_SUBCOLLECTION)
  const q = query(historyRef, orderBy('recordedAt', 'desc'), fsLimit(maxResults))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as PriceHistoryEntry)
}

/**
 * Material সম্পূর্ণ মুছে ফেলার বদলে inactive করে — কারণ পুরনো BOQ বা
 * estimate-এ এই material-এর রেফারেন্স থাকতে পারে, hard delete করলে
 * সেই রেফারেন্স ভেঙে যাবে।
 */
export async function deactivateMaterial(materialId: string): Promise<void> {
  await updateDoc(doc(db, MATERIALS_COLLECTION, materialId), { isActive: false })
}

export async function reactivateMaterial(materialId: string): Promise<void> {
  await updateDoc(doc(db, MATERIALS_COLLECTION, materialId), { isActive: true })
}
