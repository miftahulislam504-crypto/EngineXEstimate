// lib/firestore/reinforcement.firestore.ts
//
// পাথ: projects/{projectId}/estimatingInput/bbs
//
// Rate Analysis-এর মতোই single-document (versioned না) — কারণ BBS
// সাধারণত একবার তৈরি করে ক্রমান্বয়ে সংশোধন করা হয় (নতুন bar
// mark যোগ, কাটিং length ঠিক করা), প্রতিটা সংশোধনকে আলাদা "version"
// হিসেবে ট্র্যাক করার প্রয়োজনীয়তা BOQ/Hub import-এর মতো স্পষ্ট না।

import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { BBSRow, StoredBBS } from '@/lib/types/reinforcement.types'

const PARENT_COLLECTION = 'estimatingInput'
const DOC_ID = 'bbs'

export async function getBBS(projectId: string): Promise<StoredBBS | null> {
  const ref = doc(db, 'projects', projectId, PARENT_COLLECTION, DOC_ID)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data() as StoredBBS
}

export async function saveBBSRows(projectId: string, rows: BBSRow[]): Promise<void> {
  const ref = doc(db, 'projects', projectId, PARENT_COLLECTION, DOC_ID)
  await setDoc(ref, {
    projectId,
    updatedAt: Date.now(),
    rows,
  } satisfies StoredBBS)
}

export async function addBBSRow(projectId: string, row: BBSRow): Promise<void> {
  const current = await getBBS(projectId)
  const updatedRows = [...(current?.rows ?? []), row]
  await saveBBSRows(projectId, updatedRows)
}

export async function updateBBSRow(projectId: string, updatedRow: BBSRow): Promise<void> {
  const current = await getBBS(projectId)
  if (!current) return
  const updatedRows = current.rows.map((r) => (r.id === updatedRow.id ? updatedRow : r))
  await saveBBSRows(projectId, updatedRows)
}

export async function deleteBBSRow(projectId: string, rowId: string): Promise<void> {
  const current = await getBBS(projectId)
  if (!current) return
  const updatedRows = current.rows.filter((r) => r.id !== rowId)
  await saveBBSRows(projectId, updatedRows)
}
