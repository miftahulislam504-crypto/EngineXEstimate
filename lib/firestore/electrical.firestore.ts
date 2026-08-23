// lib/firestore/electrical.firestore.ts
//
// পাথ: projects/{projectId}/estimatingInput/electrical
//
// reinforcement.firestore.ts-এর একই single-document pattern —
// versioned না, কারণ electrical layout সাধারণত ক্রমান্বয়ে সংশোধন
// হয় (electrical.types.ts-এর file-header কমেন্ট দ্রষ্টব্য একই
// যুক্তির জন্য)।

import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ElectricalPointRow, ElectricalCableRun, StoredElectrical } from '@/lib/types/electrical.types'

const PARENT_COLLECTION = 'estimatingInput'
const DOC_ID = 'electrical'

export async function getElectrical(projectId: string): Promise<StoredElectrical | null> {
  const ref = doc(db, 'projects', projectId, PARENT_COLLECTION, DOC_ID)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data() as StoredElectrical
}

async function saveElectrical(projectId: string, points: ElectricalPointRow[], cableRuns: ElectricalCableRun[]): Promise<void> {
  const ref = doc(db, 'projects', projectId, PARENT_COLLECTION, DOC_ID)
  await setDoc(ref, {
    projectId,
    updatedAt: Date.now(),
    points,
    cableRuns,
  } satisfies StoredElectrical)
}

// ── Point rows ──────────────────────────────────────────────────────

export async function addElectricalPointRow(projectId: string, row: ElectricalPointRow): Promise<void> {
  const current = await getElectrical(projectId)
  const updatedPoints = [...(current?.points ?? []), row]
  await saveElectrical(projectId, updatedPoints, current?.cableRuns ?? [])
}

export async function updateElectricalPointRow(projectId: string, updatedRow: ElectricalPointRow): Promise<void> {
  const current = await getElectrical(projectId)
  if (!current) return
  const updatedPoints = current.points.map((r) => (r.id === updatedRow.id ? updatedRow : r))
  await saveElectrical(projectId, updatedPoints, current.cableRuns)
}

export async function deleteElectricalPointRow(projectId: string, rowId: string): Promise<void> {
  const current = await getElectrical(projectId)
  if (!current) return
  const updatedPoints = current.points.filter((r) => r.id !== rowId)
  await saveElectrical(projectId, updatedPoints, current.cableRuns)
}

// ── Cable runs ──────────────────────────────────────────────────────

export async function addElectricalCableRun(projectId: string, row: ElectricalCableRun): Promise<void> {
  const current = await getElectrical(projectId)
  const updatedRuns = [...(current?.cableRuns ?? []), row]
  await saveElectrical(projectId, current?.points ?? [], updatedRuns)
}

export async function updateElectricalCableRun(projectId: string, updatedRow: ElectricalCableRun): Promise<void> {
  const current = await getElectrical(projectId)
  if (!current) return
  const updatedRuns = current.cableRuns.map((r) => (r.id === updatedRow.id ? updatedRow : r))
  await saveElectrical(projectId, current.points, updatedRuns)
}

export async function deleteElectricalCableRun(projectId: string, rowId: string): Promise<void> {
  const current = await getElectrical(projectId)
  if (!current) return
  const updatedRuns = current.cableRuns.filter((r) => r.id !== rowId)
  await saveElectrical(projectId, current.points, updatedRuns)
}
