// lib/firestore/quantity-takeoff.firestore.ts
//
// পাথ:
//   projects/{projectId}/estimatingInput/root/quantityTakeoffs/{importId}  ← প্রতিটা import স্থায়ীভাবে সংরক্ষিত
//   projects/{projectId}/estimatingInput/activeQuantityTakeoff              ← pointer
//
// hub-import.firestore.ts-এর একই versioning যুক্তি এখানেও প্রযোজ্য:
// Structural/Architectural app-এর design বদলে নতুন quantity export
// এলে, পুরনো estimate কোন quantity data-র উপর ভিত্তি করে হয়েছিল তা
// জানা দরকার (audit trail)।
//
// ⚠️ বাগফিক্স: আগে quantityTakeoffs সরাসরি projects/{projectId}/
// estimatingInput/quantityTakeoffs -এ লেখা হতো (৪ segment — Firestore
// SDK "Invalid collection reference: ... must have an odd number of
// segments" throw করত)। hub-import.firestore.ts-এ ঠিক একই bug আগে
// ধরা পড়ে ঠিক হয়েছিল (সেই ফাইলের নিজস্ব bugfix-কমেন্ট দ্রষ্টব্য) —
// এখানে একই ফিক্স প্রয়োগ করা হলো: quantityTakeoffs subcollection-কে
// estimatingInput-এর একটা fixed document ('root') এর নিচে রাখা,
// যাতে activeQuantityTakeoff pointer-এর path (আগে থেকেই বৈধ, ৪
// segment) অপরিবর্তিত থেকে যায়, শুধু quantityTakeoffs-এর অবস্থান
// ঠিক হয় (এখন ৫ segment collection(), ৬ segment doc() — দুটোই বৈধ)।

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { StoredQuantityTakeoff, QuantityTakeoffExport } from '@/lib/types/quantity-takeoff.types'
import { toStoredQuantityTakeoff } from '@/lib/services/quantity-takeoff.service'
import { emitEvent } from '@/lib/integration/hub-sdk-client'

const PARENT_COLLECTION = 'estimatingInput'
const IMPORTS_PARENT_DOC = 'root' // quantityTakeoffs subcollection এই fixed doc-এর নিচে — bugfix note উপরে দ্রষ্টব্য
const IMPORTS_SUBCOLLECTION = 'quantityTakeoffs'
const ACTIVE_POINTER_DOC = 'activeQuantityTakeoff'

interface StoredQuantityTakeoffWithId extends StoredQuantityTakeoff {
  importId: string
}

interface ActiveImportPointer {
  importId: string
  importedAt: number
}

function generateImportId(): string {
  const now = new Date()
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  const rand = Math.random().toString(36).slice(2, 8)
  return `quantityTakeoff_${stamp}_${rand}`
}

export async function saveQuantityTakeoff(
  payload: QuantityTakeoffExport
): Promise<StoredQuantityTakeoffWithId> {
  const importId = generateImportId()
  const stored: StoredQuantityTakeoffWithId = {
    ...toStoredQuantityTakeoff(payload),
    importId,
  }

  const importRef = doc(
    db,
    'projects',
    payload.projectId,
    PARENT_COLLECTION,
    IMPORTS_PARENT_DOC,
    IMPORTS_SUBCOLLECTION,
    importId
  )
  const pointerRef = doc(db, 'projects', payload.projectId, PARENT_COLLECTION, ACTIVE_POINTER_DOC)

  await setDoc(importRef, stored)
  await setDoc(pointerRef, { importId, importedAt: stored.importedAt } satisfies ActiveImportPointer)

  // Module 15 — Hub SDK event (non-critical: emit ব্যর্থ হলেও save
  // সফল থাকবে, Hub-এর নিজস্ব linkDependency()-এর একই try/catch
  // কনভেনশন অনুসরণ করা হয়েছে)
  try {
    await emitEvent(payload.projectId, 'QUANTITY_CALCULATED', {
      importId,
      architecturalFloorCount: payload.architecturalFloors?.length ?? 0,
      structuralFloorCount: payload.structuralFloors?.length ?? 0,
    })
  } catch {
    /* non-critical */
  }

  return stored
}

export async function getActiveQuantityTakeoff(
  projectId: string
): Promise<StoredQuantityTakeoffWithId | null> {
  const pointerRef = doc(db, 'projects', projectId, PARENT_COLLECTION, ACTIVE_POINTER_DOC)
  const pointerSnap = await getDoc(pointerRef)
  if (!pointerSnap.exists()) return null

  const { importId } = pointerSnap.data() as ActiveImportPointer
  const importRef = doc(db, 'projects', projectId, PARENT_COLLECTION, IMPORTS_PARENT_DOC, IMPORTS_SUBCOLLECTION, importId)
  const importSnap = await getDoc(importRef)
  if (!importSnap.exists()) return null

  return importSnap.data() as StoredQuantityTakeoffWithId
}

export async function getQuantityTakeoffHistory(
  projectId: string,
  maxResults = 20
): Promise<StoredQuantityTakeoffWithId[]> {
  const importsRef = collection(db, 'projects', projectId, PARENT_COLLECTION, IMPORTS_PARENT_DOC, IMPORTS_SUBCOLLECTION)
  const q = query(importsRef, orderBy('importedAt', 'desc'), limit(maxResults))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as StoredQuantityTakeoffWithId)
}

/**
 * একটা নির্দিষ্ট floor-এর একটা নির্দিষ্ট ফিল্ডে manual override সেট
 * করে। পুরো document rewrite না করে শুধু সেই floor-এর override
 * আপডেট করা হয় — কিন্তু Firestore-এ nested array update করার
 * সরাসরি উপায় নেই (arrayUnion/arrayRemove exact match লাগে), তাই
 * পুরো array পড়ে, প্রাসঙ্গিক entry বদলে, পুরো array আবার লেখা হচ্ছে।
 * এটা বড় প্রজেক্টে (অনেক floor) অদক্ষ হতে পারে — floor-সংখ্যা
 * বাস্তবে সীমিত (সাধারণত ২০-৩০-এর বেশি না) বলে এই মুহূর্তে গ্রহণযোগ্য,
 * কিন্তু ভবিষ্যতে প্রতিটা floor আলাদা document করার কথা ভাবা যেতে
 * পারে যদি performance সমস্যা দেখা দেয়।
 */
export async function overrideArchitecturalFloor(
  projectId: string,
  importId: string,
  floorId: string,
  override: StoredQuantityTakeoff['architecturalFloors'][number]['raw']
): Promise<void> {
  const importRef = doc(db, 'projects', projectId, PARENT_COLLECTION, IMPORTS_PARENT_DOC, IMPORTS_SUBCOLLECTION, importId)
  const snap = await getDoc(importRef)
  if (!snap.exists()) throw new Error(`Quantity takeoff import "${importId}" পাওয়া যায়নি।`)

  const current = snap.data() as StoredQuantityTakeoffWithId
  const updatedFloors = current.architecturalFloors.map((item) =>
    item.raw.floorId === floorId ? { ...item, override, isOverridden: true } : item
  )

  await setDoc(importRef, { ...current, architecturalFloors: updatedFloors })
}

export async function overrideStructuralFloor(
  projectId: string,
  importId: string,
  floorId: string,
  override: StoredQuantityTakeoff['structuralFloors'][number]['raw']
): Promise<void> {
  const importRef = doc(db, 'projects', projectId, PARENT_COLLECTION, IMPORTS_PARENT_DOC, IMPORTS_SUBCOLLECTION, importId)
  const snap = await getDoc(importRef)
  if (!snap.exists()) throw new Error(`Quantity takeoff import "${importId}" পাওয়া যায়নি।`)

  const current = snap.data() as StoredQuantityTakeoffWithId
  const updatedFloors = current.structuralFloors.map((item) =>
    item.raw.floorId === floorId ? { ...item, override, isOverridden: true } : item
  )

  await setDoc(importRef, { ...current, structuralFloors: updatedFloors })
}

/**
 * একটা floor-এর override সম্পূর্ণ মুছে raw মানে ফিরিয়ে আনে —
 * isOverridden সত্যিকারভাবে false করে, শুধু override-এর মান raw-এর
 * সমান বসিয়ে দেয় না (সেটা করলে "✎ ম্যানুয়ালি সংশোধিত" ব্যাজ ভুলভাবে
 * থেকে যেত)।
 */
export async function revertArchitecturalFloor(
  projectId: string,
  importId: string,
  floorId: string
): Promise<void> {
  const importRef = doc(db, 'projects', projectId, PARENT_COLLECTION, IMPORTS_PARENT_DOC, IMPORTS_SUBCOLLECTION, importId)
  const snap = await getDoc(importRef)
  if (!snap.exists()) throw new Error(`Quantity takeoff import "${importId}" পাওয়া যায়নি।`)

  const current = snap.data() as StoredQuantityTakeoffWithId
  const updatedFloors = current.architecturalFloors.map((item) =>
    item.raw.floorId === floorId ? { raw: item.raw, isOverridden: false } : item
  )

  await setDoc(importRef, { ...current, architecturalFloors: updatedFloors })
}

export async function revertStructuralFloor(
  projectId: string,
  importId: string,
  floorId: string
): Promise<void> {
  const importRef = doc(db, 'projects', projectId, PARENT_COLLECTION, IMPORTS_PARENT_DOC, IMPORTS_SUBCOLLECTION, importId)
  const snap = await getDoc(importRef)
  if (!snap.exists()) throw new Error(`Quantity takeoff import "${importId}" পাওয়া যায়নি।`)

  const current = snap.data() as StoredQuantityTakeoffWithId
  const updatedFloors = current.structuralFloors.map((item) =>
    item.raw.floorId === floorId ? { raw: item.raw, isOverridden: false } : item
  )

  await setDoc(importRef, { ...current, structuralFloors: updatedFloors })
}
