// lib/firestore/boq.firestore.ts
//
// পাথ:
//   projects/{projectId}/estimatingInput/root/boqVersions/{versionId}  ← প্রতিটা BOQ version স্থায়ীভাবে সংরক্ষিত
//   projects/{projectId}/estimatingInput/activeBoqVersion               ← pointer
//
// Original doc-এ "BOQ Versioning" ও "BOQ History" আলাদা করে চাওয়া
// হয়েছিল — hub-import.firestore.ts ও quantity-takeoff.firestore.ts-এর
// একই versioned-subcollection + active-pointer প্যাটার্ন এখানেও
// অনুসরণ করা হয়েছে, ecosystem জুড়ে consistency-র জন্য।
//
// ⚠️ বাগফিক্স: আগে boqVersions সরাসরি projects/{projectId}/
// estimatingInput/boqVersions -এ লেখা হতো (৪ segment — Firestore
// SDK "Invalid collection reference: ... must have an odd number of
// segments" throw করত)। hub-import.firestore.ts-এ ঠিক একই bug আগে
// ধরা পড়ে ঠিক হয়েছিল (সেই ফাইলের নিজস্ব bugfix-কমেন্ট দ্রষ্টব্য) —
// এখানে একই ফিক্স প্রয়োগ করা হলো: boqVersions subcollection-কে
// estimatingInput-এর একটা fixed document ('root') এর নিচে রাখা,
// যাতে activeBoqVersion pointer-এর path (আগে থেকেই বৈধ, ৪ segment)
// অপরিবর্তিত থেকে যায়, শুধু boqVersions-এর অবস্থান ঠিক হয় (এখন ৫
// segment collection(), ৬ segment doc() — দুটোই বৈধ)।

import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { BOQItem, BOQVersion } from '@/lib/types/boq.types'
import { emitEvent } from '@/lib/integration/hub-sdk-client'

const PARENT_COLLECTION = 'estimatingInput'
const VERSIONS_PARENT_DOC = 'root' // boqVersions subcollection এই fixed doc-এর নিচে — bugfix note উপরে দ্রষ্টব্য
const VERSIONS_SUBCOLLECTION = 'boqVersions'
const ACTIVE_POINTER_DOC = 'activeBoqVersion'

interface ActiveVersionPointer {
  versionId: string
  createdAt: number
}

function generateVersionId(): string {
  const now = new Date()
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  const rand = Math.random().toString(36).slice(2, 8)
  return `boq_${stamp}_${rand}`
}

export async function saveBOQVersion(
  projectId: string,
  items: BOQItem[],
  options?: { generatedFromQuantityImportId?: string; label?: string }
): Promise<BOQVersion> {
  const versionId = generateVersionId()
  const version: BOQVersion = {
    versionId,
    projectId,
    createdAt: Date.now(),
    items,
    ...(options?.generatedFromQuantityImportId
      ? { generatedFromQuantityImportId: options.generatedFromQuantityImportId }
      : {}),
    ...(options?.label ? { label: options.label } : {}),
  }

  const versionRef = doc(db, 'projects', projectId, PARENT_COLLECTION, VERSIONS_PARENT_DOC, VERSIONS_SUBCOLLECTION, versionId)
  const pointerRef = doc(db, 'projects', projectId, PARENT_COLLECTION, ACTIVE_POINTER_DOC)

  await setDoc(versionRef, version)
  await setDoc(pointerRef, {
    versionId,
    createdAt: version.createdAt,
  } satisfies ActiveVersionPointer)

  try {
    await emitEvent(projectId, 'BOQ_GENERATED', { versionId, itemCount: items.length })
  } catch {
    /* non-critical */
  }

  return version
}

export async function getActiveBOQVersion(projectId: string): Promise<BOQVersion | null> {
  const pointerRef = doc(db, 'projects', projectId, PARENT_COLLECTION, ACTIVE_POINTER_DOC)
  const pointerSnap = await getDoc(pointerRef)
  if (!pointerSnap.exists()) return null

  const { versionId } = pointerSnap.data() as ActiveVersionPointer
  const versionRef = doc(db, 'projects', projectId, PARENT_COLLECTION, VERSIONS_PARENT_DOC, VERSIONS_SUBCOLLECTION, versionId)
  const versionSnap = await getDoc(versionRef)
  if (!versionSnap.exists()) return null

  return versionSnap.data() as BOQVersion
}

export async function getBOQVersionHistory(projectId: string, maxResults = 20): Promise<BOQVersion[]> {
  const versionsRef = collection(db, 'projects', projectId, PARENT_COLLECTION, VERSIONS_PARENT_DOC, VERSIONS_SUBCOLLECTION)
  const q = query(versionsRef, orderBy('createdAt', 'desc'), limit(maxResults))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as BOQVersion)
}

export async function getBOQVersionById(projectId: string, versionId: string): Promise<BOQVersion | null> {
  const versionRef = doc(db, 'projects', projectId, PARENT_COLLECTION, VERSIONS_PARENT_DOC, VERSIONS_SUBCOLLECTION, versionId)
  const snap = await getDoc(versionRef)
  if (!snap.exists()) return null
  return snap.data() as BOQVersion
}

/**
 * একটা পুরনো version-কে আবার active করে — Hub import-এর
 * setActiveHubImport()-এর একই rollback প্যাটার্ন।
 */
export async function setActiveBOQVersion(projectId: string, versionId: string): Promise<void> {
  const target = await getBOQVersionById(projectId, versionId)
  if (!target) {
    throw new Error(`BOQ version "${versionId}" খুঁজে পাওয়া যায়নি — active করা যাবে না।`)
  }
  const pointerRef = doc(db, 'projects', projectId, PARENT_COLLECTION, ACTIVE_POINTER_DOC)
  await setDoc(pointerRef, {
    versionId,
    createdAt: target.createdAt,
  } satisfies ActiveVersionPointer)
}

/**
 * বর্তমান active version-এর items আপডেট করে **নতুন version না
 * বানিয়ে** — ছোট এডিট (একটা item-এর quantity বদলানো, নতুন custom
 * item যোগ করা)-এর জন্য প্রতিবার নতুন version তৈরি করলে history
 * দ্রুত অপ্রয়োজনীয়ভাবে বড় হয়ে যাবে। শুধু "BOQ Generator থেকে আবার
 * auto-generate করা" বা ব্যবহারকারী স্পষ্টভাবে "নতুন version হিসেবে
 * সংরক্ষণ করুন" চাইলে saveBOQVersion() (নতুন version) ব্যবহার করা
 * উচিত, routine item-এডিটে এই ফাংশন।
 */
export async function updateActiveBOQItems(projectId: string, items: BOQItem[]): Promise<void> {
  const pointerRef = doc(db, 'projects', projectId, PARENT_COLLECTION, ACTIVE_POINTER_DOC)
  const pointerSnap = await getDoc(pointerRef)
  if (!pointerSnap.exists()) {
    throw new Error('কোনো active BOQ version নেই — আগে একটা BOQ generate/save করুন।')
  }

  const { versionId } = pointerSnap.data() as ActiveVersionPointer
  const versionRef = doc(db, 'projects', projectId, PARENT_COLLECTION, VERSIONS_PARENT_DOC, VERSIONS_SUBCOLLECTION, versionId)
  const snap = await getDoc(versionRef)
  if (!snap.exists()) throw new Error(`BOQ version "${versionId}" পাওয়া যায়নি।`)

  const current = snap.data() as BOQVersion
  await setDoc(versionRef, { ...current, items })
}
