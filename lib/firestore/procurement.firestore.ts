// lib/firestore/procurement.firestore.ts
//
// পাথ: projects/{projectId}/estimatingInput/procurementSchedule
//
// "কখন লাগবে" — Project Management App-এর schedule data এখনো নেই,
// তাই এই schedule সম্পূর্ণ manual entry (Module 2/7-এর একই
// manual-fallback প্যাটার্ন)। Rate Analysis-এর মতোই single-document,
// versioned না — schedule ক্রমান্বয়ে আপডেট হয় (status বদলানো:
// pending → ordered → received), প্রতিটা আপডেট আলাদা version হিসেবে
// রাখার প্রয়োজনীয়তা স্পষ্ট না।

import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ProcurementScheduleEntry, StoredProcurementSchedule } from '@/lib/types/procurement.types'

const PARENT_COLLECTION = 'estimatingInput'
const DOC_ID = 'procurementSchedule'

function generateId(): string {
  return `procentry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export async function getProcurementSchedule(projectId: string): Promise<StoredProcurementSchedule | null> {
  const ref = doc(db, 'projects', projectId, PARENT_COLLECTION, DOC_ID)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data() as StoredProcurementSchedule
}

async function saveEntries(projectId: string, entries: ProcurementScheduleEntry[]): Promise<void> {
  const ref = doc(db, 'projects', projectId, PARENT_COLLECTION, DOC_ID)
  await setDoc(ref, {
    projectId,
    updatedAt: Date.now(),
    entries,
  } satisfies StoredProcurementSchedule)
}

export async function addProcurementScheduleEntry(
  projectId: string,
  input: Omit<ProcurementScheduleEntry, 'id' | 'createdAt' | 'status'>
): Promise<ProcurementScheduleEntry> {
  const entry: ProcurementScheduleEntry = {
    ...input,
    id: generateId(),
    status: 'pending',
    createdAt: Date.now(),
  }
  const current = await getProcurementSchedule(projectId)
  await saveEntries(projectId, [...(current?.entries ?? []), entry])
  return entry
}

export async function updateProcurementScheduleStatus(
  projectId: string,
  entryId: string,
  status: ProcurementScheduleEntry['status']
): Promise<void> {
  const current = await getProcurementSchedule(projectId)
  if (!current) return
  const updated = current.entries.map((e) => (e.id === entryId ? { ...e, status } : e))
  await saveEntries(projectId, updated)
}

export async function deleteProcurementScheduleEntry(projectId: string, entryId: string): Promise<void> {
  const current = await getProcurementSchedule(projectId)
  if (!current) return
  await saveEntries(projectId, current.entries.filter((e) => e.id !== entryId))
}
