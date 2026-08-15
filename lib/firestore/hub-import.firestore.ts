// lib/firestore/hub-import.firestore.ts
//
// যাচাই হওয়া Hub payload প্রজেক্টের নিচে ভার্সন-সহ সংরক্ষণ করার জন্য।
//
// পাথ:
//   projects/{projectId}/estimatingInput/root/hubImports/{importId}  ← প্রতিটা import স্থায়ীভাবে সংরক্ষিত
//   projects/{projectId}/estimatingInput/activeImport                 ← কোনটা "current" তার pointer
//
// ⚠️ বাগফিক্স: আগে hubImports সরাসরি projects/{projectId}/
// estimatingInput/hubImports/{importId} এ লেখা হতো — কিন্তু Firestore
// document path-এ সবসময় জোড় সংখ্যক segment লাগে (collection→doc→
// collection→doc→...)। সেই path গুনলে ৫টা segment
// (projects, projectId, estimatingInput, hubImports, importId) — বেজোড়,
// Firestore SDK নিজেই "Invalid document reference" throw করতো। এটা এই
// ফাইলের একটা pre-existing bug ছিল যা কখনো আগে trigger হয়নি (ম্যানুয়াল
// import panel-এ কেউ কখনো সফলভাবে সম্পূর্ণ save করেননি), hub-native-
// sync.ts-এর automatic sync প্রথমবার এটা চালিয়ে ধরা পড়েছে।
//
// ফিক্স: hubImports subcollection-কে estimatingInput collection-এর
// একটা fixed document ('root') এর নিচে রাখা হয়েছে, ঠিক activeImport
// pointer-এর মতোই একই collection-এর sibling document — এতে
// activeImport-এর path (আগে থেকেই বৈধ, ৪ segment) অপরিবর্তিত থাকে,
// শুধু hubImports-এর অবস্থান ঠিক হলো (এখন ৬ segment, জোড়, বৈধ)।
//
// কেন versioned (overwrite-only না): Module 4 (Rate Analysis) ও
// Module 7 (Reinforcement Estimation) সরাসরি buildingInfo/bnbcSettings-এর
// উপর নির্ভরশীল হিসাব করে। Hub-এ BNBC/Building data সংশোধন হয়ে আবার
// export হলে, আগের হিসাব কোন ডেটার উপর ভিত্তি করে হয়েছিল তা জানা
// দরকার — এটা audit trail, শুধু data-loss প্রতিরোধ না। Module 3-এর
// BOQ Versioning-এর মতো একই প্যাটার্ন এখানে অনুসরণ করা হয়েছে।
//
// activeImport আলাদা document হিসেবে রাখা হয়েছে যাতে "সর্বশেষ কোনটা"
// বের করতে প্রতিবার subcollection query+sort করে Firestore read খরচ
// করতে না হয় — Module 2-15 প্রতিটাই ঘন ঘন এটা read করবে।

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { EstimatingRelevantPayload } from '@/lib/types/hub-import.types'

const PARENT_COLLECTION = 'estimatingInput'
const IMPORTS_PARENT_DOC = 'root' // hubImports subcollection এই fixed doc-এর নিচে — bugfix note উপরে দ্রষ্টব্য
const IMPORTS_SUBCOLLECTION = 'hubImports'
const ACTIVE_POINTER_DOC = 'activeImport'

export interface StoredHubImport extends EstimatingRelevantPayload {
  importId: string
  importedAt: Timestamp
  importedBy?: string // uid, যদি auth থেকে পাওয়া যায়
}

interface ActiveImportPointer {
  importId: string
  importedAt: Timestamp
}

/**
 * ID তৈরি করে যাতে timestamp প্রথমে থাকে — Firestore console-এ
 * document list দেখলেই chronological order বোঝা যায়, আলাদা sort
 * ছাড়াই।
 */
function generateImportId(): string {
  const now = new Date()
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  const rand = Math.random().toString(36).slice(2, 8)
  return `hubImport_${stamp}_${rand}`
}

/**
 * যাচাই হওয়া payload নতুন version হিসেবে সংরক্ষণ করে এবং
 * activeImport pointer আপডেট করে। আগের কোনো import মুছে যায় না।
 */
export async function saveHubImport(
  projectId: string,
  payload: EstimatingRelevantPayload,
  importedBy?: string
): Promise<StoredHubImport> {
  const importId = generateImportId()
  const importRef = doc(
    db,
    'projects',
    projectId,
    PARENT_COLLECTION,
    IMPORTS_PARENT_DOC,
    IMPORTS_SUBCOLLECTION,
    importId
  )
  const pointerRef = doc(db, 'projects', projectId, PARENT_COLLECTION, ACTIVE_POINTER_DOC)

  const now = Timestamp.now()
  const stored: StoredHubImport = {
    ...payload,
    importId,
    importedAt: now,
    ...(importedBy ? { importedBy } : {}),
  }

  // দুইটা write আলাদা — একই সাথে আটকে গেলে (batch/transaction) ভালো
  // হতো, কিন্তু Phase 0-এ সরলতার জন্য sequential রাখা হলো। যদি প্রথম
  // write সফল হয়ে দ্বিতীয়টা ব্যর্থ হয়, importId subcollection-এ থেকে
  // যাবে কিন্তু pointer আপডেট হবে না — সেক্ষেত্রে getActiveHubImport()
  // পুরনো active import ফেরত দেবে, নতুনটা হারাবে না, শুধু "active"
  // হিসেবে চিহ্নিত হবে না। getAllHubImports() দিয়ে সেটা এখনও দেখা
  // যাবে।
  await setDoc(importRef, stored)
  await setDoc(pointerRef, { importId, importedAt: now } satisfies ActiveImportPointer)

  return stored
}

/**
 * বর্তমানে "active" হিসেবে চিহ্নিত Hub import ফিরিয়ে আনে।
 * Module 2 (Quantity Takeoff) ও অন্যান্য Module এটাই সাধারণত ব্যবহার
 * করবে — একটা read দিয়ে pointer, তারপর একটা read দিয়ে আসল ডেটা।
 */
export async function getActiveHubImport(projectId: string): Promise<StoredHubImport | null> {
  const pointerRef = doc(db, 'projects', projectId, PARENT_COLLECTION, ACTIVE_POINTER_DOC)
  const pointerSnap = await getDoc(pointerRef)
  if (!pointerSnap.exists()) return null

  const { importId } = pointerSnap.data() as ActiveImportPointer
  const importRef = doc(
    db,
    'projects',
    projectId,
    PARENT_COLLECTION,
    IMPORTS_PARENT_DOC,
    IMPORTS_SUBCOLLECTION,
    importId
  )
  const importSnap = await getDoc(importRef)
  if (!importSnap.exists()) return null // pointer আছে কিন্তু ডেটা মুছে গেছে — অসামঞ্জস্যপূর্ণ অবস্থা

  return importSnap.data() as StoredHubImport
}

/**
 * এই প্রজেক্টের সব Hub import history ফিরিয়ে আনে, সবচেয়ে নতুনটা
 * প্রথমে। "কোন estimate কোন building data থেকে বানানো হয়েছিল" —
 * এই প্রশ্নের জবাব দিতে এটা ব্যবহার হবে (ভবিষ্যতে Module 13
 * Reports-এও কাজে লাগতে পারে)।
 */
export async function getHubImportHistory(
  projectId: string,
  maxResults = 20
): Promise<StoredHubImport[]> {
  const importsRef = collection(
    db,
    'projects',
    projectId,
    PARENT_COLLECTION,
    IMPORTS_PARENT_DOC,
    IMPORTS_SUBCOLLECTION
  )
  const q = query(importsRef, orderBy('importedAt', 'desc'), limit(maxResults))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as StoredHubImport)
}

/**
 * নির্দিষ্ট importId দিয়ে একটা নির্দিষ্ট version ফিরিয়ে আনে — কোনো
 * estimate পুরনো import-এর সাথে লিংক করা থাকলে সেটা reconstruct
 * করতে লাগবে।
 */
export async function getHubImportById(
  projectId: string,
  importId: string
): Promise<StoredHubImport | null> {
  const importRef = doc(
    db,
    'projects',
    projectId,
    PARENT_COLLECTION,
    IMPORTS_PARENT_DOC,
    IMPORTS_SUBCOLLECTION,
    importId
  )
  const snap = await getDoc(importRef)
  if (!snap.exists()) return null
  return snap.data() as StoredHubImport
}

/**
 * একটা পুরনো import-কে আবার active হিসেবে চিহ্নিত করে, নতুন কোনো
 * import ছাড়াই — যেমন কেউ ভুল version active করে ফেললে rollback
 * করার জন্য।
 */
export async function setActiveHubImport(projectId: string, importId: string): Promise<void> {
  const target = await getHubImportById(projectId, importId)
  if (!target) {
    throw new Error(`importId "${importId}" খুঁজে পাওয়া যায়নি — active করা যাবে না।`)
  }
  const pointerRef = doc(db, 'projects', projectId, PARENT_COLLECTION, ACTIVE_POINTER_DOC)
  await setDoc(pointerRef, {
    importId,
    importedAt: target.importedAt,
  } satisfies ActiveImportPointer)
}
